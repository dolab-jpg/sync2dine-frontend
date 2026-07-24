'use client';

import { useContext, useEffect, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  Loader2,
  Delete,
  Mic,
  MicOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppContext } from '../../App';
import type { PhoneLine } from './CallCenter';
import { getHomeOrgId } from '../../engine/platform/homeOrg';

type RegStatus = 'disconnected' | 'registering' | 'registered' | 'error';

const MASKED = '••••••';
const KEYPAD: string[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

function isUsablePassword(password?: string): boolean {
  return !!password && password !== MASKED;
}

function toWssHost(sipDomain: string): string {
  return sipDomain.replace(/^sbc\./i, 'ws.').replace(/^sip\./i, 'ws.');
}

function toDialDisplay(digits: string): string {
  if (!digits) return '';
  return digits;
}

function normalizeUkDid(did: string): string {
  const d = did.replace(/\D/g, '');
  if (d.startsWith('44') && d.length >= 12) return `+${d}`;
  if (d.startsWith('0') && d.length >= 10) return `+44${d.slice(1)}`;
  if (d.length >= 10) return `+${d}`;
  return did.trim();
}

export function SoftPhonePanel(props: { lines?: PhoneLine[]; salesMode?: boolean }) {
  const app = useContext(AppContext);
  const isSales = props.salesMode === true;
  const [myLine, setMyLine] = useState<PhoneLine | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordOverride, setPasswordOverride] = useState('');
  const [dialNumber, setDialNumber] = useState('');
  const [status, setStatus] = useState<RegStatus>('disconnected');
  const [inCall, setInCall] = useState(false);
  const [incoming, setIncoming] = useState(false);
  const [muted, setMuted] = useState(false);
  const [remoteNumber, setRemoteNumber] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [transferReady, setTransferReady] = useState<boolean | null>(null);
  const [transferSaving, setTransferSaving] = useState(false);
  const [crmMatch, setCrmMatch] = useState<{
    name?: string;
    customerId?: string;
    isGuest?: boolean;
  } | null>(null);
  const uaRef = useRef<import('jssip').UA | null>(null);
  const sessionRef = useRef<import('jssip').RTCSession | null>(null);
  const statusRef = useRef<RegStatus>('disconnected');
  const localStreamRef = useRef<MediaStream | null>(null);

  const lookupCrm = async (phone: string | null) => {
    if (!phone) {
      setCrmMatch(null);
      return;
    }
    try {
      const res = await fetch(`/api/contacts/lookup?phone=${encodeURIComponent(phone)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCrmMatch({ name: undefined, isGuest: true });
        return;
      }
      const name = data.customerName || data.contactName || data.name;
      const customerId = data.customerId || data.id;
      setCrmMatch({
        name: name || undefined,
        customerId: customerId || undefined,
        isGuest: !name && !customerId,
      });
    } catch {
      setCrmMatch({ isGuest: true });
    }
  };

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
      // #region agent log
      const line = data.line ?? null;
      fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'036e91'},body:JSON.stringify({sessionId:'036e91',runId:'cred-check',hypothesisId:'H-A',location:'SoftPhonePanel.tsx:loadMine',message:'client mine response',data:{ok:res.ok,status:res.status,userIdSuffix:app.user.id.slice(-8),found:Boolean(line),lineId:line?.id??null,label:line?.label??null,did:line?.did??null,sipUsername:line?.sipUsername??null,hasPassword:Boolean(line?.sipPassword),passwordLen:line?.sipPassword?.length??0,passwordIsMasked:line?.sipPassword==='••••••',usablePassword:isUsablePassword(line?.sipPassword),assignedSuffix:(line?.assignedUserId??'').slice(-8)||null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (!res.ok) {
        setMyLine(null);
        return;
      }
      setMyLine(data.line ?? null);
      // #region agent log
      void fetch('/api/agent/lines').then(async (r) => {
        const d = await r.json().catch(() => ({}));
        const lines = Array.isArray(d.lines) ? d.lines : [];
        fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'036e91'},body:JSON.stringify({sessionId:'036e91',runId:'cred-check',hypothesisId:'H-B',location:'SoftPhonePanel.tsx:loadMine:allLines',message:'client all lines (masked)',data:{count:lines.length,staff:lines.filter((l:PhoneLine)=>(l.purpose??'staff')==='staff').map((l:PhoneLine)=>({id:l.id,label:l.label,did:l.did,hasMaskedPassword:l.sipPassword==='••••••',emptyPassword:!l.sipPassword,assignedSuffix:(l.assignedUserId??'').slice(-8)||null,status:l.status}))},timestamp:Date.now()})}).catch(()=>{});
      }).catch(()=>{});
      // #endregion
    } catch {
      setMyLine(null);
    } finally {
      setLoading(false);
    }
  };

  const checkTransferReady = async (line: PhoneLine | null) => {
    if (!line?.did) {
      setTransferReady(null);
      return;
    }
    try {
      // Sally sales handoff numbers live on the home/platform org, not the acting-as client.
      const headers: HeadersInit = isSales ? { 'X-Org-Id': getHomeOrgId() } : {};
      const res = await fetch('/api/agent/transfer-numbers', { headers });
      const data = await res.json().catch(() => ({}));
      const sales = String(data.transferNumbers?.sales ?? '').replace(/\D/g, '');
      const did = line.did.replace(/\D/g, '');
      const salesNorm = sales.startsWith('44') ? sales : sales.startsWith('0') ? `44${sales.slice(1)}` : sales;
      const didNorm = did.startsWith('44') ? did : did.startsWith('0') ? `44${did.slice(1)}` : did;
      const ready = Boolean(salesNorm) && salesNorm === didNorm;
      // #region agent log
      fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'036e91'},body:JSON.stringify({sessionId:'036e91',runId:'cred-check',hypothesisId:'H-D',location:'SoftPhonePanel.tsx:checkTransferReady',message:'sales transfer check',data:{lineDid:line.did,salesRaw:data.transferNumbers?.sales??null,salesNorm,didNorm,ready,allDepts:data.transferNumbers??{}},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      setTransferReady(ready);
    } catch {
      setTransferReady(null);
    }
  };

  useEffect(() => {
    void loadMine();
    return () => {
      uaRef.current?.stop();
      uaRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when user id changes
  }, [app?.user?.id]);

  useEffect(() => {
    void checkTransferReady(myLine);
  }, [myLine?.id, myLine?.did]);

  const effectivePassword = isUsablePassword(myLine?.sipPassword)
    ? myLine!.sipPassword
    : passwordOverride;

  const wssUrl = myLine ? `wss://${toWssHost(myLine.sipDomain)}/ws` : '';

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
    setLastError(null);
    // #region agent log
    fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'036e91'},body:JSON.stringify({sessionId:'036e91',runId:'cred-check',hypothesisId:'H-E',location:'SoftPhonePanel.tsx:register',message:'register attempt',data:{label:myLine.label,sipUsername:myLine.sipUsername,sipDomain:myLine.sipDomain,wssHost:toWssHost(myLine.sipDomain),passwordLen:effectivePassword.length,passwordFromLine:isUsablePassword(myLine.sipPassword),usingOverride:!isUsablePassword(myLine.sipPassword)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    try {
      uaRef.current?.stop();
      const JsSIP = (await import('jssip')).default;
      const wssHost = toWssHost(myLine.sipDomain);
      const socket = new JsSIP.WebSocketInterface(`wss://${wssHost}/ws`);
      const ua = new JsSIP.UA({
        sockets: [socket],
        uri: `sip:${myLine.sipUsername}@${myLine.sipDomain}`,
        password: effectivePassword,
        display_name: myLine.label,
        session_timers: false,
        register_expires: 300,
      });
      ua.on('registered', () => {
        // #region agent log
        fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'036e91'},body:JSON.stringify({sessionId:'036e91',runId:'cred-check',hypothesisId:'H-E',location:'SoftPhonePanel.tsx:registered',message:'SIP registered ok',data:{label:myLine.label},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        setStatus('registered');
        setLastError(null);
        toast.success(`Registered ${myLine.label}`);
      });
      ua.on('registrationFailed', (e: { cause?: string }) => {
        // #region agent log
        fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'036e91'},body:JSON.stringify({sessionId:'036e91',runId:'cred-check',hypothesisId:'H-E',location:'SoftPhonePanel.tsx:registrationFailed',message:'SIP registration failed',data:{cause:e?.cause??null,passwordLen:effectivePassword.length},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        setStatus('error');
        const msg = `SIP registration failed${e?.cause ? `: ${e.cause}` : ''}`;
        setLastError(msg);
        toast.error(msg);
      });
      ua.on('disconnected', () => {
        // #region agent log
        fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'036e91'},body:JSON.stringify({sessionId:'036e91',runId:'cred-check',hypothesisId:'H-E',location:'SoftPhonePanel.tsx:disconnected',message:'SIP websocket disconnected',data:{statusAtEvent:statusRef.current,wssHost},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (statusRef.current === 'registering') {
          setStatus('error');
          const msg =
            'Browser WebSocket SIP failed. Soho66 usually needs VOIS or a desk phone (TCP/UDP 8060). Sally can still transfer to your DID — set Sales handoff below.';
          setLastError(msg);
          toast.error(msg);
        } else if (statusRef.current === 'registered') {
          setStatus('disconnected');
        }
      });
      ua.on('newRTCSession', (data: { session: import('jssip').RTCSession }) => {
        const session = data.session;
        sessionRef.current = session;
        const remoteIdentity = (
          session as unknown as {
            remote_identity?: { uri?: { user?: string }; display_name?: string };
          }
        ).remote_identity;
        const callerNumber = remoteIdentity?.uri?.user ?? null;
        setRemoteNumber(callerNumber ? remoteIdentity?.display_name || callerNumber : null);
        void lookupCrm(callerNumber);
        session.on('ended', () => {
          setInCall(false);
          setIncoming(false);
          setRemoteNumber(null);
          setCrmMatch(null);
          setMuted(false);
        });
        session.on('failed', () => {
          setInCall(false);
          setIncoming(false);
          setRemoteNumber(null);
          setCrmMatch(null);
          setMuted(false);
        });
        if (session.direction === 'incoming') {
          setIncoming(true);
          setInCall(false);
          toast.message(callerNumber ? `Incoming call from ${callerNumber}` : 'Incoming call');
        } else {
          setInCall(true);
        }
      });
      ua.start();
      uaRef.current = ua;
    } catch (err) {
      setStatus('error');
      const msg = err instanceof Error ? err.message : 'JsSIP init failed';
      setLastError(msg);
      toast.error(msg);
    }
  };

  const unregister = () => {
    uaRef.current?.stop();
    uaRef.current = null;
    setStatus('disconnected');
    setIncoming(false);
    setInCall(false);
    setMuted(false);
    setLastError(null);
  };

  const answer = () => {
    sessionRef.current?.answer({ mediaConstraints: { audio: true, video: false } });
    setIncoming(false);
    setInCall(true);
    void lookupCrm(remoteNumber);
  };

  const reject = () => {
    sessionRef.current?.terminate();
    setIncoming(false);
    setInCall(false);
    setRemoteNumber(null);
    setCrmMatch(null);
  };

  const hangup = () => {
    sessionRef.current?.terminate();
    setInCall(false);
    setIncoming(false);
    setRemoteNumber(null);
    setCrmMatch(null);
    setMuted(false);
  };

  const call = () => {
    if (!uaRef.current || status !== 'registered' || !myLine) {
      toast.error('Register SIP first — or use Soho66 VOIS with the same extension');
      return;
    }
    const target = dialNumber.replace(/[^\d*#]/g, '');
    if (!target) return;
    const session = uaRef.current.call(`sip:${target}@${myLine.sipDomain}`, {
      mediaConstraints: { audio: true, video: false },
    });
    sessionRef.current = session;
    setInCall(true);
    setRemoteNumber(target);
    session.on('ended', () => {
      setInCall(false);
      setRemoteNumber(null);
    });
    session.on('failed', () => {
      setInCall(false);
      setRemoteNumber(null);
    });
  };

  const pressKey = (key: string) => {
    if (inCall && sessionRef.current) {
      try {
        sessionRef.current.sendDTMF(key);
      } catch {
        // ignore DTMF failures
      }
    }
    setDialNumber((prev) => (prev + key).slice(0, 24));
  };

  const backspace = () => {
    setDialNumber((prev) => prev.slice(0, -1));
  };

  const toggleMute = () => {
    const session = sessionRef.current as unknown as {
      mute?: (opts?: { audio?: boolean }) => void;
      unmute?: (opts?: { audio?: boolean }) => void;
      isMuted?: () => { audio?: boolean };
    } | null;
    if (!session || !inCall) return;
    if (muted) {
      session.unmute?.({ audio: true });
      setMuted(false);
    } else {
      session.mute?.({ audio: true });
      setMuted(true);
    }
  };

  const setAsSallySalesTransfer = async () => {
    if (!myLine?.did) {
      toast.error('This softphone has no DID');
      return;
    }
    setTransferSaving(true);
    try {
      const salesDid = normalizeUkDid(myLine.did);
      // Sally reads transfer numbers from home/platform org — not the acting-as client.
      const res = await fetch('/api/agent/transfer-numbers', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(isSales ? { 'X-Org-Id': getHomeOrgId() } : {}),
        },
        body: JSON.stringify({ sales: salesDid }),
      });
      const data = await res.json().catch(() => ({}));
      // #region agent log
      fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'036e91'},body:JSON.stringify({sessionId:'036e91',runId:'cred-check',hypothesisId:'H-D',location:'SoftPhonePanel.tsx:setAsSallySalesTransfer',message:'save sales transfer',data:{ok:res.ok,status:res.status,salesDid,savedSales:data.transferNumbers?.sales??null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (!res.ok) throw new Error(data.error ?? 'Failed to save sales transfer');
      setTransferReady(true);
      toast.success(
        isSales
          ? `Sally will warm-transfer Sales to ${normalizeUkDid(myLine.did)}`
          : `Sales transfers will ring ${normalizeUkDid(myLine.did)}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save sales transfer');
    } finally {
      setTransferSaving(false);
    }
  };

  if (loading) {
    return (
      <p className="text-sm text-s2d-ink-muted flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your softphone…
      </p>
    );
  }

  if (!myLine) {
    return (
      <p className="text-sm text-s2d-ink-muted">
        No softphone assigned to you yet. Super Admin can assign a Soho66 extension under Settings → Team →
        Staff Softphones.
      </p>
    );
  }

  const statusLabel =
    status === 'registered'
      ? 'Ready'
      : status === 'registering'
        ? 'Connecting…'
        : status === 'error'
          ? 'Offline'
          : 'Not connected';

  const screenPrimary = incoming
    ? remoteNumber || 'Incoming…'
    : inCall
      ? remoteNumber || dialNumber || 'On call'
      : toDialDisplay(dialNumber) || 'Enter number';

  const screenSecondary = incoming
    ? crmMatch?.name
      ? `CRM · ${crmMatch.name}`
      : 'Guest caller'
    : inCall
      ? crmMatch?.name || 'Connected'
      : `${myLine.label} · Ext ${myLine.sipUsername}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr] max-w-3xl">
      {/* Handset */}
      <div className="rounded-2xl border border-s2d-teal-ink/40 bg-gradient-to-b from-s2d-teal-deep to-s2d-teal-ink p-4 shadow-lg text-s2d-cream">
        {/* Display */}
        <div className="rounded-xl bg-s2d-teal-ink/80 border border-s2d-teal-soft/40 px-4 py-5 min-h-[140px] font-mono">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-s2d-cream/60 mb-3">
            <span className="flex items-center gap-1.5">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  status === 'registered'
                    ? 'bg-s2d-gold'
                    : status === 'registering'
                      ? 'bg-s2d-gold-soft animate-pulse'
                      : status === 'error'
                        ? 'bg-red-400'
                        : 'bg-s2d-cream/30'
                }`}
              />
              {statusLabel}
            </span>
            <span className="truncate max-w-[50%] text-right">{myLine.did}</span>
          </div>
          <p className="text-2xl font-semibold tracking-wide text-s2d-gold break-all leading-tight min-h-[2rem]">
            {screenPrimary}
          </p>
          <p className="mt-2 text-xs text-s2d-cream/60 truncate">{screenSecondary}</p>
          {incoming && (
            <p className="mt-2 text-xs text-s2d-gold-soft flex items-center gap-1 animate-pulse">
              <PhoneIncoming className="w-3 h-3" /> Ringing
            </p>
          )}
        </div>

        {!isUsablePassword(myLine.sipPassword) && (
          <div className="mt-3">
            <Label className="text-s2d-cream/80 text-xs">SIP password</Label>
            <Input
              type="password"
              className="mt-1 bg-s2d-teal-ink/60 border-s2d-teal-soft/40 text-s2d-cream placeholder:text-s2d-cream/40"
              value={passwordOverride}
              onChange={(e) => setPasswordOverride(e.target.value)}
              placeholder="Enter SIP password"
              autoComplete="off"
            />
          </div>
        )}

        {/* Keypad */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {KEYPAD.flat().map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => pressKey(key)}
              className="h-14 min-h-14 rounded-xl bg-s2d-teal-soft/40 hover:bg-s2d-teal-soft/70 active:bg-s2d-teal border border-s2d-teal-soft/30 text-xl font-medium text-s2d-cream transition-colors touch-manipulation"
            >
              {key}
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="bg-s2d-teal-soft/30 border-s2d-teal-soft/40 text-s2d-cream hover:bg-s2d-teal-soft/50 min-h-11 min-w-11"
            onClick={backspace}
            disabled={!dialNumber || inCall}
            aria-label="Backspace"
          >
            <Delete className="w-4 h-4" />
          </Button>
          {status !== 'registered' ? (
            <Button
              className="flex-1 min-h-11 bg-s2d-gold hover:bg-s2d-gold-soft text-s2d-teal-deep font-semibold"
              onClick={() => void register()}
              disabled={status === 'registering'}
            >
              {status === 'registering' ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Phone className="w-4 h-4 mr-2" />
              )}
              Connect
            </Button>
          ) : incoming ? (
            <>
              <Button className="flex-1 min-h-11 bg-s2d-gold hover:bg-s2d-gold-soft text-s2d-teal-deep font-semibold" onClick={answer}>
                Answer
              </Button>
              <Button className="flex-1 min-h-11" variant="destructive" onClick={reject}>
                Reject
              </Button>
            </>
          ) : inCall ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="bg-s2d-teal-soft/30 border-s2d-teal-soft/40 text-s2d-cream min-h-11 min-w-11"
                onClick={toggleMute}
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Button className="flex-1 min-h-11" variant="destructive" onClick={hangup}>
                <PhoneOff className="w-4 h-4 mr-2" />
                End
              </Button>
            </>
          ) : (
            <>
              <Button
                className="flex-1 min-h-11 bg-s2d-gold hover:bg-s2d-gold-soft text-s2d-teal-deep font-semibold"
                onClick={call}
                disabled={!dialNumber}
              >
                <Phone className="w-4 h-4 mr-2" />
                Call
              </Button>
              <Button
                variant="outline"
                className="bg-s2d-teal-soft/30 border-s2d-teal-soft/40 text-s2d-cream hover:bg-s2d-teal-soft/50 min-h-11"
                onClick={unregister}
              >
                Disconnect
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Side panel */}
      <div className="space-y-4 text-sm">
        <div className="rounded-xl border border-s2d-teal/15 bg-white px-4 py-3 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-s2d-teal-deep">{myLine.label}</p>
            <Badge
              variant={status === 'registered' ? 'default' : 'secondary'}
              className={status === 'registered' ? 'bg-s2d-teal' : ''}
            >
              {statusLabel}
            </Badge>
            {transferReady === true && (
              <Badge className="bg-s2d-gold-soft text-s2d-teal-deep hover:bg-s2d-gold-soft">
                {isSales ? 'Sally sales handoff' : 'Sales transfer'}
              </Badge>
            )}
          </div>
          <p className="text-s2d-ink-body font-mono text-xs">
            {myLine.sipUsername}@{myLine.sipDomain}
          </p>
          <p className="text-s2d-ink-muted">DID {myLine.did}</p>
        </div>

        <div className="rounded-xl border border-s2d-gold/40 bg-s2d-gold-soft/30 px-4 py-3 space-y-2">
          <p className="font-medium text-s2d-teal-deep">
            {isSales ? 'Sally → you (Sales)' : 'AI → Sales transfer'}
          </p>
          <p className="text-s2d-ink-body/80 text-xs leading-relaxed">
            {isSales
              ? 'When Sally warm-transfers a sales caller, Vapi dials the Sales transfer number — not this browser tab. Point Sales at this DID so your Soho66 extension rings (VOIS or this softphone if Connect works).'
              : 'Set Sales transfer to this DID so mid-call handoffs ring this extension.'}
          </p>
          <Button
            size="sm"
            className="bg-s2d-teal-deep hover:bg-s2d-teal"
            onClick={() => void setAsSallySalesTransfer()}
            disabled={transferSaving || transferReady === true}
          >
            {transferSaving
              ? 'Saving…'
              : transferReady
                ? 'Already set for Sales'
                : `Use ${myLine.did} as Sales transfer`}
          </Button>
        </div>

        {lastError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900 space-y-1">
            <p className="font-medium">Connection issue</p>
            <p>{lastError}</p>
            <p className="text-red-800/80">
              Fallback: log into Soho66 VOIS with the same SIP username/password. Outbound and inbound still work
              there. Sally handoff only needs the Sales DID above.
            </p>
          </div>
        )}

        {status === 'registered' && (
          <p className="text-xs text-s2d-teal-deep bg-s2d-cream border border-s2d-teal/15 rounded-xl px-3 py-2">
            Softphone online — you can dial out and answer inbound on this extension.
          </p>
        )}

        <p className="text-xs text-s2d-ink-muted leading-relaxed">
          Tries <code className="text-[11px]">{wssUrl}</code>. Desk phones use TCP/UDP 8060; browser needs
          SIP-over-WSS (Soho66 often blocks that).
        </p>
      </div>
    </div>
  );
}
