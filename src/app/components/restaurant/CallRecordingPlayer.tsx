import { useState } from 'react';
import { Headphones, X } from 'lucide-react';
import { Button } from '../ui/button';

type Props = {
  /** Preferred prop */
  recordingUrl?: string | null;
  /** Alias used by some boards */
  url?: string | null;
  label?: string;
  compact?: boolean;
  className?: string;
  testId?: string;
};

/**
 * Safe call recording player — only renders &lt;audio&gt; for http(s) URLs.
 */
export default function CallRecordingPlayer({
  recordingUrl,
  url,
  label = 'Listen',
  compact = false,
  className = '',
  testId = 'call-recording-player',
}: Props) {
  const [open, setOpen] = useState(false);
  const raw = typeof recordingUrl === 'string' ? recordingUrl : typeof url === 'string' ? url : '';
  const trimmed = raw.trim();
  const safe = /^https?:\/\//i.test(trimmed) || trimmed.startsWith('blob:');

  if (!safe) return null;

  if (compact && !open) {
    return (
      <Button
        type="button"
        variant="outline"
        className={`min-h-12 touch-manipulation font-bold ${className}`}
        data-testid={`${testId}-open`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Headphones className="mr-2 h-4 w-4" />
        {label}
      </Button>
    );
  }

  return (
    <div
      className={`rounded-xl border border-s2d-teal/20 bg-s2d-cream/60 p-2 ${className}`}
      data-testid={testId}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-s2d-teal-deep">
          <Headphones className="h-3.5 w-3.5" />
          Call recording
        </p>
        {compact && (
          <button
            type="button"
            className="min-h-10 min-w-10 rounded-lg p-2 text-slate-500 hover:bg-white"
            aria-label="Hide player"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <audio controls preload="none" src={trimmed} className="w-full max-w-full">
        <track kind="captions" />
      </audio>
    </div>
  );
}

export function CallRecordingBadge({ recordingUrl }: { recordingUrl?: string | null }) {
  const url = typeof recordingUrl === 'string' ? recordingUrl.trim() : '';
  if (!/^https?:\/\//i.test(url)) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-900"
      data-testid="call-recording-badge"
    >
      <Headphones className="h-3 w-3" />
      Called
    </span>
  );
}

/** Alias used by BookingsBoard */
export function CalledBadge({
  hasRecording,
  recordingUrl,
}: {
  hasRecording?: boolean;
  recordingUrl?: string | null;
}) {
  if (recordingUrl) return <CallRecordingBadge recordingUrl={recordingUrl} />;
  if (!hasRecording) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-900"
      data-testid="call-recording-badge"
    >
      <Headphones className="h-3 w-3" />
      Called
    </span>
  );
}
