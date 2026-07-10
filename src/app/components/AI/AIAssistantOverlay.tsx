import { Sparkles, X, PanelRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAIContextSync } from '../../hooks/useAIContext';
import { AIChatPanel } from './AIChatPanel';
import { useAIAssistant } from '../../context/AIAssistantContext';
import { Button } from '../ui/button';
import { integrationService } from '../../engine/integrations/integrationService';

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

  useEffect(() => {
    const openai = integrationService.getConfig('openai');
    const status = integrationService.getStatus('openai');
    setLiveAi(Boolean(openai.apiKey?.trim()) && status !== 'not_configured');
  }, []);

  return (
    <aside
      className={`relative bg-white/98 backdrop-blur-sm flex flex-col min-h-0 ${LAYOUT_WIDTH[layout]}`}
      aria-label="TradePro AI assistant"
    >
      <div className="shrink-0 p-3 border-b border-slate-200/60 flex items-center justify-between bg-slate-50/80 gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 min-w-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${liveAi ? 'bg-emerald-500' : 'bg-amber-400'}`}
            title={liveAi ? 'Live AI' : 'Demo AI mode'}
            aria-hidden
          />
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="truncate">TradePro AI</span>
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
