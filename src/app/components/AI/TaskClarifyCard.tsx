import { MessageCircleQuestion } from 'lucide-react';

interface TaskClarifyCardProps {
  taskSummary?: string;
  questions: string[];
  onProceed: () => void;
  onFocusComposer?: () => void;
}

export function TaskClarifyCard({
  taskSummary,
  questions,
  onProceed,
  onFocusComposer,
}: TaskClarifyCardProps) {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-xs space-y-2">
      <div className="flex items-start gap-2 text-slate-800">
        <MessageCircleQuestion className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-medium">Quick checks before I crack on</p>
          {taskSummary && (
            <p className="text-slate-600 mt-0.5 truncate" title={taskSummary}>
              {taskSummary}
            </p>
          )}
        </div>
      </div>
      <ol className="list-decimal list-inside space-y-1 text-slate-700 pl-1">
        {questions.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs"
          onClick={onFocusComposer}
        >
          Answer in chat
        </button>
        <button
          type="button"
          className="px-3 py-1 rounded-lg border border-slate-300 text-xs bg-white"
          onClick={onProceed}
        >
          Proceed with best judgment
        </button>
      </div>
    </div>
  );
}
