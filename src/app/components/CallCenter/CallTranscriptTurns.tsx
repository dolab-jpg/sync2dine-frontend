import type { CallTurn } from '../../App';

type Props = {
  turns?: CallTurn[] | Array<{ role?: string; content?: string; timestamp?: string }> | null;
  agentLabel?: string;
  className?: string;
  maxHeightClass?: string;
};

function turnLabel(role: string | undefined, agentLabel: string): string {
  if (role === 'agent' || role === 'assistant') return agentLabel;
  if (role === 'system') return 'Agent action';
  return 'Caller';
}

function turnClass(role: string | undefined): string {
  if (role === 'agent' || role === 'assistant') return 'bg-amber-100 ml-4';
  if (role === 'system') return 'bg-violet-50 border border-violet-200 mx-2';
  return 'bg-white border mr-4';
}

/** Shared transcript renderer — speech + distinct Agent action (system/tool) rows. */
export default function CallTranscriptTurns({
  turns,
  agentLabel = 'Lizzie',
  className = '',
  maxHeightClass = 'max-h-[240px]',
}: Props) {
  const list = Array.isArray(turns) ? turns : [];
  if (list.length === 0) {
    return <p className={`text-sm text-slate-400 ${className}`}>No transcript yet.</p>;
  }
  return (
    <div className={`space-y-2 overflow-y-auto ${maxHeightClass} ${className}`} data-testid="call-transcript-turns">
      {list.map((turn, i) => {
        const role = String(turn.role ?? '');
        return (
          <div key={i} className={`p-2 rounded text-sm ${turnClass(role)}`}>
            <span className="text-xs text-slate-400">
              {turnLabel(role, agentLabel)}
              {turn.timestamp ? ` · ${new Date(turn.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}
              :{' '}
            </span>
            <span className={role === 'system' ? 'font-medium text-violet-950' : ''}>{turn.content}</span>
          </div>
        );
      })}
    </div>
  );
}
