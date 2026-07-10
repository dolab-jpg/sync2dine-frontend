import { Button } from '../ui/button';
import { Check, X } from 'lucide-react';
import { getHumanActionLabel } from '../../engine/ai/actionPolicy';
import type { AIActionLog } from '../../engine/project/types';

interface ProjectActionStripProps {
  actions: AIActionLog[];
  onApply: (actionId: string) => void;
  onDismiss: (actionId: string) => void;
}

export function ProjectActionStrip({ actions, onApply, onDismiss }: ProjectActionStripProps) {
  if (actions.length === 0) return null;

  const primary = actions[0];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
      <p className="flex-1 text-slate-700 text-xs">{getHumanActionLabel(primary.action)}</p>
      <div className="flex gap-2 shrink-0">
        <Button
          type="button"
          size="sm"
          className="h-8 text-xs"
          onClick={() => onApply(primary.id)}
        >
          <Check className="w-3 h-3 mr-1" /> Apply
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 text-xs"
          onClick={() => onDismiss(primary.id)}
        >
          <X className="w-3 h-3 mr-1" /> Dismiss
        </Button>
      </div>
    </div>
  );
}
