import { useContext, useState } from 'react';
import { ChatComposer } from '../AI/ChatComposer';
import { ChatMarkdown } from '../AI/ChatMarkdown';
import { ToolResultPanel } from '../AI/ToolResultPanel';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Bot } from 'lucide-react';
import type { UnifiedProject } from '../../engine/project/types';
import { sendProjectAIMessage } from '../../engine/projectAi/projectAiService';
import { getProject } from '../../engine/project/projectStore';
import { useGestureToggle } from '../../hooks/useGestureToggle';
import { GestureEdgeHint } from '../ui/GestureHint';
import { useAIStudioConfig } from '../../hooks/useAIStudioConfig';
import { getHumanActionLabel } from '../../engine/ai/actionPolicy';
import type { CopilotAction } from '../../engine/ai/orchestratorService';
import { logConversationMessage } from '../../engine/ai/conversationLogService';
import { AppContext } from '../../App';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';
import {
  processToolActions,
  executeSafetyAction,
  type ToolExecutionResult,
  type ToolRuntimeContext,
} from '../../engine/ai/toolRuntime';

interface Props {
  project: UnifiedProject;
  userName: string;
  onUpdate: (project: UnifiedProject) => void;
}

export function ProjectAIPanel({ project, userName, onUpdate }: Props) {
  const app = useContext(AppContext);
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [toolResults, setToolResults] = useState<ToolExecutionResult[]>([]);
  const [safetyPending, setSafetyPending] = useState<CopilotAction[]>([]);
  const chat = useGestureToggle({ defaultOpen: true, storageKey: `projectAiOpen_${project.id}` });
  const studio = useAIStudioConfig();

  const staffRole = (app?.user.role ?? 'staff') as Parameters<typeof processToolActions>[2] extends { role: infer R } ? R : 'staff';

  const buildRuntimeContext = (): ToolRuntimeContext => ({
    app,
    navigate,
    projectId: project.id,
    tradeId: null,
    approvedBy: userName,
    quoteHandlers: {
      setPendingQuoteFields: () => {},
      setLastAcceptedFields: () => {},
      navigate,
    },
  });

  const logMessage = (role: 'user' | 'assistant', content: string) => {
    if (!app) return;
    void logConversationMessage({
      userId: app.user.id,
      userName: app.user.name,
      role: staffRole,
      scope: `project:${project.id}`,
      route: `/projects/${project.id}`,
      role_message: role,
      content,
    });
  };

  const runTools = async (actions: CopilotAction[]) => {
    const enriched = actions.map((action) => ({
      ...action,
      output: {
        ...action.output,
        projectId: action.output.projectId ?? project.id,
      },
    }));
    const result = await processToolActions(enriched, buildRuntimeContext(), {
      role: staffRole,
      requireConfirmCustomerMessages: studio.requireConfirmCustomerMessages,
    });
    if (result.executed.length > 0) {
      setToolResults(result.executed);
      onUpdate(getProject(project.id)!);
    }
    if (result.pendingSafety.length > 0) setSafetyPending(result.pendingSafety);
    result.summaries.forEach((s) => toast.success(s, { duration: 3500 }));
  };

  const approveSafetyAction = async (action: CopilotAction, index: number) => {
    const execResult = await executeSafetyAction(
      { ...action, output: { ...action.output, projectId: project.id } },
      buildRuntimeContext()
    );
    setToolResults((prev) => [...prev, execResult]);
    onUpdate(getProject(project.id)!);
    toast.success(execResult.summary);
    setSafetyPending((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setToolResults([]);
    setSafetyPending([]);
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    logMessage('user', userMsg);
    setLoading(true);
    const res = await sendProjectAIMessage(project, userMsg, messages);
    setMessages((prev) => [...prev, { role: 'assistant', content: res.content }]);
    logMessage('assistant', res.content);
    const allActions = [...(res.autoActions ?? []), ...(res.proposedActions ?? [])];
    if (allActions.length) await runTools(allActions);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div
        {...chat.railGestureProps}
        className="relative rounded-xl border border-slate-200/70 bg-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] touch-manipulation overflow-hidden"
        title="Double-tap or swipe to expand chat"
      >
        <GestureEdgeHint side="right" />
        <Card className="border-0 shadow-none">
          <CardHeader
            className={`pb-2 transition-all duration-300 ${chat.isOpen ? '' : 'py-3'}`}
            onDoubleClick={chat.onDoubleClick}
          >
            <CardTitle className="text-base flex items-center gap-2 text-slate-800">
              <Bot className="w-4 h-4 text-amber-500" />
              ProjectBrain AI
              {!chat.isOpen && (
                <span className="text-xs font-normal text-slate-400 ml-1">— double-tap to open</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent
            className={`space-y-3 transition-all duration-300 ${
              chat.isOpen ? 'opacity-100 max-h-[32rem]' : 'opacity-0 max-h-0 overflow-hidden p-0'
            }`}
          >
            <div className="max-h-48 overflow-y-auto space-y-2 text-sm">
              {messages.length === 0 && (
                <p className="text-slate-500">
                  Ask naturally — payment plans, schedules, invoices, or site updates.
                </p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`p-2 rounded-lg ${
                    m.role === 'user' ? 'bg-blue-50/80 ml-4' : 'bg-slate-50/80 mr-4'
                  }`}
                >
                  {m.role === 'assistant' ? <ChatMarkdown content={m.content} /> : m.content}
                </div>
              ))}
            </div>
            {toolResults.length > 0 && (
              <ToolResultPanel results={toolResults} onOpen={(route) => navigate(route)} />
            )}
            {safetyPending.map((action, index) => (
              <div key={`${action.action}-${index}`} className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs">
                <p className="mb-2">{getHumanActionLabel(action.action)}</p>
                <div className="flex gap-2">
                  <button type="button" className="px-2 py-1 rounded bg-amber-600 text-white" onClick={() => void approveSafetyAction(action, index)}>Confirm</button>
                  <button type="button" className="px-2 py-1 rounded border" onClick={() => setSafetyPending((p) => p.filter((_, i) => i !== index))}>Dismiss</button>
                </div>
              </div>
            ))}
            <ChatComposer
              value={input}
              onChange={setInput}
              onSend={handleSend}
              loading={loading}
              placeholder="e.g. Set payment plan 10/40/30/20"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
