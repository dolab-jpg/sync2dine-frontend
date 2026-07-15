import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { toast } from 'sonner';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  /** @deprecated Native audio is transcribed via Whisper; kept for API compat. */
  onVoiceNote?: (dataUrl: string) => void;
}

/**
 * Mic control: native hold-to-record (+ Whisper) in the Flutter shell,
 * Web Speech API elsewhere.
 */
export function VoiceInputButton({ onTranscript }: VoiceInputButtonProps) {
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

  if (isNative) {
    return (
      <Button
        type="button"
        size="icon"
        variant={busy ? 'destructive' : 'outline'}
        disabled={isTranscribing}
        className="min-h-11 min-w-11 touch-manipulation"
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
      variant={isListening ? 'destructive' : 'outline'}
      className="min-h-11 min-w-11 touch-manipulation"
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
