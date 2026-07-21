import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { ArrowUp, Phone, Loader2 } from 'lucide-react';
import { SYNC2DINE_CONTACT } from '../../engine/messaging/saasQuoteContent';
import {
  applySallyCheckoutHandoff,
  type SallyCheckoutHandoff,
} from '../../engine/saas/sallyCheckoutHandoff';

const SESSION_KEY = 'sally_web_session';
const TEL_HREF = 'tel:+442037453233';

const SUGGESTIONS = [
  'How much is Judie?',
  'I want to sign up',
  'Call me now',
  'What’s Atmosphere?',
] as const;

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function getOrCreateSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = `web_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return `web_${Date.now()}`;
  }
}

type AskSync2DineHeroProps = {
  /** Compact when embedded mid-page */
  compact?: boolean;
};

export default function AskSync2DineHero({ compact = false }: AskSync2DineHeroProps) {
  const location = useLocation();
  const [sessionId] = useState(getOrCreateSessionId);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<SallyCheckoutHandoff | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const started = messages.length > 0;

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, pending]);

  async function sendText(raw: string) {
    const text = raw.trim();
    if (!text || pending) return;
    setError(null);
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setPending(true);
    try {
      const res = await fetch('/api/sally/web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          text,
          page: location.pathname,
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        error?: string;
        messages?: ChatMessage[];
        checkoutHandoff?: SallyCheckoutHandoff;
        sessionId?: string;
      };
      if (!res.ok) {
        setError(data.error || 'Chat is unavailable right now.');
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.error || 'Sorry — I could not reply just now. Call us on 020 3745 3233 anytime.' },
        ]);
        return;
      }
      if (data.sessionId) {
        try {
          localStorage.setItem(SESSION_KEY, data.sessionId);
        } catch {
          /* ignore */
        }
      }
      if (data.checkoutHandoff) {
        setHandoff(data.checkoutHandoff);
        applySallyCheckoutHandoff(data.checkoutHandoff);
      }
      const reply = (data.reply || '').trim();
      if (Array.isArray(data.messages) && data.messages.length) {
        setMessages(
          data.messages
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        );
      } else if (reply) {
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      }
    } catch {
      setError('Could not reach Sync2Dine.');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'I could not reach the office just now — call 020 3745 3233 and we will help you 24/7.',
        },
      ]);
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void sendText(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendText(input);
    }
  }

  const startHref = handoff?.startPath || '/start';

  return (
    <section
      id="ask"
      className={`relative overflow-hidden ${compact ? 'py-8' : 'min-h-[min(88vh,920px)] py-12 sm:py-16'}`}
      data-testid="ask-sync2dine-hero"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(13,148,136,0.18), transparent 55%), radial-gradient(ellipse 50% 40% at 100% 80%, rgba(15,61,62,0.08), transparent), linear-gradient(180deg, #f7f3ea 0%, #eef6f4 45%, #f7f3ea 100%)',
        }}
      />
      <div className="relative mx-auto flex max-w-3xl flex-col px-4">
        <div className={`text-center ${started ? 'mb-6' : 'mb-10 sm:mb-12'}`}>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-s2d-teal">Sync2Dine</p>
          <h1
            className={`mt-3 font-black tracking-tight text-s2d-teal-deep ${
              started ? 'text-2xl sm:text-3xl' : 'text-4xl sm:text-5xl'
            }`}
          >
            Ask Sync2Dine
          </h1>
          {!started ? (
            <p className="mx-auto mt-4 max-w-xl text-base text-slate-600 sm:text-lg">
              Your AI guide for Judie, Atmosphere, pricing, and signing up — or call us anytime.
            </p>
          ) : null}
        </div>

        {started ? (
          <div
            ref={listRef}
            className="mb-4 max-h-[min(42vh,420px)] space-y-3 overflow-y-auto rounded-2xl border border-s2d-teal/10 bg-white/70 p-4 shadow-sm backdrop-blur-sm"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}-${m.content.slice(0, 12)}`}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-s2d-teal-deep text-white'
                      : 'border border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {pending ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Thinking…
              </div>
            ) : null}
          </div>
        ) : null}

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-s2d-teal/15 bg-white/90 p-2 shadow-[0_12px_40px_-12px_rgba(15,61,62,0.25)] backdrop-blur-sm transition-shadow focus-within:shadow-[0_16px_48px_-12px_rgba(13,148,136,0.35)]"
        >
          <label htmlFor="ask-sync2dine-input" className="sr-only">
            Ask Sync2Dine
          </label>
          <textarea
            id="ask-sync2dine-input"
            ref={inputRef}
            rows={started ? 2 : 3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={pending}
            placeholder="Ask about Judie, pricing, or getting set up…"
            className="w-full resize-none bg-transparent px-3 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60"
          />
          <div className="flex items-center justify-between gap-2 px-1 pb-1">
            <p className="hidden text-xs text-slate-400 sm:block">Enter to send · Shift+Enter for a new line</p>
            <button
              type="submit"
              disabled={pending || !input.trim()}
              className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-s2d-teal-deep text-white transition enabled:hover:bg-teal-800 disabled:opacity-40"
              aria-label="Send message"
            >
              {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
            </button>
          </div>
        </form>

        {!started ? (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {SUGGESTIONS.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (label === 'Call me now') {
                    window.location.href = TEL_HREF;
                    void sendText('I would like to call you now — what is the best number?');
                    return;
                  }
                  void sendText(label);
                }}
                className="min-h-11 rounded-full border border-s2d-teal/20 bg-white/80 px-4 text-sm font-medium text-s2d-teal-deep transition hover:border-s2d-teal/40 hover:bg-white"
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {error ? <p className="mt-3 text-center text-sm text-red-600">{error}</p> : null}

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a
            href={TEL_HREF}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-s2d-teal-deep px-5 text-sm font-bold text-white transition hover:bg-teal-800"
          >
            <Phone className="h-4 w-4" aria-hidden />
            Call {SYNC2DINE_CONTACT.phone} · 24/7
          </a>
          <Link
            to={startHref}
            onClick={() => {
              if (handoff) applySallyCheckoutHandoff(handoff);
            }}
            className="inline-flex min-h-11 items-center rounded-xl border border-s2d-teal/25 bg-white/90 px-5 text-sm font-semibold text-s2d-teal-deep transition hover:bg-white"
          >
            Start checkout
          </Link>
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">
          Landline answered by our AI sales team around the clock — {SYNC2DINE_CONTACT.phone}
        </p>
      </div>
    </section>
  );
}
