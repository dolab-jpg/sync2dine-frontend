import { Phone, PhoneIncoming, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import LiveCallSpeakerButton from './LiveCallSpeakerButton';
import CallRecordingPlayer from './CallRecordingPlayer';

export type CallContextChipProps = {
  callId?: string;
  customerId?: string | null;
  phone?: string;
  contactName?: string;
  status?: string;
  isGuest?: boolean;
  listenUrl?: string | null;
  recordingUrl?: string | null;
  elapsedSec?: number | null;
  compact?: boolean;
  className?: string;
};

function elapsedLabel(sec?: number | null) {
  if (sec == null || !Number.isFinite(sec)) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Shared call context: live Speaker + Guest badge + CRM / recording links. */
export default function CallContextChip({
  callId,
  customerId,
  phone,
  contactName,
  status,
  isGuest,
  listenUrl,
  recordingUrl,
  elapsedSec,
  compact,
  className = '',
}: CallContextChipProps) {
  const navigate = useNavigate();
  const live = status === 'ringing' || status === 'in_progress';
  const name = contactName || (isGuest ? 'Guest' : phone) || 'Caller';
  const guest = isGuest || /^guest$/i.test(name);

  if (!live && !recordingUrl && !callId) return null;

  if (compact && live) {
    return (
      <div
        className={`inline-flex flex-wrap items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-2 py-1 ${className}`}
        data-testid="call-context-chip"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
        </span>
        <span className="text-xs font-bold text-amber-950">On call</span>
        {guest ? <Badge className="bg-amber-500 text-[10px] text-white">NEW CALLER</Badge> : null}
        <LiveCallSpeakerButton listenUrl={listenUrl} size="sm" label="Speaker" />
      </div>
    );
  }

  if (live) {
    return (
      <div
        className={`rounded-2xl border border-amber-300/80 bg-amber-50 p-3 space-y-2 ${className}`}
        data-testid="call-context-chip"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-2">
          <PhoneIncoming className={`h-4 w-4 text-amber-700 ${status === 'ringing' ? 'animate-pulse' : ''}`} />
          <p className="font-bold text-amber-950">
            {status === 'ringing' ? 'RINGING' : 'ON CALL'} · {name}
            {elapsedSec != null ? ` · ${elapsedLabel(elapsedSec)}` : ''}
          </p>
          {guest ? <Badge className="bg-amber-500 text-white">NEW CALLER</Badge> : null}
        </div>
        {phone ? <p className="font-mono text-sm text-amber-900/80">{phone}</p> : null}
        <div className="flex flex-wrap gap-2">
          <LiveCallSpeakerButton listenUrl={listenUrl} />
          {customerId ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 font-bold"
              onClick={() => navigate(`/customers?customerId=${encodeURIComponent(customerId)}`)}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open customer
            </Button>
          ) : null}
          {callId ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 font-bold"
              onClick={() => navigate(`/calls?callId=${encodeURIComponent(callId)}`)}
            >
              <Phone className="mr-2 h-4 w-4" />
              Calls
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`} data-testid="call-context-chip" onClick={(e) => e.stopPropagation()}>
      {callId ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-10 gap-1 font-bold"
          onClick={() => navigate(`/calls?callId=${encodeURIComponent(callId)}`)}
        >
          <Phone className="h-3.5 w-3.5" />
          View call
        </Button>
      ) : null}
      <CallRecordingPlayer url={recordingUrl} compact />
    </div>
  );
}
