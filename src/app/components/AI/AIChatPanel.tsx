import { useState, useContext, useMemo, useRef, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { useAIAssistant } from '../../context/AIAssistantContext';
import { VoiceInputButton } from './VoiceInputButton';
import { useVoiceConversation } from '../../hooks/useVoiceConversation';
import { PhotoCapture, type PhotoCaptureActions } from './PhotoCapture';
import { estimateFromPhotos, type EstimationResult } from '../../engine/aiEstimationService';
import { AIReviewPanel } from './AIReviewPanel';
import { TradeChips } from './TradeChips';
import { ChatComposer } from './ChatComposer';
import { ComposerAttachMenu } from './ComposerAttachMenu';
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
import { getOfficeTeamCounts, getOfficeTeamRoster, loadOfficeTeam } from '../../engine/team/teamSnapshot';
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
import {
  dismissCodeFix,
  enqueueCodeFix,
  getCodeFixJob,
  listCodeFixJobs,
  mergeCodeFix,
  retryCodeFix,
  statusLabel,
} from '../../engine/ai/codeFixService';
import { getActiveOrgId } from '../../engine/platform/orgContext';
import { postAgentActivity } from '../../engine/ai/agentActivity';

export function AIChatPanel() {
  const app = useContext(AppContext);
  const {
    isOpen,
    preferVoiceOnOpen, clearPreferVoiceOnOpen,
    messages, addMessage, updateMessage, settings, pageContext,
    setPendingQuoteFields, setLastAcceptedFields,
    detectedTrades, setDetectedTrades,
    setActiveTradeId,
    aiDetectedTrade, setAiDetectedTrade,
    setJobGroupId,
    pendingTask, setPendingTask, clearPendingTask,
    trackedFixJobs, trackFixJob, untrackFixJob,
  } = useAIAssistant();
  const announcedFixStatusRef = useRef<Record<string, string>>({});
  const { tradeId, tradeName, setTradeOverride } = useResolvedTrade();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [estimation, setEstimation] = useState<EstimationResult | null>(null);
  const [toolResults, setToolResults] = useState<ToolExecutionResult[]>([]);
  const [safetyPending, setSafetyPending] = useState<CopilotAction[]>([]);
  const [connection, setConnection] = useState<OpenAIConnectionState>({ status: 'checking' });
  const scrollRef = useRef<HTMLDivElement>(null);
  const photoCaptureRef = useRef<PhotoCaptureActions | null>(null);

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

  const [teamVersion, setTeamVersion] = useState(0);
  useEffect(() => {
    void loadOfficeTeam().then(() => setTeamVersion((v) => v + 1));
  }, []);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app?.customers, app?.quotes, agentContext.role, teamVersion]);

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
    approvedBy: app?.user.name ?? 'Cynthia',
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
      // Mirror client-side tool executions to the live activity feed on all devices.
      for (const r of result.executed) {
        postAgentActivity({
          userId: staffContext.userId,
          action: r.action,
          phase: r.executed ? 'completed' : 'error',
          summary: r.summary || r.action,
          route: r.openRoute,
        });
      }
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
        companyName: integrationService.getConfig('company').companyName || 'Builder Diddies',
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

  const respondToFixOffer = useCallback(async (messageId: string, yes: boolean) => {
    const msg = messages.find((m) => m.id === messageId);
    const offer = msg?.fixOffer;
    if (!offer || offer.resolved) return;

    updateMessage(messageId, {
      fixOffer: { ...offer, resolved: yes ? 'yes' : 'no' },
    });
    addMessage({ role: 'user', content: yes ? 'Yes' : 'No' });

    if (!yes) {
      try {
        await dismissCodeFix(offer.jobId);
      } catch {
        // ignore
      }
      addMessage({
        role: 'assistant',
        content: 'OK — I won’t start a fix for that error. Say if you change your mind.',
      });
      return;
    }

    try {
      const role = String(app?.user.role ?? agentContext.role);
      const result = await enqueueCodeFix({
        jobId: offer.jobId,
        errorCode: offer.errorCode,
        description: offer.description,
        route: offer.route,
        requesterRole: role === 'platform_owner' ? 'super_admin' : role,
        requesterName: app?.user.name || 'Staff',
        requesterUserId: app?.user.id,
        orgId: getActiveOrgId() || undefined,
      });
      trackFixJob(result.job.id);
      const queueNote =
        typeof result.queuePosition === 'number' && result.queuePosition > 0
          ? ` There are ${result.queuePosition} job(s) ahead of you.`
          : '';
      addMessage({
        role: 'assistant',
        content:
          (result.message || 'Logged — starting a surgical fix.') +
          queueNote +
          (result.needsCursorApproval
            ? '\n\nThis needs your approval in Cursor before a large change runs.'
            : '\n\nI\'ll notify you when a GitHub PR link is ready. Track anytime via **Open Code fixes**. Then use **Open PR** / **Approve & merge** here (GitHub merge page if auto-merge is not configured).'),
        fixJobId: result.job.id,
        statusAction: {
          label: 'Open Code fixes',
          href: '/ai-audit?tab=code_fixes',
        },
      });
      if (result.job.cursorAgentUrl) {
        addMessage({
          role: 'assistant',
          content: `Cursor agent: ${result.job.cursorAgentUrl}`,
          fixJobId: result.job.id,
        });
      }
    } catch (err) {
      addMessage({
        role: 'assistant',
        content: `Couldn’t start the fix: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }, [messages, updateMessage, addMessage, app?.user, agentContext.role, trackFixJob]);

  // Rehydrate in-flight fix jobs after refresh so Approve can still surface
  useEffect(() => {
    for (const m of messages) {
      if (m.fixJobId && !m.mergeAction?.resolved && !m.mergeAction?.prUrl) {
        trackFixJob(m.fixJobId);
      }
    }
  }, [messages, trackFixJob]);

  // Surface PRs that already exist (chat often missed the poll while closed / before PR URL arrived)
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void (async () => {
      try {
        const { jobs } = await listCodeFixJobs({ status: 'pr_open' });
        if (cancelled) return;
        for (const job of jobs) {
          if (!job.prUrl) continue;
          const key = `pr_open:ready`;
          if (announcedFixStatusRef.current[job.id] === key) continue;
          const alreadyInChat = messages.some(
            (m) => m.fixJobId === job.id && m.mergeAction?.prUrl === job.prUrl,
          );
          if (alreadyInChat) {
            announcedFixStatusRef.current[job.id] = key;
            continue;
          }
          announcedFixStatusRef.current[job.id] = key;
          addMessage({
            role: 'assistant',
            content:
              `**PR ready** for \`${job.errorCode || 'error'}\` on **${job.route || 'app'}**.\n` +
              `${job.prUrl}\n` +
              `Use **Open PR** to review, or **Approve & merge** (opens GitHub if auto-merge isn’t configured).\n` +
              `Also listed under **AI Audit → Code fixes**.`,
            fixJobId: job.id,
            mergeAction: {
              jobId: job.id,
              prUrl: job.prUrl,
              cursorAgentUrl: job.cursorAgentUrl,
            },
            statusAction: {
              label: 'Open Code fixes',
              href: '/ai-audit?tab=code_fixes',
            },
          });
        }
      } catch {
        // ignore — poll / Code fixes remain available
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only when chat opens — avoid re-spamming on every message
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: one pass per open
  }, [isOpen]);

  useEffect(() => {
    if (trackedFixJobs.length === 0) return;
    let cancelled = false;
    const tick = async () => {
      for (const jobId of trackedFixJobs) {
        try {
          const { job, queuePosition } = await getCodeFixJob(jobId);
          if (cancelled) return;
          const terminal = ['pr_open', 'merged', 'failed', 'cancelled', 'dismissed', 'awaiting_cursor_approval'];
          if (job.status === 'queued') {
            // soft status — only occasionally announce
            if (queuePosition > 0 && job.attemptCount === 0) {
              // skip spam
            }
          }
          const already = announcedFixStatusRef.current[jobId];
          const statusKey =
            job.status === 'pr_open'
              ? job.prUrl
                ? 'pr_open:ready'
                : 'pr_open:waiting'
              : job.status;
          if (already === statusKey) continue;
          if (job.status === 'failed' && job.alertedAt) {
            announcedFixStatusRef.current[jobId] = statusKey;
            addMessage({
              role: 'assistant',
              content:
                `**Fix failed** for \`${job.errorCode || 'error'}\`.\n` +
                `${job.lastError || 'Unknown error'}\n\n` +
                `Say **retry** or use Admin → AI Audit → Code fixes.`,
              fixJobId: job.id,
            });
            untrackFixJob(jobId);
          } else if (job.status === 'pr_open') {
            announcedFixStatusRef.current[jobId] = statusKey;
            if (!job.prUrl) {
              addMessage({
                role: 'assistant',
                content:
                  `Cursor is still preparing the PR for \`${job.errorCode || 'error'}\`.\n` +
                  (job.cursorAgentUrl ? `Agent: ${job.cursorAgentUrl}\n` : '') +
                  `No GitHub URL yet — keep **AI Audit → Code fixes** open; I’ll add **Open PR** here when it appears.`,
                fixJobId: job.id,
                statusAction: {
                  label: 'Open Code fixes',
                  href: '/ai-audit?tab=code_fixes',
                },
              });
            } else {
              addMessage({
                role: 'assistant',
                content:
                  `**PR ready** for \`${job.errorCode || 'error'}\`.\n` +
                  `${job.prUrl}\n` +
                  (job.cursorAgentUrl ? `Agent: ${job.cursorAgentUrl}\n` : '') +
                  `Use **Open PR** to review, or **Approve & merge** (opens GitHub if auto-merge isn’t configured).`,
                fixJobId: job.id,
                mergeAction: {
                  jobId: job.id,
                  prUrl: job.prUrl,
                  cursorAgentUrl: job.cursorAgentUrl,
                },
                statusAction: {
                  label: 'Open Code fixes',
                  href: '/ai-audit?tab=code_fixes',
                },
              });
              untrackFixJob(jobId);
            }
          } else if (job.status === 'awaiting_cursor_approval') {
            announcedFixStatusRef.current[jobId] = statusKey;
            addMessage({
              role: 'assistant',
              content:
                `This needs **your approval in Cursor** before I implement a wider change.\n` +
                (job.cursorAgentUrl ? `Open: ${job.cursorAgentUrl}` : 'Open Cursor Agents dashboard.'),
              fixJobId: job.id,
            });
            untrackFixJob(jobId);
          } else if (terminal.includes(job.status)) {
            announcedFixStatusRef.current[jobId] = statusKey;
            untrackFixJob(jobId);
          }
        } catch (err) {
          const key = `poll_error:${jobId}`;
          if (announcedFixStatusRef.current[jobId] === key) continue;
          announcedFixStatusRef.current[jobId] = key;
          addMessage({
            role: 'assistant',
            content:
              `Couldn’t check fix status (${err instanceof Error ? err.message : 'network error'}).\n` +
              `Open **AI Audit → Code fixes** to continue.`,
            fixJobId: jobId,
            statusAction: {
              label: 'Open Code fixes',
              href: '/ai-audit?tab=code_fixes',
            },
          });
        }
      }
    };
    const id = window.setInterval(() => void tick(), 8000);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [trackedFixJobs, addMessage, untrackFixJob]);

  const respondToMergeAction = useCallback(async (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    const action = msg?.mergeAction;
    if (!action || action.resolved) return;

    updateMessage(messageId, {
      mergeAction: { ...action, resolved: true },
    });
    addMessage({ role: 'user', content: 'Approve & merge' });

    try {
      const result = await mergeCodeFix(action.jobId);
      if (result.merged) {
        addMessage({
          role: 'assistant',
          content: `**Merged** \`${result.job.errorCode || 'fix'}\` successfully.`,
          fixJobId: result.job.id,
        });
        return;
      }
      if (result.needsManualMerge && (result.prUrl || action.prUrl)) {
        const url = result.prUrl || action.prUrl!;
        addMessage({
          role: 'assistant',
          content:
            `Could not merge from the server (${result.error || 'GITHUB_TOKEN missing or PR not mergeable'}).\n` +
            `Opening the PR for you to merge manually: ${url}\n\n` +
            `Also available in **AI Audit → Code fixes**.`,
          fixJobId: action.jobId,
        });
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
      addMessage({
        role: 'assistant',
        content: `Merge failed: ${result.error || 'Unknown error'}`,
        fixJobId: action.jobId,
      });
    } catch (err) {
      addMessage({
        role: 'assistant',
        content: `Merge failed: ${err instanceof Error ? err.message : String(err)}`,
        fixJobId: action.jobId,
      });
    }
  }, [messages, updateMessage, addMessage]);

  const handleSend = async (text?: string): Promise<string | undefined> => {
    const content = (text ?? input).trim();
    if (!content && photos.length === 0) return undefined;
    // Yes/No for pending self-heal offers does not require OpenAI
    const pendingOfferMsg = [...messages].reverse().find((m) => m.fixOffer && !m.fixOffer.resolved);
    if (pendingOfferMsg?.fixOffer && /^(yes|y|yeah|yep|ok|okay|fix it|please fix)$/i.test(content)) {
      setInput('');
      await respondToFixOffer(pendingOfferMsg.id, true);
      return 'Yes';
    }
    if (pendingOfferMsg?.fixOffer && /^(no|n|nope|cancel|dismiss)$/i.test(content)) {
      setInput('');
      await respondToFixOffer(pendingOfferMsg.id, false);
      return 'No';
    }
    if (/^retry$/i.test(content) && trackedFixJobs.length === 0) {
      const lastFailed = [...messages].reverse().find((m) => m.fixJobId);
      if (lastFailed?.fixJobId) {
        setInput('');
        addMessage({ role: 'user', content: 'retry' });
        try {
          const { job } = await retryCodeFix(lastFailed.fixJobId);
          trackFixJob(job.id);
          addMessage({
            role: 'assistant',
            content: `Re-queued fix for \`${job.errorCode || 'error'}\` (${statusLabel(job.status)}).`,
            fixJobId: job.id,
          });
        } catch (err) {
          addMessage({
            role: 'assistant',
            content: `Retry failed: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
        return 'retry';
      }
    }

    if (!isChatConnected) {
      // Re-probe before blocking — a prior tool 503 must not leave the overlay stuck offline.
      const refreshed = await refreshConnection();
      if (refreshed.status !== 'connected') {
        toast.error(refreshed.message ?? connection.message ?? 'Chat is not connected to OpenAI.');
        return undefined;
      }
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
            <img
              src="/cynthia-avatar.png"
              alt=""
              className="w-14 h-14 rounded-full object-cover mx-auto mb-3 ring-2 ring-slate-100"
            />
            <p className="font-medium text-slate-800">Cynthia</p>
            <p className="text-sm mt-1 text-slate-600">Cynthia, I am here to help</p>
            <p className="text-sm mt-1">{rolePrompt}</p>
            {studio.starterQuestionsEnabled && isChatConnected && (
              <div className="mt-4">
                <StarterQuestions role={agentContext.role} onSelect={(p) => handleSend(p)} />
              </div>
            )}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <img
                src="/cynthia-avatar.png"
                alt=""
                className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5 ring-1 ring-slate-200"
              />
            )}
            <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${
              m.role === 'user' ? 'bg-amber-500 text-white text-sm whitespace-pre-wrap' : 'bg-slate-100 text-slate-800'
            }`}>
              {m.role === 'assistant' ? (
                <ChatMarkdown content={m.content} />
              ) : (
                m.content
              )}
              {m.fixOffer && !m.fixOffer.resolved && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium"
                    onClick={() => void respondToFixOffer(m.id, true)}
                  >
                    Yes, fix it
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                    onClick={() => void respondToFixOffer(m.id, false)}
                  >
                    No
                  </button>
                </div>
              )}
              {m.fixOffer?.resolved && (
                <p className="mt-2 text-[11px] text-slate-500">
                  You chose: {m.fixOffer.resolved === 'yes' ? 'Yes' : 'No'}
                </p>
              )}
              {m.mergeAction && !m.mergeAction.resolved && (
                <div className="mt-3 flex gap-2 flex-wrap">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium"
                    onClick={() => void respondToMergeAction(m.id)}
                  >
                    Approve & merge
                  </button>
                  {m.mergeAction.prUrl && (
                    <a
                      href={m.mergeAction.prUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs inline-flex items-center"
                    >
                      Open PR
                    </a>
                  )}
                </div>
              )}
              {m.mergeAction?.resolved && (
                <p className="mt-2 text-[11px] text-slate-500">
                  Merge approved
                </p>
              )}
              {m.statusAction && !m.mergeAction?.prUrl && (
                <div className="mt-3 flex gap-2 flex-wrap">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg border border-amber-400 bg-amber-50 text-amber-900 text-xs font-medium"
                    onClick={() => navigate(m.statusAction!.href)}
                  >
                    {m.statusAction.label}
                  </button>
                </div>
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
          showActions={false}
          compact
          actionRef={photoCaptureRef}
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
        <ChatComposer
          value={input}
          onChange={setInput}
          onSend={() => handleSend()}
          loading={loading}
          disabled={!isChatConnected}
          placeholder={isChatConnected ? rolePrompt : 'Connect OpenAI in Settings to chat'}
          leading={
            <ComposerAttachMenu
              disabled={!isChatConnected}
              onUpload={() => photoCaptureRef.current?.openUpload()}
              onCamera={() => photoCaptureRef.current?.openCamera()}
              handsFreeSupported={voice.isSupported}
              handsFreeActive={voice.active}
              onToggleHandsFree={() => (voice.active ? voice.stop() : voice.start())}
            />
          }
          trailing={
            <VoiceInputButton
              compact
              onTranscript={(t) => {
                setInput(t);
                if ((settings.voiceConversation || voice.active) && isChatConnected) void handleSend(t);
              }}
            />
          }
        />
      </div>
    </div>
  );
}
