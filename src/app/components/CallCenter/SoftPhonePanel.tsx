'use client';

import { useContext, useEffect, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Phone, PhoneOff, PhoneIncoming, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppContext } from '../../App';
import type { PhoneLine } from './CallCenter';

type RegStatus = 'disconnected' | 'registering' | 'registered' | 'error';

const MASKED = '••••••';

function isUsablePassword(password?: string): boolean {
  return !!password && password !== MASKED;
}

export function SoftPhonePanel(_props: { lines?: PhoneLine[] }) {
  const app = useContext(AppContext);
  const [myLine, setMyLine] = useState<PhoneLine | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordOverride, setPasswordOverride] = useState('');
  const [dialNumber, setDialNumber] = useState('');
  const [status, setStatus] = useState<RegStatus>('disconnected');
  const [inCall, setInCall] = useState(false);
  const [incoming, setIncoming] = useState(false);
  const uaRef = useRef<import('jssip').UA | null>(null);
  const sessionRef = useRef<import('jssip').RTCSession | null>(null);
  const statusRef = useRef<RegStatus>('disconnected');

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const loadMine = async () => {
    if (!app?.user?.id) {
      setMyLine(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/agent/lines/mine', {
        headers: { 'X-User-Id': app.user.id },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMyLine(null);
        return;
      }
      setMyLine(data.line ?? null);
    } catch {
      setMyLine(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMine();
    return () => {
      uaRef.current?.stop();
      uaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when user id changes
  }, [app?.user?.id]);

  const effectivePassword = isUsablePassword(myLine?.sipPassword)
    ? myLine!.sipPassword
    : passwordOverride;

  const register = async () => {
    if (!myLine?.sipUsername || !myLine.sipDomain) {
      toast.error('No SIP line assigned — ask Super Admin to assign your softphone');
      return;
    }
    if (!isUsablePassword(effectivePassword)) {
      toast.error('Enter your SIP password to register');
      return;
    }
    setStatus('registering');
    statusRef.current = 'registering';
    try {
      uaRef.current?.stop();
      const JsSIP = (await import('jssip')).default;
      const socket = new JsSIP.WebSocketInterface(
        `wss://${myLine.sipDomain.replace(/^sip\./, 'ws.')}/ws`,
      );
      const ua = new JsSIP.UA({
        sockets: [socket],
        uri: `sip:${myLine.sipUsername}@${myLine.sipDomain}`,
        password: effectivePassword,
        display_name: myLine.label,
      });
      ua.on('registered', () => {
        setStatus('registered');
        toast.success(`Registered ${myLine.label}`);
      });
      ua.on('registrationFailed', (e: { cause?: string }) => {
        setStatus('error');
        toast.error(`SIP registration failed${e?.cause ? `: ${e.cause}` : ''}`);
      });
      ua.on('disconnected', () => {
        // Soho66 often has no public SIP-over-WSS; classic phones use sip.soho66.co.uk:8060.
        if (statusRef.current === 'registering') {
          setStatus('error');
          toast.error(
            'Could not keep a WebSocket SIP session. Soho66 may not expose public WSS for JsSIP — use Soho66 VOIS or a SIP bridge for Aria.',
          );
        }
      });
      ua.on('newRTCSession', (data: { session: import('jssip').RTCSession }) => {
        const session = data.session;
        sessionRef.current = session;
        session.on('ended', () => {
          setInCall(false);
          setIncoming(false);
        });
        session.on('failed', () => {
          setInCall(false);
          setIncoming(false);
        });
        if (session.direction === 'incoming') {
          setIncoming(true);
          setInCall(false);
          toast.message('Incoming call');
        } else {
          setInCall(true);
        }
      });
      ua.start();
      uaRef.current = ua;
    } catch (err) {
      setStatus('error');
      toast.error(err instanceof Error ? err.message : 'JsSIP init failed');
    }
  };

  const answer = () => {
    sessionRef.current?.answer({ mediaConstraints: { audio: true, video: false } });
    setIncoming(false);
    setInCall(true);
  };

  const reject = () => {
    sessionRef.current?.terminate();
    setIncoming(false);
    setInCall(false);
  };

  const hangup = () => {
    sessionRef.current?.terminate();
    setInCall(false);
    setIncoming(false);
  };

  const call = () => {
    if (!uaRef.current || status !== 'registered' || !myLine) {
      toast.error('Register SIP first');
      return;
    }
    const target = dialNumber.replace(/\D/g, '');
    if (!target) return;
    const session = uaRef.current.call(`sip:${target}@${myLine.sipDomain}`, {
      mediaConstraints: { audio: true, video: false },
    });
    sessionRef.current = session;
    setInCall(true);
    session.on('ended', () => setInCall(false));
    session.on('failed', () => setInCall(false));
  };

  if (loading) {
    return <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading your softphone…</p>;
  }

  if (!myLine) {
    return (
      <p className="text-sm text-slate-500">
        No softphone assigned to you yet. Super Admin can assign a Soho66 extension under Settings → Team → Staff Softphones.
      </p>
    );
  }

  return (
    <div className="space-y-4 max-w-md">
      <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm">
        <p className="font-medium">{myLine.label}</p>
        <p className="text-slate-600">{myLine.sipUsername}@{myLine.sipDomain}</p>
        <p className="text-slate-500">DID {myLine.did}</p>
      </div>

      {!isUsablePassword(myLine.sipPassword) && (
        <div>
          <Label>SIP password</Label>
          <Input
            type="password"
            className="mt-1"
            value={passwordOverride}
            onChange={(e) => setPasswordOverride(e.target.value)}
            placeholder="Enter SIP password to register"
            autoComplete="off"
          />
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={status === 'registered' ? 'default' : 'secondary'}>{status}</Badge>
        {incoming && (
          <Badge variant="destructive" className="animate-pulse">
            <PhoneIncoming className="w-3 h-3 mr-1" /> ringing
          </Badge>
        )}
        {status !== 'registered' ? (
          <Button onClick={() => void register()} disabled={status === 'registering'}>
            {status === 'registering' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Phone className="w-4 h-4 mr-2" />}
            Register
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => {
              uaRef.current?.stop();
              setStatus('disconnected');
              setIncoming(false);
              setInCall(false);
            }}
          >
            Unregister
          </Button>
        )}
      </div>

      {incoming && (
        <div className="flex gap-2">
          <Button onClick={answer}>Answer</Button>
          <Button variant="destructive" onClick={reject}>Reject</Button>
        </div>
      )}

      <div>
        <Label>Dial number</Label>
        <div className="flex gap-2 mt-1">
          <Input value={dialNumber} onChange={(e) => setDialNumber(e.target.value)} placeholder="07..." />
          {inCall ? (
            <Button variant="destructive" onClick={hangup}><PhoneOff className="w-4 h-4" /></Button>
          ) : (
            <Button onClick={call} disabled={status !== 'registered' || incoming}><Phone className="w-4 h-4" /></Button>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Connects to <code>wss://{myLine.sipDomain.replace(/^sip\./, 'ws.')}/ws</code>. Incoming calls ring until you Answer or Reject.
        Soho66 desk/softphones usually use TCP/UDP port 8060; browser JsSIP needs SIP-over-WSS (not always offered on Soho66).
      </p>
    </div>
  );
}
