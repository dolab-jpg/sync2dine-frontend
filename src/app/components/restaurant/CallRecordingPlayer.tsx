import { useEffect, useRef, useState } from 'react';
import { Download, Headphones, RefreshCw, X } from 'lucide-react';
import { Button } from '../ui/button';

const SPEED_OPTIONS = [1, 1.5, 2] as const;
type PlaybackSpeed = (typeof SPEED_OPTIONS)[number];
const DEFAULT_SPEED: PlaybackSpeed = 1.5;

type Props = {
  /** Preferred prop — provider URL or same-origin playback path */
  recordingUrl?: string | null;
  /** Alias used by some boards */
  url?: string | null;
  /** Same-origin API path e.g. /api/calls/:id/recording */
  playbackPath?: string | null;
  callId?: string | null;
  label?: string;
  compact?: boolean;
  className?: string;
  testId?: string;
  /** Show empty state instead of null when no URL */
  showEmptyState?: boolean;
  emptyHint?: string;
  onRefreshFromProvider?: () => void | Promise<void>;
  refreshing?: boolean;
};

function resolveSrc(recordingUrl?: string | null, url?: string | null, playbackPath?: string | null): string {
  const path = typeof playbackPath === 'string' ? playbackPath.trim() : '';
  if (path.startsWith('/')) return path;
  const raw = typeof recordingUrl === 'string' ? recordingUrl : typeof url === 'string' ? url : '';
  return raw.trim();
}

/**
 * Safe call recording player — http(s), blob, or same-origin /api/calls/:id/recording.
 * Ops default playback rate is 1.5x with 1x / 1.5x / 2x controls.
 */
export default function CallRecordingPlayer({
  recordingUrl,
  url,
  playbackPath,
  callId,
  label = 'Listen',
  compact = false,
  className = '',
  testId = 'call-recording-player',
  showEmptyState = false,
  emptyHint,
  onRefreshFromProvider,
  refreshing = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(DEFAULT_SPEED);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trimmed = resolveSrc(recordingUrl, url, playbackPath);
  const safe = /^https?:\/\//i.test(trimmed) || trimmed.startsWith('blob:') || trimmed.startsWith('/');
  const downloadHref = callId
    ? `/api/calls/${encodeURIComponent(callId)}/recording?download=1`
    : (trimmed.startsWith('/') ? `${trimmed}${trimmed.includes('?') ? '&' : '?'}download=1` : trimmed);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  if (!safe) {
    if (!showEmptyState) return null;
    return (
      <div
        className={`rounded-xl border border-dashed border-slate-300 bg-white/80 p-3 ${className}`}
        data-testid={`${testId}-empty`}
      >
        <p className="text-xs font-semibold text-slate-600">No recording yet</p>
        <p className="mt-1 text-xs text-slate-500">
          {emptyHint
            || 'Recording appears after the provider end-of-call report, or after Refresh from provider.'}
        </p>
        {onRefreshFromProvider && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2"
            disabled={refreshing}
            onClick={(e) => {
              e.stopPropagation();
              void onRefreshFromProvider();
            }}
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh from provider
          </Button>
        )}
      </div>
    );
  }

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
        <div className="flex items-center gap-1">
          <a
            href={downloadHref}
            className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-600 hover:bg-white"
            download
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
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
  if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) return null;
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
