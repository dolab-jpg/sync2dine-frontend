'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Phone, PhoneOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PhoneLine } from './CallCenter';

interface SoftPhonePanelProps {
  lines: PhoneLine[];
}

type RegStatus = 'disconnected' | 'registering' | 'registered' | 'error';

export function SoftPhonePanel({ lines }: SoftPhonePanelProps) {
  const [lineId, setLineId] = useState(lines[0]?.id ?? '');
  const [dialNumber, setDialNumber] = useState('');
  const [status, setStatus] = useState<RegStatus>('disconnected');
  const [inCall, setInCall] = useState(false);
  const uaRef = useRef<import('jssip').UA | null>(null);
  const sessionRef = useRef<import('jssip').RTCSession | null>(null);

  const selected = lines.find((l) => l.id === lineId) ?? lines[0];

  useEffect(() => {
    return () => {
      uaRef.current?.stop();
      uaRef.current = null;
    };
  }, []);

  const register = async () => {
    if (!selected?.sipUsername || !selected.sipPassword) {
      toast.error('Select a phone line with SIP credentials');
      return;
    }
    setStatus('registering');
    try {
      const JsSIP = (await import('jssip')).default;
      const socket = new JsSIP.WebSocketInterface(
        `wss://${selected.sipDomain.replace(/^sip\./, 'ws.')}/ws`
      );
      const ua = new JsSIP.UA({
        sockets: [socket],
        uri: `sip:${selected.sipUsername}@${selected.sipDomain}`,
        password: selected.sipPassword,
        display_name: selected.label,
      });
      ua.on('registered', () => {
        setStatus('registered');
        toast.success(`Registered ${selected.label}`);
      });
      ua.on('registrationFailed', () => {
        setStatus('error');
        toast.error('SIP registration failed — check credentials and WSS URL');
      });
      ua.on('newRTCSession', (data) => {
        const session = data.session;
        sessionRef.current = session;
        setInCall(true);
        session.on('ended', () => setInCall(false));
        session.on('failed', () => setInCall(false));
        if (session.direction === 'incoming') {
          session.answer({ mediaConstraints: { audio: true, video: false } });
        }
      });
      ua.start();
      uaRef.current = ua;
    } catch (err) {
      setStatus('error');
      toast.error(err instanceof Error ? err.message : 'JsSIP init failed');
    }
  };

  const hangup = () => {
    sessionRef.current?.terminate();
    setInCall(false);
  };

  const call = () => {
    if (!uaRef.current || status !== 'registered') {
      toast.error('Register SIP first');
      return;
    }
    const target = dialNumber.replace(/\D/g, '');
    if (!target) return;
    const session = uaRef.current.call(`sip:${target}@${selected.sipDomain}`, {
      mediaConstraints: { audio: true, video: false },
    });
    sessionRef.current = session;
    setInCall(true);
    session.on('ended', () => setInCall(false));
    session.on('failed', () => setInCall(false));
  };

  if (!lines.length) {
    return <p className="text-sm text-slate-500">Add a phone line under Phone Lines first.</p>;
  }

  return (
    <div className="space-y-4 max-w-md">
      <div>
        <Label>SIP extension</Label>
        <select
          className="mt-1 w-full border rounded-md h-10 px-3 text-sm"
          value={lineId}
          onChange={(e) => setLineId(e.target.value)}
        >
          {lines.map((l) => (
            <option key={l.id} value={l.id}>{l.label} ({l.did})</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={status === 'registered' ? 'default' : 'secondary'}>{status}</Badge>
        {status !== 'registered' ? (
          <Button onClick={register} disabled={status === 'registering'}>
            {status === 'registering' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Phone className="w-4 h-4 mr-2" />}
            Register
          </Button>
        ) : (
          <Button variant="outline" onClick={() => { uaRef.current?.stop(); setStatus('disconnected'); }}>
            Unregister
          </Button>
        )}
      </div>
      <div>
        <Label>Dial number</Label>
        <div className="flex gap-2 mt-1">
          <Input value={dialNumber} onChange={(e) => setDialNumber(e.target.value)} placeholder="07..." />
          {inCall ? (
            <Button variant="destructive" onClick={hangup}><PhoneOff className="w-4 h-4" /></Button>
          ) : (
            <Button onClick={call} disabled={status !== 'registered'}><Phone className="w-4 h-4" /></Button>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Browser soft phone via JsSIP. Requires WSS on your SIP provider (Soho66/Jambonz). Click-to-call from CRM uses the same extension.
      </p>
    </div>
  );
}
