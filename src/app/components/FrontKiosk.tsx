import { useContext, useState } from 'react';
import { Mic, MicOff, ReceiptText, Sparkles } from 'lucide-react';
import { AppContext } from '../App';
import { useCynthiaVapiVoice } from '../hooks/useCynthiaVapiVoice';
import { Button } from './ui/button';
import { BrandLogo } from './BrandLogo';

export default function FrontKiosk() {
  const context = useContext(AppContext);
  const userId = context?.user?.id ?? 'kiosk-device';
  const [lines, setLines] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  const voice = useCynthiaVapiVoice({
    userId,
    onTranscript: (role, text) => setLines((prev) => [...prev.slice(-5), { role, text }]),
  });

  const active = voice.isActive;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fff8df_0,#f6efe0_32%,#0f3d3e_100%)] text-slate-950">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6">
        <div className="flex items-center justify-between">
          <BrandLogo size="lg" subtitle="AI phone & ordering" />
          <div className="rounded-full bg-white/75 px-4 py-2 text-sm font-semibold text-s2d-teal-deep shadow-sm">
            Kiosk mode
          </div>
        </div>

        <div className="grid flex-1 place-items-center py-6">
          {/* Portrait: stacked. Landscape tablet: avatar left, controls right. */}
          <div className="grid w-full max-w-3xl gap-6 rounded-[2rem] bg-white/88 p-6 shadow-2xl shadow-s2d-teal-ink/20 sm:p-8 landscape:lg:max-w-5xl landscape:lg:grid-cols-2 landscape:lg:items-center">
            <div className="mx-auto flex w-full max-w-[46vh] flex-col items-center landscape:lg:max-w-full">
              <div
                className={`relative mx-auto aspect-square w-full max-h-[40vh] max-w-[40vh] overflow-hidden rounded-full bg-gradient-to-br from-s2d-teal-deep via-s2d-teal to-s2d-gold p-1.5 shadow-inner landscape:lg:max-h-[52vh] ${
                  active ? 'ring-4 ring-s2d-gold ring-offset-4 ring-offset-transparent' : ''
                }`}
              >
                <img
                  src="/lizzie-avatar.png"
                  alt="Lizzie, your Sync2Dine host"
                  className="h-full w-full rounded-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                {active && (
                  <span className="absolute bottom-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-s2d-gold shadow-lg">
                    <Sparkles className="h-4 w-4 animate-pulse text-s2d-teal-deep" />
                  </span>
                )}
              </div>
              <p className="mt-4 text-4xl font-black tracking-tight text-s2d-teal-deep sm:text-5xl">Lizzie</p>
              <p className="mt-1 max-w-xs text-center text-lg text-slate-700">
                {active ? 'Listening for your order' : 'Tap to speak to the Sync2Dine avatar'}
              </p>
            </div>

            <div>
              <div className="flex flex-col items-center gap-4">
                <Button
                  type="button"
                  size="lg"
                  onClick={() => void voice.toggle()}
                  className="min-h-[64px] w-full max-w-sm rounded-2xl bg-s2d-teal-deep text-xl font-bold text-white hover:bg-s2d-teal"
                >
                  {active ? <MicOff className="mr-3 h-6 w-6" /> : <Mic className="mr-3 h-6 w-6" />}
                  {active ? 'End conversation' : 'Start order'}
                </Button>
                {voice.error && <p className="text-center text-sm font-medium text-red-700">{voice.error}</p>}
                <p className="text-center text-base text-slate-700">
                  Lizzie can take your order, switch language, and give you an order number. Pay at the desk when called.
                </p>
              </div>

              <div className="mt-6 rounded-2xl border border-s2d-teal/10 bg-s2d-cream-bright/80 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-s2d-teal-deep">
                  <ReceiptText className="h-4 w-4" />
                  Conversation
                </div>
                <div className="space-y-2 text-sm text-slate-800">
                  {lines.length === 0 ? (
                    <p>Speak when you are ready. Lizzie will repeat the order before sending it to the kitchen.</p>
                  ) : (
                    lines.map((line, idx) => (
                      <p key={`${line.role}-${idx}`}>
                        <span className="font-semibold">{line.role === 'assistant' ? 'Lizzie' : 'You'}:</span> {line.text}
                      </p>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
