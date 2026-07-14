import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import type { UnifiedProject } from '../../engine/project/types';

interface TimelineEntry {
  id: string;
  at: string;
  source: string;
  label: string;
  body: string;
  kind: 'message' | 'other';
}

interface Props {
  project: UnifiedProject;
  onMessageClick?: () => void;
}

function isVisionAssessment(action: UnifiedProject['aiActions'][number]): boolean {
  if (/vision|assessment/i.test(action.action)) return true;
  const output = action.output as Record<string, unknown>;
  return Boolean(
    output.visionAssessment
    || output.assessment
    || output.analysis
  );
}

function summariseAiAction(action: UnifiedProject['aiActions'][number]): string {
  const output = action.output as Record<string, unknown>;
  const notes = [
    typeof output.summary === 'string' ? output.summary : undefined,
    typeof output.content === 'string' ? output.content : undefined,
    typeof output.assessment === 'string' ? output.assessment : undefined,
  ].filter((value): value is string => Boolean(value?.trim()));

  if (notes.length > 0) return notes[0];
  if (action.status === 'proposed') return 'Awaiting approval';
  return `Approved by ${action.approvedBy ?? 'staff'}`;
}

export function ProjectTimeline({ project, onMessageClick }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const entries: TimelineEntry[] = [];

  for (const msg of project.messages) {
    const channel = msg.channel ?? 'app';
    const contact = msg.senderContactName;
    const english = (msg as { bodyEnglish?: string }).bodyEnglish;
    const text = english ?? msg.body ?? (msg as { message?: string }).message ?? '';
    entries.push({
      id: msg.id,
      at: msg.timestamp,
      source: channel === 'whatsapp' ? 'WhatsApp' : channel === 'portal' ? 'Portal' : channel === 'email' ? 'Email' : 'App',
      label: contact && contact !== msg.from ? `${msg.from} (${contact})` : msg.from,
      body: text,
      kind: 'message',
    });
  }

  for (const action of project.aiActions) {
    const visionAssessment = isVisionAssessment(action);
    const output = action.output as Record<string, unknown>;
    const executed = Array.isArray(output.executed) ? output.executed.join('; ') : '';
    entries.push({
      id: action.id,
      at: action.createdAt,
      source: visionAssessment ? 'AI Vision' : 'AI',
      label: visionAssessment ? `Vision assessment · ${action.action}` : `Channel AI · ${action.action}`,
      body: executed || summariseAiAction(action),
      kind: 'other',
    });
  }

  for (const comm of project.contractorComms) {
    const trade = comm.contractorTradeName ?? comm.contractorTradeId;
    const source = trade ? `Contractor · ${trade}` : 'Contractor';
    entries.push({
      id: comm.id,
      at: comm.createdAt,
      source,
      label: comm.builderName,
      body: `${comm.subject}: ${comm.body}${comm.priceQuoted ? ` (£${comm.priceQuoted})` : ''}`,
      kind: 'other',
    });
  }

  for (const order of project.changeOrders ?? []) {
    entries.push({
      id: `${order.id}-created`,
      at: order.createdAt,
      source: 'Change order',
      label: order.title,
      body: `Proposed £${order.amount.toLocaleString('en-GB')} · ${order.status.replace('_', ' ')}`,
      kind: 'other',
    });

    if (order.customerDecisionAt) {
      entries.push({
        id: `${order.id}-decision`,
        at: order.customerDecisionAt,
        source: 'Change order',
        label: order.title,
        body: `Customer ${order.status.replace('_', ' ')}${order.customerDecisionBy ? ` by ${order.customerDecisionBy}` : ''}`,
        kind: 'other',
      });
    }
  }

  entries.sort((a, b) => b.at.localeCompare(a.at));

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm">Activity</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {entries.length === 0 ? (
          <p className="text-sm text-slate-500">
            No activity yet. Send a message above or copy the portal link to get started.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {entries.slice(0, 30).map(e => {
              const expanded = expandedId === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  className={`w-full text-left p-2 border rounded text-sm transition-colors hover:bg-slate-50 ${
                    expanded ? 'bg-slate-50 border-slate-300' : 'bg-white'
                  }`}
                  onClick={() => {
                    setExpandedId(expanded ? null : e.id);
                    if (e.kind === 'message') onMessageClick?.();
                  }}
                >
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant="outline" className="text-[10px]">{e.source}</Badge>
                    <span className="font-medium text-xs">{e.label}</span>
                    <span className="text-[10px] text-slate-400 ml-auto">
                      {new Date(e.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className={`text-xs text-slate-600 whitespace-pre-wrap ${expanded ? '' : 'line-clamp-2'}`}>
                    {e.body || '—'}
                  </p>
                  {!expanded && e.body.length > 120 && (
                    <span className="text-[10px] text-slate-400 mt-0.5 inline-block">Tap to expand</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
