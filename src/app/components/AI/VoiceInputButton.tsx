import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { toast } from 'sonner';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  /** @deprecated Native audio is transcribed via Whisper; kept for API compat. */
  onVoiceNote?: (dataUrl: string) => void;
  /** Compact ghost button for in-pill composer. */
  compact?: boolean;
}

/**
 * Mic control: native hold-to-record (+ Whisper) in the Flutter shell,
 * Web Speech API elsewhere.
 */
export function VoiceInputButton({ onTranscript, compact = false }: VoiceInputButtonProps) {
  const {
    isListening,
    isTranscribing,
    startListening,
    stopListening,
    isSupported,
    isNative,
  } = useVoiceInput(onTranscript, {
    onError: (message) => toast.error(message),
  });

  if (!isSupported) return null;

  const busy = isListening || isTranscribing;
  const sizeClass = compact ? 'size-9 rounded-full' : 'min-h-11 min-w-11';
  const variant = compact
    ? (busy ? 'destructive' : 'ghost')
    : (busy ? 'destructive' : 'outline');

  if (isNative) {
    return (
      <Button
        type="button"
        size="icon"
        variant={variant}
        disabled={isTranscribing}
        className={`${sizeClass} touch-manipulation`}
        onPointerDown={(e) => {
          e.preventDefault();
          void startListening();
        }}
        onPointerUp={() => void stopListening()}
        onPointerLeave={() => {
          if (isListening) void stopListening();
        }}
        onPointerCancel={() => {
          if (isListening) void stopListening();
        }}
        title="Hold to speak"
      >
        {isTranscribing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isListening ? (
          <MicOff className="w-4 h-4 animate-pulse" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="icon"
      variant={isListening ? 'destructive' : compact ? 'ghost' : 'outline'}
      className={`${sizeClass} touch-manipulation`}
      onMouseDown={() => void startListening()}
      onMouseUp={() => void stopListening()}
      onTouchStart={() => void startListening()}
      onTouchEnd={() => void stopListening()}
      title="Hold to speak"
    >
      {isListening ? <MicOff className="w-4 h-4 animate-pulse" /> : <Mic className="w-4 h-4" />}
    </Button>
  );
}
