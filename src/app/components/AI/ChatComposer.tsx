import { useRef, useEffect, type ReactNode } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { cn } from '../ui/utils';

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Left of the textarea (e.g. + attach menu). */
  leading?: ReactNode;
  /** Right of the textarea inside the pill (e.g. mic). */
  trailing?: ReactNode;
  /** Show the Enter/Shift+Enter hint under the row. Default false for cleaner UI. */
  showHint?: boolean;
}

export function ChatComposer({
  value,
  onChange,
  onSend,
  loading = false,
  disabled = false,
  placeholder = 'Type a message...',
  leading,
  trailing,
  showHint = false,
}: ChatComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const wasLoadingRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
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

  const canSend = !disabled && !loading && Boolean(value.trim());

  return (
    <div className="space-y-1">
      <div className="flex gap-2 items-end">
        <div
          className={cn(
            'flex-1 min-w-0 flex items-end gap-1 rounded-3xl border border-slate-200 bg-slate-50/80 px-1.5 py-1.5',
            'focus-within:border-slate-300 focus-within:ring-2 focus-within:ring-slate-200/80',
            disabled && 'opacity-60',
          )}
        >
          {leading ? <div className="shrink-0 self-end pb-0.5">{leading}</div> : null}
          <Textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={disabled}
            className={cn(
              'flex-1 min-h-[3.25rem] max-h-[12.5rem] resize-none border-0 bg-transparent shadow-none',
              'px-2 py-2.5 text-base md:text-base focus-visible:ring-0 focus-visible:border-transparent',
              'placeholder:text-slate-400',
            )}
            aria-label="Chat message"
            aria-busy={loading}
          />
          {trailing ? <div className="shrink-0 self-end pb-0.5">{trailing}</div> : null}
        </div>
        <Button
          type="button"
          size="icon"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onSend}
          disabled={!canSend}
          className="shrink-0 size-11 rounded-full"
          aria-label="Send message"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
      {showHint ? (
        <p className="text-[10px] text-slate-400 px-1">Enter to send · Shift+Enter for new line</p>
      ) : null}
    </div>
  );
}
