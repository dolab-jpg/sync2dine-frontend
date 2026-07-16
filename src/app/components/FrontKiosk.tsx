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
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-6">
        <div className="flex items-center justify-between">
          <BrandLogo size="lg" subtitle="AI phone & ordering" />
          <div className="rounded-full bg-white/75 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-sm">
            Kiosk mode
          </div>
        </div>

        <div className="grid flex-1 place-items-center py-8">
          <div className="w-full max-w-3xl rounded-[2rem] bg-white/88 p-6 shadow-2xl shadow-emerald-950/20 sm:p-8">
            <div className="mx-auto flex aspect-square max-h-[46vh] max-w-[46vh] items-center justify-center rounded-full bg-gradient-to-br from-emerald-950 via-teal-800 to-amber-300 p-5 shadow-inner">
              <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#102f30] text-center text-white">
                <Sparkles className={`mb-4 h-14 w-14 ${active ? 'animate-pulse text-amber-200' : 'text-amber-300'}`} />
                <p className="text-5xl font-black tracking-tight sm:text-6xl">Lizzie</p>
                <p className="mt-3 max-w-xs text-lg text-amber-100">
                  {active ? 'Listening for your order' : 'Tap to speak to the Sync2Dine avatar'}
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col items-center gap-4">
              <Button
                type="button"
                size="lg"
                onClick={() => void voice.toggle()}
                className="min-h-[64px] w-full max-w-sm rounded-2xl bg-emerald-950 text-xl font-bold text-white hover:bg-emerald-900"
              >
                {active ? <MicOff className="mr-3 h-6 w-6" /> : <Mic className="mr-3 h-6 w-6" />}
                {active ? 'End conversation' : 'Start order'}
              </Button>
              {voice.error && <p className="text-center text-sm font-medium text-red-700">{voice.error}</p>}
              <p className="text-center text-base text-slate-700">
                Lizzie can take your order, switch language, and give you an order number. Pay at the desk when called.
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-emerald-900/10 bg-emerald-50/80 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-emerald-900">
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
      </section>
    </main>
  );
}
