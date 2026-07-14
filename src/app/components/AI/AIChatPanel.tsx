import { useState, useContext, useMemo, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Loader2, AlertCircle, Headphones, Square, Mic } from 'lucide-react';
import { useAIAssistant } from '../../context/AIAssistantContext';
import { VoiceInputButton } from './VoiceInputButton';
import { useVoiceConversation } from '../../hooks/useVoiceConversation';
import { PhotoCapture } from './PhotoCapture';
import { estimateFromPhotos, type EstimationResult } from '../../engine/aiEstimationService';
import { AIReviewPanel } from './AIReviewPanel';
import { TradeChips } from './TradeChips';
import { ChatComposer } from './ChatComposer';
import { StarterQuestions } from './StarterQuestions';
import { ToolResultPanel } from './ToolResultPanel';
import { ChatMarkdown } from './ChatMarkdown';
import type { TradeId, WizardAnswers } from '../../config/types';
import { isValidTradeId, getTrade } from '../../config/trades';
import { useNavigate } from 'react-router';
import { AppContext } from '../../App';
import { useResolvedTrade } from '../../hooks/useResolvedTrade';
import { toast } from 'sonner';
import { buildAgentContext, getAgentScope } from '../../engine/ai/agentContext';
import { sendOrchestratorMessage, type CopilotAction } from '../../engine/ai/orchestratorService';
import { isWriteToolBlockedInClarify } from '../../engine/ai/actionPolicy';
import { TaskClarifyCard } from './TaskClarifyCard';
import {
  checkOpenAIConnection,
  connectionFromOrchestratorError,
  type OpenAIConnectionState,
} from '../../engine/ai/openaiConnectionService';
import { getProject, loadProjects } from '../../engine/project/projectStore';
import { loadBuilders } from '../../engine/builder/builderStore';
import { getOfficeTeamCounts, getOfficeTeamRoster } from '../../engine/team/teamSnapshot';
import { buildLeadPipelineSnapshot } from '../../engine/leads/leadService';
import { integrationService } from '../../engine/integrations/integrationService';
import { blockedActionMessage } from '../../engine/ai/rolePermissions';
import { useAIStudioConfig } from '../../hooks/useAIStudioConfig';
import {
  processToolActions,
  executeSafetyAction,
  type ToolExecutionResult,
  type ToolRuntimeContext,
} from '../../engine/ai/toolRuntime';
import { getHumanActionLabel } from '../../engine/ai/actionPolicy';
import { buildScopedDataContext } from '../../engine/ai/dataPolicy';
import { buildRawDataSnapshot } from '../../engine/ai/dataAccess';
import { logConversationMessage } from '../../engine/ai/conversationLogService';
import { getPlanningApplication } from '../../engine/planning/planningStore';
import { buildPlanningOrchestratorContext } from '../../engine/planning/planningAiService';

