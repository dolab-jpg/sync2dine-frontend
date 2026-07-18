import { useEffect, useRef, useState } from 'react';
import { Headphones, X } from 'lucide-react';
import { Button } from '../ui/button';

const SPEED_OPTIONS = [1, 1.5, 2] as const;
type PlaybackSpeed = (typeof SPEED_OPTIONS)[number];
const DEFAULT_SPEED: PlaybackSpeed = 1.5;

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
 * Ops default playback rate is 1.5x with 1x / 1.5x / 2x controls.
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
  const [speed, setSpeed] = useState<PlaybackSpeed>(DEFAULT_SPEED);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const raw = typeof recordingUrl === 'string' ? recordingUrl : typeof url === 'string' ? url : '';
  const trimmed = raw.trim();
  const safe = /^https?:\/\//i.test(trimmed) || trimmed.startsWith('blob:');

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

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
      <audio
        ref={audioRef}
        controls
        preload="none"
        src={trimmed}
        className="w-full max-w-full"
        onLoadedMetadata={(e) => {
          e.currentTarget.playbackRate = speed;
        }}
        onPlay={(e) => {
          e.currentTarget.playbackRate = speed;
        }}
      >
        <track kind="captions" />
      </audio>
      <div className="mt-1.5 flex flex-wrap items-center gap-1" data-testid={`${testId}-speed`}>
        <span className="mr-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Speed</span>
        {SPEED_OPTIONS.map((rate) => (
          <button
            key={rate}
            type="button"
            className={`min-h-9 rounded-lg px-2.5 text-xs font-bold touch-manipulation ${
              speed === rate
                ? 'bg-s2d-teal-deep text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
            aria-pressed={speed === rate}
            onClick={() => setSpeed(rate)}
          >
            {rate === 1 ? '1x' : `${rate}x`}
          </button>
        ))}
      </div>
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
