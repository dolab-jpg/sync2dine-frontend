import { Button } from '../ui/button';
import { ExternalLink, CheckCircle2 } from 'lucide-react';
import type { ToolExecutionResult } from '../../engine/ai/toolRuntime';

interface ToolResultPanelProps {
  results: ToolExecutionResult[];
  onOpen?: (route: string) => void;
}

function renderBreakdown(output: Record<string, unknown>) {
  const items = output.items ?? output.lineItems;
  const labour = output.labour;
  const extras = output.extras;
  const stages = output.stages;
  const tasks = output.tasks;

  if (Array.isArray(stages) && stages.length > 0) {
    return (
      <table className="w-full text-xs mt-2 border-collapse">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-1 pr-2">Stage</th>
            <th className="py-1 pr-2">%</th>
            <th className="py-1">Notes</th>
          </tr>
        </thead>
        <tbody>
          {(stages as Array<Record<string, unknown>>).map((s, i) => (
            <tr key={i} className="border-b border-slate-100">
              <td className="py-1 pr-2">{String(s.name ?? '—')}</td>
              <td className="py-1 pr-2">{String(s.percentage ?? '—')}%</td>
              <td className="py-1 text-slate-600">{String(s.notes ?? '')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (Array.isArray(tasks) && tasks.length > 0) {
    return (
      <ul className="mt-2 space-y-1 text-xs text-slate-700 list-disc pl-4">
        {(tasks as Array<Record<string, unknown>>).map((t, i) => (
          <li key={i}>{String(t.title ?? t.name ?? 'Task')}</li>
        ))}
      </ul>
    );
  }

  const rows: Array<{ label: string; amount: string }> = [];
  if (Array.isArray(items)) {
    for (const item of items as Array<Record<string, unknown>>) {
      rows.push({
        label: String(item.name ?? item.description ?? 'Item'),
        amount: `£${Number(item.total ?? item.price ?? 0).toLocaleString('en-GB')}`,
      });
    }
  }
  if (Array.isArray(labour)) {
    for (const item of labour as Array<Record<string, unknown>>) {
      rows.push({
        label: String(item.description ?? 'Labour'),
        amount: `£${Number(item.total ?? item.rate ?? 0).toLocaleString('en-GB')}`,
      });
    }
  }
  if (Array.isArray(extras)) {
    for (const item of extras as Array<Record<string, unknown>>) {
      rows.push({
        label: String(item.description ?? 'Extra'),
        amount: `£${Number(item.price ?? 0).toLocaleString('en-GB')}`,
      });
    }
  }
  if (output.total !== undefined) {
    rows.push({
      label: 'Total',
      amount: `£${Number(output.total).toLocaleString('en-GB')}`,
    });
  }

  if (rows.length === 0) return null;

  return (
    <table className="w-full text-xs mt-2 border-collapse">
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className={row.label === 'Total' ? 'font-semibold border-t border-slate-200' : 'border-b border-slate-100'}>
            <td className="py-1 pr-2">{row.label}</td>
            <td className="py-1 text-right">{row.amount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ToolResultPanel({ results, onOpen }: ToolResultPanelProps) {
  const meaningful = results.filter((r) => r.summary);
  if (meaningful.length === 0) return null;

  return (
    <div className="space-y-2">
      {meaningful.map((result, index) => (
        <div
          key={`${result.action}-${index}`}
          className={`rounded-xl border p-3 text-xs text-slate-800 ${
            result.executed
              ? 'border-emerald-200 bg-emerald-50/80'
              : 'border-red-200 bg-red-50/80'
          }`}
        >
          <div className="flex items-start gap-2">
            <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${result.executed ? 'text-emerald-600' : 'text-red-500'}`} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-800">{result.summary}</p>
              {result.entityLabel && (
                <p className="text-slate-600 mt-0.5">{result.entityLabel}</p>
              )}
              {renderBreakdown(result.output)}
            </div>
            {result.openRoute && result.executed && onOpen && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs shrink-0"
                onClick={() => onOpen(result.openRoute!)}
              >
                <ExternalLink className="w-3 h-3 mr-1" /> Open
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
