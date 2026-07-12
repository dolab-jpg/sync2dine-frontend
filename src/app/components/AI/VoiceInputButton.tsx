import { Mic, MicOff } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/button';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import {
  isNativeBridgeAvailable,
  nativeStartVoice,
  nativeStopVoice,
} from '../../bridge/nativeBridge';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  /** When native returns audio, parent can transcribe or attach the clip. */
  onVoiceNote?: (dataUrl: string) => void;
}

export function VoiceInputButton({ onTranscript, onVoiceNote }: VoiceInputButtonProps) {
  const { isListening, startListening, stopListening, isSupported } = useVoiceInput(onTranscript);
  const [nativeRecording, setNativeRecording] = useState(false);
  const nativeAvailable = isNativeBridgeAvailable();

  const handleNativeStart = async () => {
    const result = await nativeStartVoice();
    if (result?.ok) setNativeRecording(true);
  };

  const handleNativeStop = async () => {
    const result = await nativeStopVoice();
    setNativeRecording(false);
    if (result?.ok && result.dataUrl) {
      onVoiceNote?.(result.dataUrl);
    }
  };

  if (nativeAvailable) {
    return (
      <Button
        type="button"
        size="icon"
        variant={nativeRecording ? 'destructive' : 'outline'}
        className="min-h-11 min-w-11 touch-manipulation"
        onMouseDown={() => void handleNativeStart()}
        onMouseUp={() => void handleNativeStop()}
        onTouchStart={() => void handleNativeStart()}
        onTouchEnd={() => void handleNativeStop()}
        title="Hold to record voice note"
      >
        {nativeRecording ? <MicOff className="w-4 h-4 animate-pulse" /> : <Mic className="w-4 h-4" />}
      </Button>
    );
  }

  if (!isSupported) return null;

  return (
    <Button
      type="button"
      size="icon"
      variant={isListening ? 'destructive' : 'outline'}
      className="min-h-11 min-w-11 touch-manipulation"
      onMouseDown={startListening}
      onMouseUp={stopListening}
      onTouchStart={startListening}
      onTouchEnd={stopListening}
      title="Hold to speak"
    >
      {isListening ? <MicOff className="w-4 h-4 animate-pulse" /> : <Mic className="w-4 h-4" />}
    </Button>
  );
}
