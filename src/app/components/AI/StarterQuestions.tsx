import { getCommandsForRole } from '../../engine/ai/aiStudioStore';
import type { AgentRole } from '../../engine/ai/agentContext';
import { useAIStudioConfig } from '../../hooks/useAIStudioConfig';

interface StarterQuestionsProps {
  role: AgentRole;
  onSelect: (prompt: string) => void;
  visible?: boolean;
}

const BUILTIN: Partial<Record<AgentRole, { label: string; prompt: string }[]>> = {
  staff: [
    { label: 'Knock up a quote', prompt: 'I need a quote — help me gather details and a ballpark figure.' },
    { label: "What's on today?", prompt: 'What projects and quotes need attention today?' },
  ],
  manager: [
    { label: 'Knock up a quote', prompt: 'I need a quote — help me gather details and a ballpark figure.' },
    { label: 'Find a customer', prompt: 'Search for a customer by name or phone.' },
  ],
  super_admin: [
    { label: 'Knock up a quote', prompt: 'I need a quote — help me gather details and a ballpark figure.' },
    { label: 'Find a customer', prompt: 'Search for a customer by name or phone.' },
  ],
  customer: [
    { label: "When's my job starting?", prompt: "What's the status of my project?" },
    { label: 'Can I see my quote?', prompt: 'Can I see my latest quote?' },
    { label: 'Rough price for my job', prompt: 'I need a rough price — can you ask me a few questions?' },
  ],
  builder: [
    { label: "What's on today?", prompt: 'What tasks are due on site today?' },
  ],
};

export function StarterQuestions({ role, onSelect, visible = true }: StarterQuestionsProps) {
  const studioConfig = useAIStudioConfig();

  if (!visible) return null;

  if (!studioConfig.starterQuestionsEnabled) {
    return null;
  }

  const studioCommands = getCommandsForRole(role);
  const chips =
    studioCommands.length > 0
      ? studioCommands.map((c) => ({ label: c.label, prompt: c.prompt }))
      : (BUILTIN[role] ?? []);

  if (chips.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
      {chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          onClick={() => onSelect(chip.prompt)}
          className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
