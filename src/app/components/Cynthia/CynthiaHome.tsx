import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Mic, MicOff, Paperclip, ClipboardPaste, Image as ImageIcon, Loader2, Wrench,
} from 'lucide-react';
import { AppContext } from '../../App';
import { Button } from '../ui/button';
import { useCynthiaVapiVoice } from '../../hooks/useCynthiaVapiVoice';
import { sendOrchestratorMessage, type CopilotAction } from '../../engine/ai/orchestratorService';
import {
  processToolActions,
  executeSafetyAction,
  type ToolExecutionResult,
  type ToolRuntimeContext,
} from '../../engine/ai/toolRuntime';
import { getHumanActionLabel } from '../../engine/ai/actionPolicy';
import { ChatMarkdown } from '../AI/ChatMarkdown';
import { ChatComposer } from '../AI/ChatComposer';
import { ToolResultPanel } from '../AI/ToolResultPanel';
import { StaffActionCard } from './StaffActionCard';
import { ArtifactViewer, type OpenArtifact } from './ArtifactViewer';
import {
  fetchCynthiaThread,
  postCynthiaMessage,
  type CynthiaStaffMessage,
} from '../../engine/cynthia/cynthiaStaffApi';
import { integrationService } from '../../engine/integrations/integrationService';
import { isNativeBridgeAvailable, nativeTakePhoto } from '../../bridge/nativeBridge';
import { toast } from 'sonner';
import {
  dismissCodeFix,
  enqueueCodeFix,
  getCodeFixJob,
  retryCodeFix,
  statusLabel,
  type CodeFixJob,
} from '../../engine/ai/codeFixService';
import type { AgentContext } from '../../engine/ai/agentContext';
import type { WizardAnswers } from '../../config/types';
import { useAIAssistant } from '../../context/AIAssistantContext';
import { getExperience } from '../../engine/platform/experience';

type LocalBubble =
  | { id: string; kind: 'text'; role: 'user' | 'assistant'; content: string; ts: string }
  | { id: string; kind: 'card'; message: CynthiaStaffMessage }
  | { id: string; kind: 'artifact'; message: CynthiaStaffMessage };

/** Local copy of Builder Diddies staff photo from https://b-diddies.com */
const CYNTHIA_AVATAR_SRC = '/cynthia-avatar.png';

function assistantName(role?: string): string {
  // Sales experience / platform_owner → Sally (Sync2Dine sales OS). Restaurant ops keep Cynthia.
  if (getExperience(role || 'staff') === 'sales') return 'Sally';
  return 'Cynthia';
}

function CynthiaAvatar({
  name,
  sizeClass = 'h-10 w-10',
  className = '',
}: {
  name: string;
  sizeClass?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`${sizeClass} rounded-full bg-emerald-300/30 flex items-center justify-center text-lg font-semibold shrink-0 ${className}`}
        aria-hidden="true"
      >
        {name.slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={CYNTHIA_AVATAR_SRC}
      alt={name}
      className={`${sizeClass} rounded-full object-cover shrink-0 bg-emerald-300/20 ${className}`}
      onError={() => setFailed(true)}
    />
  );
}

