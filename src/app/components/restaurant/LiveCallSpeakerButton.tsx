import { Loader2, Volume2, VolumeX } from 'lucide-react';
import { Button } from '../ui/button';
import { useLiveCallAudio } from '../../hooks/useLiveCallAudio';

type Props = {
  listenUrl?: string | null;
  className?: string;
  size?: 'sm' | 'default';
  label?: string;
};

/** Page-bound Speaker control — listen-only; stops when leaving the page. */
export default function LiveCallSpeakerButton({
  listenUrl,
  className = '',
  size = 'default',
  label = 'Listen live',
}: Props) {
  const { status, error, isListening, start, stop, canListen } = useLiveCallAudio(listenUrl);

  if (!canListen && status === 'idle') {
    return (
      <Button
        type="button"
        variant="outline"
        size={size === 'sm' ? 'sm' : 'default'}
        disabled
        className={`min-h-11 gap-2 font-bold opacity-60 ${className}`}
        title="Live audio not ready yet"
      >
        <Volume2 className="h-4 w-4" />
        Speaker
      </Button>
    );
  }

  return (
    <div className={`inline-flex flex-col gap-1 ${className}`}>
      <Button
        type="button"
        variant={isListening ? 'default' : 'outline'}
        size={size === 'sm' ? 'sm' : 'default'}
        className={`min-h-11 gap-2 font-bold ${
          isListening ? 'bg-amber-500 text-s2d-teal-deep hover:bg-amber-400' : ''
        }`}
        data-testid="live-call-speaker"
        onClick={() => {
          if (isListening) stop();
          else void start();
        }}
        title={isListening ? 'Stop listening (they cannot hear you)' : 'Listen live — they cannot hear you'}
      >
        {status === 'connecting' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isListening ? (
          <VolumeX className="h-4 w-4" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
        {status === 'connecting' ? 'Connecting…' : isListening ? 'Stop' : label}
      </Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
      {isListening ? (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
          Listening · they cannot hear you
        </span>
      ) : null}
    </div>
  );
}