export function AIChatPanel() {
  const app = useContext(AppContext);
  const {
    isOpen,
    preferVoiceOnOpen, clearPreferVoiceOnOpen,
    messages, addMessage, settings, pageContext,
    setPendingQuoteFields, setLastAcceptedFields,
    detectedTrades, setDetectedTrades,
    setActiveTradeId,
    aiDetectedTrade, setAiDetectedTrade,
    setJobGroupId,
    pendingTask, setPendingTask, clearPendingTask,
  } = useAIAssistant();
  const { tradeId, tradeName, setTradeOverride } = useResolvedTrade();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [estimation, setEstimation] = useState<EstimationResult | null>(null);
  const [toolResults, setToolResults] = useState<ToolExecutionResult[]>([]);
  const [safetyPending, setSafetyPending] = useState<CopilotAction[]>([]);
  const [connection, setConnection] = useState<OpenAIConnectionState>({ status: 'checking' });
  const scrollRef = useRef<HTMLDivElement>(null);
  const voiceNoteRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();
  const studio = useAIStudioConfig();

  const agentContext = useMemo(() => buildAgentContext(pageContext), [pageContext]);
  const scope = useMemo(() => getAgentScope(agentContext), [agentContext]);

  const staffContext = useMemo(() => ({
    route: String(pageContext.route ?? ''),
    tradeId: tradeId ?? null,
    customerId: pageContext.customerId ? String(pageContext.customerId) : null,
    userName: String(pageContext.userName ?? app?.user.name ?? 'User'),
    userId: String(pageContext.userId ?? app?.user.id ?? ''),
    customers: app?.customers.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      interestedTrades: c.interestedTrades,
      status: c.status,
      source: c.source,
      leadScore: c.leadScore,
      nextFollowUp: c.nextFollowUp,
      budget: c.budget,
      notes: c.notes,
    })),
    quotes: app?.quotes.map(q => ({
      id: q.id,
      customerId: q.customerId,
      customerName: q.customerName,
      tradeId: q.tradeId,
      tradeName: q.tradeName,
      total: q.total,
      status: q.status,
    })),
  }), [pageContext, tradeId, app?.customers, app?.quotes, app?.user]);

  const sessionId = staffContext.userId || 'default-session';
  const syncConversation = useCallback((role: string, content: string) => {
    void fetch(`/api/conversations/default/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, content, channel: 'app' }),
    }).catch(() => undefined);
  }, [sessionId]);

  const businessSnapshot = useMemo(() => {
    const office = getOfficeTeamCounts();
    const isManager = agentContext.role === 'super_admin' || agentContext.role === 'manager';
    const customers = app?.customers ?? [];
    return {
      customerCount: customers.length,
      quoteCount: app?.quotes.length ?? 0,
      projectCount: loadProjects().length,
      builderCount: loadBuilders().length,
      officeStaffCount: office.officeStaffCount,
      managerCount: office.managerCount,
      salesStaffCount: office.salesStaffCount,
      recentCustomerNames: customers.slice(0, 8).map((c) => c.name),
      recentQuoteSummaries: app?.quotes.slice(0, 5).map(
        (q) => `${q.customerName} — ${q.tradeName ?? q.tradeId ?? 'trade'} £${q.total} (${q.status})`
      ),
      ...(isManager ? {
        officeTeamRoster: getOfficeTeamRoster(),
        leadPipeline: buildLeadPipelineSnapshot(customers),
      } : {}),
    };
  }, [app?.customers, app?.quotes, agentContext.role]);

  const isChatConnected = connection.status === 'connected';

  const rolePrompt = useMemo(() => {
    if (agentContext.role === 'builder') return 'Ask about tasks, milestones, or site comms...';
    if (agentContext.role === 'customer') return 'Ask for updates, quotes, or a rough price...';
    if (agentContext.projectId) return 'Ask about schedules, contracts, or customer updates...';
    return 'Describe the job or ask for quote help...';
  }, [agentContext.role, agentContext.projectId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, toolResults, safetyPending, pendingTask]);

  const refreshConnection = useCallback(async () => {
    setConnection({ status: 'checking' });
    const next = await checkOpenAIConnection({ role: agentContext.role });
    setConnection(next);
    return next;
  }, [agentContext.role]);

  useEffect(() => {
    void refreshConnection();
    return integrationService.subscribe(() => {
      void refreshConnection();
    });
  }, [refreshConnection]);

  const logMsg = (role: 'user' | 'assistant', content: string) => {
    void logConversationMessage({
      userId: String(pageContext.userId ?? app?.user.id ?? 'unknown'),
      userName: String(pageContext.userName ?? app?.user.name ?? 'User'),
      role: agentContext.role,
      scope,
      route: agentContext.route,
      role_message: role,
      content,
    });
  };

  const resolveCustomerId = useCallback((): string => {
    if (agentContext.role === 'customer' && app) {
      const match = app.customers.find(
        (c) => c.id === app.user.id || c.email === app.user.email
      );
      return match?.id ?? String(pageContext.customerId ?? app.user.id);
    }
    return String(pageContext.customerId ?? '');
  }, [agentContext.role, app, pageContext.customerId]);

  const dataContext = useMemo(() => {
    if (!app) return {};
    const raw = buildRawDataSnapshot(app);
    return buildScopedDataContext(raw, {
      role: agentContext.role,
      userId: staffContext.userId,
      customerId: resolveCustomerId() || agentContext.customerId,
      builderId: agentContext.builderId ?? staffContext.userId,
      projectId: agentContext.projectId,
    });
  }, [app, agentContext, staffContext.userId, resolveCustomerId]);

  const buildRuntimeContext = useCallback((): ToolRuntimeContext => ({
    app,
    navigate,
    projectId: agentContext.projectId,
    planningApplicationId: agentContext.planningApplicationId,
    tradeId: tradeId ?? null,
    approvedBy: app?.user.name ?? 'TradePro AI',
    role: agentContext.role,
    userId: staffContext.userId,
    customerId: resolveCustomerId() || agentContext.customerId,
    builderId: agentContext.builderId ?? staffContext.userId,
    quoteHandlers: {
      setPendingQuoteFields: (fields) => setPendingQuoteFields(fields as WizardAnswers),
      setLastAcceptedFields,
      setJobGroupId,
      setActiveTradeId,
      navigate,
    },
    onDetectedTrades: (trades) => {
      setDetectedTrades(trades);
      setAiDetectedTrade(true);
      setActiveTradeId(trades[0]?.tradeId ?? null);
    },
  }), [app, navigate, agentContext, tradeId, staffContext.userId, resolveCustomerId, setPendingQuoteFields, setLastAcceptedFields, setJobGroupId, setActiveTradeId, setDetectedTrades, setAiDetectedTrade]);

  const runTools = async (actions: CopilotAction[]) => {
    const unique = actions.filter((action, index, arr) =>
      arr.findIndex((a) => a.action === action.action && JSON.stringify(a.output) === JSON.stringify(action.output)) === index
    );
    const result = await processToolActions(unique, buildRuntimeContext(), {
      role: agentContext.role,
      requireConfirmCustomerMessages: studio.requireConfirmCustomerMessages,
    });
    if (result.executed.length > 0) {
      setToolResults(result.executed);
    }
    if (result.pendingSafety.length > 0) {
      setSafetyPending(result.pendingSafety);
    }
    if (result.summaries.length > 0) {
      for (const summary of result.summaries) {
        toast.success(summary, { duration: 3500 });
      }
    }
    return result;
  };

  const approveSafetyAction = async (action: CopilotAction, index: number) => {
    const execResult = await executeSafetyAction(action, buildRuntimeContext());
    setToolResults((prev) => [...prev, execResult]);
    toast.success(execResult.summary);
    setSafetyPending((prev) => prev.filter((_, i) => i !== index));
  };

  const appendFailureNotes = (content: string, toolRun: Awaited<ReturnType<typeof runTools>>) => {
    const failures = toolRun.executed.filter((r) => !r.executed && r.summary);
    if (failures.length === 0) return content;
    const notes = failures.map((f) => f.summary).join(' ');
    if (content.toLowerCase().includes(notes.slice(0, 20).toLowerCase())) return content;
    return `${content}\n\n⚠️ ${notes}`;
  };

  const runCopilotBrain = async (content: string) => {
    const history = [...messages, { role: 'user', content }].map((m) => ({ role: m.role, content: m.content }));
    const activeProject = agentContext.projectId ? getProject(agentContext.projectId) : null;
    const activePlanning = agentContext.planningApplicationId
      ? getPlanningApplication(agentContext.planningApplicationId)
      : null;

    try {
      const orchestratorResult = await sendOrchestratorMessage(history, agentContext, {
        model: settings.model,
        userName: staffContext.userName,
        userId: staffContext.userId,
        companyName: 'TradePro',
        customers: staffContext.customers,
        quotes: staffContext.quotes,
        businessSnapshot,
        customerName: app?.user.name,
        customerId: resolveCustomerId() || undefined,
        channel: 'overlay_chat',
        pendingTask,
        projectContext: activeProject
          ? {
              projectId: activeProject.id,
              projectName: activeProject.projectName,
              total: activeProject.totalCustomerCost,
              quoteId: activeProject.quoteId,
              builderId: activeProject.assignedBuilder,
              tradeId: activeProject.tradeId,
              tradeName: activeProject.tradeName,
              assignedContractors: activeProject.assignedContractors ?? [],
            }
          : undefined,
        planningApplicationContext: activePlanning
          ? buildPlanningOrchestratorContext(activePlanning)
          : undefined,
        dataContext,
      });

      if (orchestratorResult.phase === 'clarify' && orchestratorResult.clarifyingQuestions?.length) {
        setPendingTask({
          id: orchestratorResult.pendingTaskId ?? `task-${Date.now()}`,
          summary: orchestratorResult.taskSummary ?? content,
          questions: orchestratorResult.clarifyingQuestions,
          askedAt: new Date().toISOString(),
        });
        return {
          content: orchestratorResult.content,
          detectedTrades: [] as typeof detectedTrades,
          skipTools: true,
        };
      }

      const detected = orchestratorResult.detectedTrades
        .filter((d) => isValidTradeId(d.tradeId))
        .map((d) => ({ ...d, tradeId: d.tradeId as TradeId }));

      if (detected.length > 0) {
        setDetectedTrades(detected);
        setAiDetectedTrade(true);
        setActiveTradeId(detected[0].tradeId);
      }

      const allActions = [
        ...orchestratorResult.autoActions,
        ...orchestratorResult.proposedActions,
      ];
      const isClarifyPhase = orchestratorResult.phase === 'clarify';
      const actionsToRun = isClarifyPhase
        ? allActions.filter((a) => !isWriteToolBlockedInClarify(a.action))
        : allActions;
      const toolRun = actionsToRun.length > 0 ? await runTools(actionsToRun) : { executed: [], pendingSafety: [], summaries: [] };

      if (orchestratorResult.phase === 'execute' || toolRun.executed.some((r) => r.executed)) {
        clearPendingTask();
      }

      let replyContent = orchestratorResult.content;
      replyContent = appendFailureNotes(replyContent, toolRun);

      return {
        content: replyContent,
        detectedTrades: detected,
      };
    } catch (err) {
      console.error('[AIChatPanel] orchestrator error:', err);
      const connectionError = connectionFromOrchestratorError(err);
      if (connectionError) {
        setConnection(connectionError);
      }
      throw err;
    }
  };

  const handleSend = async (text?: string): Promise<string | undefined> => {
    const content = (text ?? input).trim();
    if (!content && photos.length === 0) return undefined;

    if (!isChatConnected) {
      toast.error(connection.message ?? 'Chat is not connected to OpenAI.');
      return undefined;
    }

    setInput('');
    setLoading(true);
    setToolResults([]);
    setSafetyPending([]);

    if (content) {
      addMessage({ role: 'user', content });
      logMsg('user', content);
      syncConversation('user', content);
    }

    if (
      content
      && agentContext.role === 'customer'
      && /invoice|send bill|payment request|draft invoice/i.test(content)
    ) {
      const refusal = blockedActionMessage('customer');
      addMessage({ role: 'assistant', content: refusal });
      logMsg('assistant', refusal);
      setLoading(false);
      return refusal;
    }

    if (photos.length > 0) {
      try {
        const brainResult = await runCopilotBrain(content || 'Analyse site photos and detect trades');
        const detected = brainResult.detectedTrades?.length ? brainResult.detectedTrades : detectedTrades;
        const primaryTrade = detected[0]?.tradeId ?? tradeId;
        if (!primaryTrade) {
          const ask = brainResult.content || 'Describe the job type (e.g. bathroom refit) so I can analyse your photos.';
          addMessage({ role: 'assistant', content: ask });
          setPhotos([]);
          setLoading(false);
          return ask;
        }

        const result = await estimateFromPhotos(primaryTrade, photos);
        setEstimation(result);
        const photoReply = brainResult.content || result.summary;
        addMessage({
          role: 'assistant',
          content: photoReply,
          suggestions: result.suggestions,
        });
        setPhotos([]);
        setLoading(false);
        return photoReply;
      } catch (err) {
        const connectionError = connectionFromOrchestratorError(err);
        if (connectionError) {
          setConnection(connectionError);
          toast.error(connectionError.message ?? 'Chat is not connected to OpenAI.');
        } else {
          toast.error(err instanceof Error ? err.message : 'AI request failed.');
        }
      }
      setPhotos([]);
      setLoading(false);
      return undefined;
    }

    try {
      const brainResult = await runCopilotBrain(content);
      const responseContent = brainResult.content || 'Sorry — I could not produce a reply. Try again.';
      addMessage({ role: 'assistant', content: responseContent });
      logMsg('assistant', responseContent);
      setLoading(false);
      return responseContent;
    } catch (err) {
      const connectionError = connectionFromOrchestratorError(err);
      if (connectionError) {
        setConnection(connectionError);
        toast.error(connectionError.message ?? 'Chat is not connected to OpenAI.');
      } else {
        toast.error(err instanceof Error ? err.message : 'AI request failed.');
      }
    }
    setLoading(false);
    return undefined;
  };

  const handleVoiceNote = async (file: File) => {
    if (!isChatConnected) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/ai/transcribe', { method: 'POST', body: form });
      const data = await res.json() as { text?: string };
      const text = data.text?.trim();
      if (text) await handleSend(text);
      else toast.error('Could not transcribe voice note');
    } catch {
      toast.error('Voice note upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleProceedWithBestJudgment = () => {
    void handleSend('Use context and proceed with your best judgment');
  };

  const voice = useVoiceConversation({
    onUserMessage: async (text) => (await handleSend(text)) ?? '',
  });

  // Auto-start hands-free voice when opened from AI Design (requestVoiceStart).
  useEffect(() => {
    if (!isOpen || !preferVoiceOnOpen) return;
    if (!voice.isSupported || !isChatConnected) {
      if (isOpen && preferVoiceOnOpen && !voice.isSupported) {
        clearPreferVoiceOnOpen();
        toast.info('Voice not supported in this browser — type your message instead');
      }
      return;
    }
    if (!voice.active) {
      voice.start();
    }
    clearPreferVoiceOnOpen();
  }, [
    isOpen,
    preferVoiceOnOpen,
    isChatConnected,
    voice.isSupported,
    voice.active,
    voice.start,
    clearPreferVoiceOnOpen,
  ]);

  const voiceStatusLabel =
    voice.status === 'listening' ? 'Listening…'
    : voice.status === 'thinking' ? 'Thinking…'
    : voice.status === 'speaking' ? 'Speaking… (tap to interrupt)'
    : 'Voice mode on';

  const photoGuidance = tradeId ? getTrade(tradeId).aiExtraction?.photoGuidance : undefined;

  return (
    <div className="flex flex-col h-full min-h-0">
      {connection.status === 'checking' && (
        <div className="shrink-0 px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-600 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Checking OpenAI connection…
        </div>
      )}
      {!isChatConnected && connection.status !== 'checking' && (
        <div className="shrink-0 px-3 py-3 bg-red-50 border-b border-red-200 text-xs text-red-900 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">
                {connection.status === 'rejected'
                  ? 'OpenAI key rejected'
                  : (agentContext.role === 'customer' || agentContext.role === 'builder')
                    ? 'Company AI unavailable'
                    : 'Not connected to OpenAI'}
              </p>
              <p className="mt-1">
                {connection.message
                  ?? ((agentContext.role === 'customer' || agentContext.role === 'builder')
                    ? 'Company AI not configured yet — ask your Super Admin to add an OpenAI key in Integrations.'
                    : 'Add your API key in Settings → Integrations → OpenAI and Save.')}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {(agentContext.role === 'super_admin' || agentContext.role === 'manager') && (
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium"
                onClick={() => navigate('/settings')}
              >
                Open Settings
              </button>
            )}
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg border border-red-300 text-xs"
              onClick={() => void refreshConnection()}
            >
              Retry connection
            </button>
          </div>
        </div>
      )}
      <TradeChips
        detectedTrades={detectedTrades}
        activeTradeId={tradeId}
        aiDetected={aiDetectedTrade}
        onSelectTrade={(id) => setTradeOverride(id)}
        hidden
      />
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-6">
            <Sparkles className="w-10 h-10 mx-auto mb-2 text-amber-500" />
            <p className="font-medium">TradePro AI</p>
            <p className="text-sm mt-1">{rolePrompt}</p>
            {studio.starterQuestionsEnabled && isChatConnected && (
              <div className="mt-4">
                <StarterQuestions role={agentContext.role} onSelect={(p) => handleSend(p)} />
              </div>
            )}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${
              m.role === 'user' ? 'bg-amber-500 text-white text-sm whitespace-pre-wrap' : 'bg-slate-100 text-slate-800'
            }`}>
              {m.role === 'assistant' ? (
                <ChatMarkdown content={m.content} />
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}

        {toolResults.length > 0 && (
          <ToolResultPanel results={toolResults} onOpen={(route) => navigate(route)} />
        )}

        {pendingTask && pendingTask.questions.length > 0 && (
          <TaskClarifyCard
            taskSummary={pendingTask.summary}
            questions={pendingTask.questions}
            onProceed={handleProceedWithBestJudgment}
            onFocusComposer={() => {
              document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Chat message"]')?.focus();
            }}
          />
        )}

        {safetyPending.map((action, index) => (
          <div key={`safety-${action.action}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs">
            <p className="text-slate-700 mb-2">{getHumanActionLabel(action.action, action.output)}</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="px-3 py-1 rounded-lg bg-amber-600 text-white text-xs"
                onClick={() => void approveSafetyAction(action, index)}
              >
                Confirm
              </button>
              <button
                type="button"
                className="px-3 py-1 rounded-lg border border-slate-300 text-xs"
                onClick={() => setSafetyPending((prev) => prev.filter((_, i) => i !== index))}
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}

        {estimation && tradeId && (
          <AIReviewPanel
            tradeId={tradeId}
            result={estimation}
            onAccept={(accepted) => {
              setLastAcceptedFields(accepted);
              setPendingQuoteFields(accepted);
              setEstimation(null);
              void runTools([{
                action: 'saveQuote',
                input: {},
                output: {
                  tradeId,
                  wizardAnswers: accepted,
                  customerId: pageContext.customerId,
                  status: 'indicative',
                  openQuote: false,
                },
              }]);
            }}
            onCancel={() => setEstimation(null)}
          />
        )}
        {loading && <Loader2 className="w-5 h-5 animate-spin text-amber-500 mx-auto" />}
      </div>
      <div className="shrink-0 p-3 border-t bg-white space-y-2">
        {messages.length > 0 && studio.starterQuestionsEnabled && isChatConnected && (
          <StarterQuestions
            role={agentContext.role}
            onSelect={(p) => handleSend(p)}
            visible={messages.length > 0 && messages[messages.length - 1]?.role === 'assistant'}
          />
        )}
        <PhotoCapture
          photos={photos}
          onChange={setPhotos}
          maxPhotos={settings.maxPhotos}
          photoGuidance={photoGuidance}
          showGuidance={photos.length > 0}
        />
        {voice.active && (
          <button
            type="button"
            onClick={voice.interrupt}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white text-sm py-2 animate-pulse"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
            </span>
            {voiceStatusLabel}
          </button>
        )}
        <div className="flex gap-2 items-end">
          <VoiceInputButton
            onTranscript={(t) => {
              setInput(t);
              if ((settings.voiceConversation || voice.active) && isChatConnected) void handleSend(t);
            }}
          />
          <input
            ref={voiceNoteRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleVoiceNote(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            title="Upload voice note (Whisper)"
            disabled={!isChatConnected || loading}
            onClick={() => voiceNoteRef.current?.click()}
            className="shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-md border bg-white text-slate-600 border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            <Mic className="w-4 h-4" />
          </button>
          {voice.isSupported && (
            <button
              type="button"
              title={voice.active ? 'Stop voice mode' : 'Hands-free voice mode'}
              disabled={!isChatConnected}
              onClick={() => (voice.active ? voice.stop() : voice.start())}
              className={`shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-md border transition-colors ${
                voice.active
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              } disabled:opacity-50`}
            >
              {voice.active ? <Square className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
            </button>
          )}
          <div className="flex-1 min-w-0">
            <ChatComposer
              value={input}
              onChange={setInput}
              onSend={() => handleSend()}
              loading={loading}
              disabled={!isChatConnected}
              placeholder={isChatConnected ? rolePrompt : 'Connect OpenAI in Settings to chat'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