export default function CynthiaHome() {
  const app = useContext(AppContext);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const {
    setPendingQuoteFields, setLastAcceptedFields, setJobGroupId, setActiveTradeId,
    setDetectedTrades, setAiDetectedTrade,
  } = useAIAssistant();
  const highlightCardId = params.get('card') || '';
  const ingestText = params.get('text') || '';
  const name = assistantName(app?.user?.role);
  const isSally = name === 'Sally';
  const orchestratorMode = isSally ? 'sally' : 'staff';

  const userId = app?.user.id || 'default-staff';
  const [composer, setComposer] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Array<{ name: string; dataUrl: string; mime: string }>>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [bubbles, setBubbles] = useState<LocalBubble[]>([]);
  const [toolResults, setToolResults] = useState<ToolExecutionResult[]>([]);
  const [safetyPending, setSafetyPending] = useState<CopilotAction[]>([]);
  const [artifact, setArtifact] = useState<OpenArtifact | null>(null);
  const [fixJobs, setFixJobs] = useState<Array<{ id: string; job?: CodeFixJob }>>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const agentContext: AgentContext = useMemo(() => ({
    role: (app?.user.role as AgentContext['role']) ?? 'staff',
    route: '/cynthia',
    tradeId: null,
    customerId: null,
    projectId: null,
    quoteId: null,
    builderId: null,
    bcSessionId: null,
    bcInquiryId: null,
    planningApplicationId: null,
  }), [app?.user.role]);

  const buildRuntimeContext = useCallback((): ToolRuntimeContext => ({
    app,
    navigate,
    projectId: null,
    planningApplicationId: null,
    tradeId: null,
    approvedBy: app?.user.name ?? name,
    role: agentContext.role,
    userId: app?.user.id,
    customerId: null,
    builderId: null,
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
  }), [
    app, navigate, agentContext.role, name,
    setPendingQuoteFields, setLastAcceptedFields, setJobGroupId, setActiveTradeId,
    setDetectedTrades, setAiDetectedTrade,
  ]);

  const reloadThread = useCallback(async () => {
    const thread = await fetchCynthiaThread(userId);
    const mapped: LocalBubble[] = thread.messages.map((m) => {
      if (m.role === 'card' && m.card) {
        return { id: m.id, kind: 'card', message: m };
      }
      if (m.artifact) {
        return { id: m.id, kind: 'artifact', message: m };
      }
      return {
        id: m.id,
        kind: 'text',
        role: m.role === 'assistant' || m.role === 'system' ? 'assistant' : 'user',
        content: m.content,
        ts: m.timestamp,
      };
    });
    setBubbles(mapped);
  }, [userId]);

  useEffect(() => {
    void reloadThread();
    // Faster polling while waiting for a highlighted card; otherwise 8s
    const intervalMs = highlightCardId ? 2500 : 8000;
    const id = window.setInterval(() => { void reloadThread(); }, intervalMs);
    return () => window.clearInterval(id);
  }, [reloadThread, highlightCardId]);

  // Refetch immediately when deep-link card changes
  useEffect(() => {
    if (!highlightCardId) return;
    void reloadThread();
  }, [highlightCardId, reloadThread]);

  // Foreground / visibility refresh for APK push arrivals
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void reloadThread();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [reloadThread]);

  useEffect(() => {
    if (!highlightCardId || !bubbles.length) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      return;
    }
    const el = document.querySelector(`[data-cynthia-card="${highlightCardId}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const t = window.setTimeout(() => {
        try {
          const url = new URL(window.location.href);
          if (url.searchParams.get('card') === highlightCardId) {
            url.searchParams.delete('card');
            window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
          }
        } catch { /* ignore */ }
      }, 2500);
      return () => window.clearTimeout(t);
    }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [bubbles, toolResults, sending, highlightCardId]);

  const ingestConsumed = useRef(false);
  useEffect(() => {
    if (!ingestText.trim() || ingestConsumed.current) return;
    ingestConsumed.current = true;
    const text = ingestText.trim();
    setComposer(text);
    toast.message(`${name} ready`, { description: 'Shared content loaded — send to process.' });
  }, [ingestText, name]);

  const {
    status: vapiStatus,
    isActive: vapiActive,
    toggle: toggleVapi,
    error: vapiError,
  } = useCynthiaVapiVoice({
    userId,
    onTranscript: (role, text) => {
      setBubbles((prev) => [
        ...prev,
        {
          id: `vapi_${role}_${Date.now()}`,
          kind: 'text',
          role: role === 'assistant' ? 'assistant' : 'user',
          content: text,
          ts: new Date().toISOString(),
        },
      ]);
      void postCynthiaMessage(userId, {
        role: role === 'assistant' ? 'assistant' : 'user',
        content: text,
        source: 'voice',
      });
      if (role === 'assistant') void reloadThread();
    },
    onStatusMessage: (message) => toast.message(message),
  });

  useEffect(() => {
    if (vapiError) toast.error(vapiError);
  }, [vapiError]);

  const handleToolOutputs = async (executed: ToolExecutionResult[]) => {
    for (const r of executed) {
      if (r.action === 'requestCodeFix' && r.executed) {
        try {
          const res = await enqueueCodeFix({
            errorCode: String(r.output.errorCode || 'MANUAL'),
            description: String(r.output.description || r.summary),
            route: String(r.output.route || '/cynthia'),
            requesterRole: String(app?.user.role ?? 'staff'),
            requesterName: String(app?.user.name ?? 'Staff'),
            requesterUserId: app?.user.id,
          });
          if (res.job?.id) setFixJobs((prev) => [...prev, { id: res.job.id, job: res.job }]);
        } catch {
          toast.error('Could not enqueue code fix');
        }
      }
      if (typeof r.output.pdfDataUrl === 'string') {
        const title = String(r.output.pdfFilename || r.output.title || 'Document');
        void postCynthiaMessage(userId, {
          role: 'assistant',
          content: title,
          source: 'cynthia',
          artifact: {
            type: 'pdf',
            title,
            dataUrl: r.output.pdfDataUrl,
            filename: String(r.output.pdfFilename || 'document.pdf'),
          },
        });
        setArtifact({ type: 'pdf', title, dataUrl: r.output.pdfDataUrl });
      }
      if (typeof r.output.draftMarkdown === 'string') {
        const draft = String(r.output.draftMarkdown);
        setBubbles((prev) => [
          ...prev,
          { id: `draft_${Date.now()}`, kind: 'text', role: 'assistant', content: draft, ts: new Date().toISOString() },
        ]);
        void postCynthiaMessage(userId, { role: 'assistant', content: draft, source: 'cynthia' });
      }
      if (typeof r.output.reportMarkdown === 'string') {
        const title = String(r.output.title || 'Report');
        void postCynthiaMessage(userId, {
          role: 'assistant',
          content: title,
          source: 'cynthia',
          artifact: { type: 'report', title, markdown: r.output.reportMarkdown },
        });
        setArtifact({ type: 'report', title, markdown: r.output.reportMarkdown });
      }
      if (r.action === 'sendToStaffCynthia' && r.executed) {
        toast.success(r.summary || 'Sent to Cynthia chat', { duration: 2800 });
        void reloadThread();
      }
    }
  };

  const runSend = async (text: string, source: 'cynthia' | 'voice' | 'paste' | 'share' = 'cynthia') => {
    const trimmed = text.trim();
    const images = pendingAttachments.map((a) => a.dataUrl).filter((u) => u.startsWith('data:image'));
    if ((!trimmed && images.length === 0) || sending || !app) return;
    setSending(true);
    setComposer('');
    const attachLabel = pendingAttachments.length
      ? ` [${pendingAttachments.map((a) => a.name).join(', ')}]`
      : '';
    const userContent = trimmed || 'Please review the attached file(s).';
    const localId = `local_${Date.now()}`;
    setBubbles((prev) => [
      ...prev,
      { id: localId, kind: 'text', role: 'user', content: `${userContent}${attachLabel}`, ts: new Date().toISOString() },
    ]);
    void postCynthiaMessage(userId, { role: 'user', content: `${userContent}${attachLabel}`, source });
    setPendingAttachments([]);

    try {
      const history = [
        ...bubbles
          .filter((b): b is Extract<LocalBubble, { kind: 'text' }> => b.kind === 'text')
          .slice(-16)
          .map((b) => ({ role: b.role, content: b.content })),
        { role: 'user', content: userContent },
      ];

      const companyName = integrationService.getConfig('company').companyName
        || (isSally ? 'Sync2Dine' : 'Builder Diddies');
      const orchestratorResult = await sendOrchestratorMessage(history, agentContext, {
        userName: app.user.name,
        userId: app.user.id,
        companyName,
        orchestratorMode,
        channel: 'overlay_chat',
        images: images.length ? images : undefined,
        customers: app.customers.slice(0, 80).map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          interestedTrades: c.interestedTrades,
          status: c.status,
          source: c.source,
          notes: c.notes,
        })),
        quotes: app.quotes.slice(0, 80).map((q) => ({
          id: q.id,
          customerId: q.customerId,
          customerName: q.customerName,
          tradeId: q.tradeId,
          tradeName: q.tradeName,
          total: q.total,
          status: q.status,
        })),
        businessSnapshot: {
          customerCount: app.customers.length,
          quoteCount: app.quotes.length,
        },
      });

      let reply = orchestratorResult.content || 'Done.';
      const allActions = [
        ...(orchestratorResult.autoActions ?? []),
        ...(orchestratorResult.proposedActions ?? []),
      ];

      if (allActions.length) {
        const toolRun = await processToolActions(allActions, buildRuntimeContext(), {
          role: agentContext.role,
          requireConfirmCustomerMessages: true,
        });
        if (toolRun.executed.length) {
          setToolResults((prev) => [...toolRun.executed, ...prev].slice(0, 30));
          await handleToolOutputs(toolRun.executed);
        }
        if (toolRun.pendingSafety.length) setSafetyPending(toolRun.pendingSafety);
        for (const summary of toolRun.summaries) toast.success(summary, { duration: 3200 });
        const failures = toolRun.executed.filter((r) => !r.executed && r.summary);
        if (failures.length) {
          reply = `${reply}\n\n⚠️ ${failures.map((f) => f.summary).join(' ')}`;
        }
      }

      setBubbles((prev) => [
        ...prev,
        {
          id: `asst_${Date.now()}`,
          kind: 'text',
          role: 'assistant',
          content: reply,
          ts: new Date().toISOString(),
        },
      ]);
      void postCynthiaMessage(userId, { role: 'assistant', content: reply, source: 'cynthia' });
      void reloadThread();
    } catch (err) {
      const msg = err instanceof Error ? err.message : `${name} could not process that.`;
      toast.error(msg);
      setBubbles((prev) => [
        ...prev,
        { id: `err_${Date.now()}`, kind: 'text', role: 'assistant', content: msg, ts: new Date().toISOString() },
      ]);
    } finally {
      setSending(false);
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        toast.message('Clipboard empty');
        return;
      }
      setComposer(text.trim());
      toast.success('Pasted — send when ready');
    } catch {
      toast.error('Could not read clipboard');
    }
  };

  const attachPhoto = async () => {
    if (isNativeBridgeAvailable()) {
      const shot = await nativeTakePhoto(true);
      if (shot?.ok && shot.dataUrl) {
        setPendingAttachments((prev) => [
          ...prev,
          { name: shot.fileName || 'camera.jpg', dataUrl: shot.dataUrl!, mime: 'image/jpeg' },
        ]);
        toast.success('Photo attached — send when ready');
      }
      return;
    }
    fileRef.current?.click();
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });

  useEffect(() => {
    if (!fixJobs.length) return;
    const id = window.setInterval(() => {
      void (async () => {
        for (const entry of fixJobs) {
          try {
            const res = await getCodeFixJob(entry.id);
            setFixJobs((prev) => prev.map((p) => (p.id === entry.id ? { id: entry.id, job: res.job } : p)));
          } catch { /* ignore */ }
        }
      })();
    }, 5000);
    return () => window.clearInterval(id);
  }, [fixJobs]);

  if (!app) return null;

  return (
    <div
      className="flex flex-col h-[calc(100dvh-7rem)] sm:h-[calc(100dvh-7.5rem)] md:h-[min(100dvh,920px)] max-w-3xl mx-auto bg-[#e5ddd5] relative w-full"
      data-testid="cynthia-home"
    >
      <header className="shrink-0 flex items-center gap-3 px-3 py-2.5 bg-[#075e54] text-white shadow">
        <CynthiaAvatar name={name} sizeClass="h-10 w-10" className="ring-2 ring-white/25" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{name}</p>
          <p className="text-[11px] text-emerald-100 truncate">
            {vapiActive
              ? vapiStatus === 'speaking'
                ? 'Speaking…'
                : vapiStatus === 'pin_required'
                  ? 'Say your 4-digit PIN'
                  : vapiStatus === 'connecting'
                    ? 'Connecting voice…'
                    : 'Listening…'
              : 'Runs the whole operation · chat first'}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-white hover:bg-white/10 text-xs min-h-11 touch-manipulation px-3"
          onClick={() => navigate('/projects')}
          aria-label="Open jobs"
        >
          App
        </Button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-3 space-y-2">
        {bubbles.length === 0 && !sending && (
          <div className="mx-auto max-w-sm rounded-2xl bg-white/90 p-4 text-center shadow-sm mt-8">
            <CynthiaAvatar name={name} sizeClass="h-14 w-14" className="mx-auto mb-2 ring-2 ring-emerald-600/20" />
            <p className="text-sm font-semibold text-slate-900">{name}, I am here to help</p>
            <p className="text-xs text-slate-600 mt-1">
              Share a note, speak, or paste details. I can quote, create PDFs &amp; reports, email, call, and push cards when you&apos;re on the phone.
            </p>
          </div>
        )}

        {bubbles.map((b) => {
          if (b.kind === 'card' && b.message.card) {
            return (
              <div key={b.id} className="flex justify-start" data-cynthia-card={b.message.card.id}>
                <StaffActionCard
                  card={b.message.card}
                  highlight={highlightCardId === b.message.card.id}
                  onNavigate={(route) => navigate(route)}
                  onOpenPdf={(dataUrl, title) => setArtifact({ type: 'pdf', title, dataUrl })}
                  onOpenReport={(markdown, title) => setArtifact({ type: 'report', title, markdown })}
                />
              </div>
            );
          }
          if (b.kind === 'artifact' && b.message.artifact) {
            const art = b.message.artifact;
            return (
              <div key={b.id} className="flex justify-start">
                <button
                  type="button"
                  className="rounded-2xl bg-white border border-slate-200 px-3 py-2 text-left text-sm shadow-sm max-w-[85%]"
                  onClick={() => {
                    if (art.type === 'pdf' && art.dataUrl) setArtifact({ type: 'pdf', title: art.title, dataUrl: art.dataUrl });
                    if (art.type === 'report' && art.markdown) setArtifact({ type: 'report', title: art.title, markdown: art.markdown });
                  }}
                >
                  <span className="font-medium text-emerald-800">{art.title}</span>
                  <span className="block text-xs text-slate-500 mt-0.5">Tap to open {art.type}</span>
                </button>
              </div>
            );
          }
          if (b.kind === 'text') {
            const mine = b.role === 'user';
            return (
              <div key={b.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`rounded-2xl px-3 py-2 max-w-[85%] text-sm shadow-sm ${
                    mine
                      ? 'bg-[#dcf8c6] text-slate-900 rounded-br-md'
                      : 'bg-white text-slate-900 rounded-bl-md'
                  }`}
                >
                  <ChatMarkdown content={b.content} />
                </div>
              </div>
            );
          }
          return null;
        })}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-white px-3 py-2 shadow-sm flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {name} is working…
            </div>
          </div>
        )}

        {toolResults.length > 0 && (
          <div className="px-1">
            <ToolResultPanel results={toolResults.slice(0, 8)} onOpen={(route) => navigate(route)} />
          </div>
        )}

        {safetyPending.length > 0 && (
          <div className="mx-1 rounded-2xl bg-amber-50 border border-amber-200 p-3 space-y-2">
            <p className="text-xs font-semibold text-amber-900">Confirm these actions</p>
            {safetyPending.map((a, i) => (
              <div key={`${a.action}-${i}`} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0">
                  {getHumanActionLabel(a.action, a.output)}
                  {a.action === 'placeOutboundCall' && a.output?.to ? (
                    <span className="block text-amber-800/80 truncate">
                      {String(a.output.customerName || '')} {String(a.output.to)}
                    </span>
                  ) : null}
                </span>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    className="h-7"
                    onClick={async () => {
                      const execResult = await executeSafetyAction(a, buildRuntimeContext());
                      setToolResults((prev) => [execResult, ...prev]);
                      await handleToolOutputs([execResult]);
                      if (execResult.executed) toast.success(execResult.summary);
                      else toast.error(execResult.summary || 'Action failed');
                      setSafetyPending((prev) => prev.filter((_, j) => j !== i));
                    }}
                  >
                    YES
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    onClick={() => setSafetyPending((prev) => prev.filter((_, j) => j !== i))}
                  >
                    NO
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {fixJobs.length > 0 && (
          <div className="mx-1 rounded-2xl bg-slate-900 text-white p-3 text-xs space-y-1">
            <p className="font-semibold flex items-center gap-1"><Wrench className="h-3.5 w-3.5" /> Cursor code fixes</p>
            {fixJobs.map((entry) => (
              <div key={entry.id} className="flex justify-between gap-2 items-center">
                <span>
                  {entry.job ? statusLabel(entry.job.status) : '…'} — {entry.job?.description?.slice(0, 40)}
                </span>
                <div className="flex gap-1">
                  {entry.job?.status === 'failed' && (
                    <Button size="sm" variant="secondary" className="h-6 text-[10px]" onClick={() => void retryCodeFix(entry.id)}>Retry</Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px] text-white"
                    onClick={() => {
                      void dismissCodeFix(entry.id);
                      setFixJobs((p) => p.filter((x) => x.id !== entry.id));
                    }}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 relative bg-white px-3 py-3 border-t border-slate-200 space-y-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            void (async () => {
              try {
                const dataUrl = await readFileAsDataUrl(f);
                if (!dataUrl) {
                  toast.error('Could not read file');
                  return;
                }
                setPendingAttachments((prev) => [
                  ...prev,
                  { name: f.name, dataUrl, mime: f.type || 'application/octet-stream' },
                ]);
                toast.success(`${f.name} attached — send when ready`);
              } catch {
                toast.error('Could not attach file');
              }
            })();
          }}
        />
        {pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pendingAttachments.map((a) => (
              <button
                key={a.name + a.dataUrl.slice(-12)}
                type="button"
                className="text-[10px] bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1 shadow-sm"
                onClick={() => setPendingAttachments((prev) => prev.filter((x) => x.dataUrl !== a.dataUrl))}
                title="Remove attachment"
              >
                {a.name} ×
              </button>
            ))}
          </div>
        )}
        <ChatComposer
          value={composer}
          onChange={setComposer}
          onSend={() => void runSend(composer, 'cynthia')}
          loading={sending}
          disabled={sending}
          placeholder={`Message ${name}…`}
          canSend={!sending && (Boolean(composer.trim()) || pendingAttachments.length > 0)}
          leading={
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                className="inline-flex items-center justify-center size-9 rounded-full text-slate-500 hover:bg-slate-200/70 hover:text-slate-700 transition-colors"
                onClick={() => void pasteFromClipboard()}
                title="Paste"
                aria-label="Paste from clipboard"
              >
                <ClipboardPaste className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center size-9 rounded-full text-slate-500 hover:bg-slate-200/70 hover:text-slate-700 transition-colors"
                onClick={() => void attachPhoto()}
                title="Attach"
                aria-label="Attach photo"
              >
                {isNativeBridgeAvailable() ? <ImageIcon className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />}
              </button>
            </div>
          }
          trailing={
            <button
              type="button"
              disabled={sending || vapiStatus === 'connecting'}
              className={`inline-flex items-center justify-center size-9 rounded-full transition-colors disabled:opacity-50 ${
                vapiActive
                  ? 'bg-red-100 text-red-600'
                  : 'text-slate-500 hover:bg-slate-200/70 hover:text-slate-700'
              }`}
              title={vapiActive ? 'End Cynthia voice' : 'Talk to Cynthia (same phone voice)'}
              aria-label={vapiActive ? 'End Cynthia voice' : 'Talk to Cynthia'}
              onClick={() => { void toggleVapi(); }}
            >
              {vapiStatus === 'connecting' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : vapiActive ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
          }
        />
      </div>

      {artifact && <ArtifactViewer artifact={artifact} onClose={() => setArtifact(null)} />}
    </div>
  );
}
