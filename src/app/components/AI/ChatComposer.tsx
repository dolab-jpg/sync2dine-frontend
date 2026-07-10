import { useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatComposer({
  value,
  onChange,
  onSend,
  loading = false,
  disabled = false,
  placeholder = 'Type a message...',
}: ChatComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const wasLoadingRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  // Refocus after AI finishes so clients can keep the conversation going.
  useEffect(() => {
    if (wasLoadingRef.current && !loading) {
      requestAnimationFrame(() => ref.current?.focus());
    }
    wasLoadingRef.current = loading;
  }, [loading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !loading && !disabled) onSend();
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (value.trim() && !loading && !disabled) onSend();
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex gap-2 items-end">
        <Textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          className="flex-1 min-h-[2.5rem] max-h-[7.5rem] resize-none text-sm"
          aria-label="Chat message"
          aria-busy={loading}
        />
        <Button
          type="button"
          size="icon"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onSend}
          disabled={disabled || loading || !value.trim()}
          className="shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
      <p className="text-[10px] text-slate-400 px-1">Enter to send · Shift+Enter for new line</p>
    </div>
  );
}
