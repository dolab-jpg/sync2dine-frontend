import { X, PanelRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAIContextSync } from '../../hooks/useAIContext';
import { AIChatPanel } from './AIChatPanel';
import { useAIAssistant } from '../../context/AIAssistantContext';
import { Button } from '../ui/button';
import { integrationService } from '../../engine/integrations/integrationService';
import { getCodeFixHealth, type CodeFixHealth } from '../../engine/ai/codeFixService';

interface AIAssistantPanelProps {
  onClose: () => void;
  onToggleDock?: () => void;
  docked?: boolean;
  layout?: 'inline' | 'floating' | 'sheet';
}

const LAYOUT_WIDTH: Record<NonNullable<AIAssistantPanelProps['layout']>, string> = {
  inline: 'h-full w-full sm:shrink-0 sm:w-72 md:w-80 sm:border-l border-slate-200/60',
  floating: 'h-full w-full sm:border-l border-slate-200/60',
  sheet: 'h-full w-full',
};

export function AIAssistantPanel({
  onClose,
  onToggleDock,
  docked = true,
  layout = 'inline',
}: AIAssistantPanelProps) {
  useAIContextSync();
  const { bcSessionActive } = useAIAssistant();
  const [liveAi, setLiveAi] = useState(true);
  const [selfHeal, setSelfHeal] = useState<CodeFixHealth | null>(null);

  useEffect(() => {
    const openai = integrationService.getConfig('openai');
    const status = integrationService.getStatus('openai');
    setLiveAi(Boolean(openai.apiKey?.trim()) && status !== 'not_configured');
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void getCodeFixHealth()
        .then((h) => {
          if (!cancelled) setSelfHeal(h);
        })
        .catch(() => {
          if (!cancelled) setSelfHeal(null);
        });
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const selfHealDot =
    selfHeal == null
      ? 'bg-slate-300'
      : selfHeal.live
        ? selfHeal.githubTokenConfigured
          ? 'bg-emerald-500'
          : 'bg-amber-400'
        : 'bg-red-500';
  const selfHealTitle = selfHeal?.reason ?? 'Self-heal status unknown';

  return (
    <aside
      className={`relative bg-white/98 backdrop-blur-sm flex flex-col min-h-0 ${LAYOUT_WIDTH[layout]}`}
      aria-label="TradePro AI assistant"
    >
      <div className="shrink-0 p-3 border-b border-slate-200/60 flex items-center justify-between bg-slate-50/80 gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 min-w-0">
          <img
            src="/cynthia-avatar.png"
            alt=""
            className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
          />
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${liveAi ? 'bg-emerald-500' : 'bg-amber-400'}`}
            title={liveAi ? 'Live AI' : 'Demo AI mode'}
            aria-hidden
          />
          <span className="truncate">TradePro AI</span>
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${selfHealDot}`}
            title={selfHealTitle}
            aria-label={selfHeal?.live ? 'Self-heal LIVE' : 'Self-heal not live'}
          />
          {selfHeal?.live && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-300 text-emerald-800 shrink-0">
              LIVE
            </span>
          )}
          {bcSessionActive && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-blue-300 text-blue-700 shrink-0">
              BC
            </span>
          )}
        </h2>
        <div className="flex items-center gap-1 shrink-0">
          {onToggleDock && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 hidden lg:inline-flex"
              onClick={onToggleDock}
              title={docked ? 'Undock panel' : 'Dock panel'}
              aria-label={docked ? 'Undock panel' : 'Dock panel'}
            >
              <PanelRight className={`w-4 h-4 ${docked ? 'text-amber-600' : 'text-slate-400'}`} />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
            title="Close assistant"
            aria-label="Close assistant"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <AIChatPanel />
      </div>
    </aside>
  );
}

/** @deprecated Use header toggle + AIAssistantPanel in AppShell */
export function AIAssistantFAB() {
  return null;
}
