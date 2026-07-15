import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Mic, MicOff, Paperclip, Send, ClipboardPaste, Image as ImageIcon, Loader2, Wrench,
} from 'lucide-react';
import { AppContext } from '../../App';
import { Button } from '../ui/button';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { useVoiceOutput } from '../../hooks/useVoiceOutput';
import { sendOrchestratorMessage, type CopilotAction } from '../../engine/ai/orchestratorService';
import {
  processToolActions,
  executeSafetyAction,
  type ToolExecutionResult,
  type ToolRuntimeContext,
} from '../../engine/ai/toolRuntime';
import { getHumanActionLabel } from '../../engine/ai/actionPolicy';
import { ChatMarkdown } from '../AI/ChatMarkdown';
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

type LocalBubble =
  | { id: string; kind: 'text'; role: 'user' | 'assistant'; content: string; ts: string }
  | { id: string; kind: 'card'; message: CynthiaStaffMessage }
  | { id: string; kind: 'artifact'; message: CynthiaStaffMessage };

/** Local copy of Builder Diddies staff photo from https://b-diddies.com */
const CYNTHIA_AVATAR_SRC = '/cynthia-avatar.png';

function cynthiaName(): string {
  return integrationService.getConfig('whatsapp').cyrusDisplayName || 'Cynthia';
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
        C
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
  const name = cynthiaName();

  const userId = app?.user.id || 'default-staff';
  const [composer, setComposer] = useState('');
  const [sending, setSending] = useState(false);
  const [bubbles, setBubbles] = useState<LocalBubble[]>([]);
  const [toolResults, setToolResults] = useState<ToolExecutionResult[]>([]);
  const [safetyPending, setSafetyPending] = useState<CopilotAction[]>([]);
  const [artifact, setArtifact] = useState<OpenArtifact | null>(null);
  const [fixJobs, setFixJobs] = useState<Array<{ id: string; job?: CodeFixJob }>>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    approvedBy: app?.user.name ?? 'Cynthia',
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
    app, navigate, agentContext.role,
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
    const id = window.setInterval(() => { void reloadThread(); }, 8000);
    return () => window.clearInterval(id);
  }, [reloadThread]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [bubbles, toolResults, sending]);

  const ingestConsumed = useRef(false);
  useEffect(() => {
    if (!ingestText.trim() || ingestConsumed.current) return;
    ingestConsumed.current = true;
    const text = ingestText.trim();
    setComposer(text);
    toast.message(`${name} ready`, { description: 'Shared content loaded — send to process.' });
  }, [ingestText, name]);

  const onVoice = useCallback((text: string) => {
    if (text) setComposer((prev) => (prev ? `${prev} ${text}` : text));
  }, []);
  const {
    isListening,
    isTranscribing,
    startListening,
    stopListening,
    isSupported,
    isNative,
  } = useVoiceInput(onVoice, {
    onError: (message) => toast.error(message),
  });
  const { speak } = useVoiceOutput();

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
    if (!trimmed || sending || !app) return;
    setSending(true);
    setComposer('');
    const localId = `local_${Date.now()}`;
    setBubbles((prev) => [
      ...prev,
      { id: localId, kind: 'text', role: 'user', content: trimmed, ts: new Date().toISOString() },
    ]);
    void postCynthiaMessage(userId, { role: 'user', content: trimmed, source });

    try {
      const history = [
        ...bubbles
          .filter((b): b is Extract<LocalBubble, { kind: 'text' }> => b.kind === 'text')
          .slice(-16)
          .map((b) => ({ role: b.role, content: b.content })),
        { role: 'user', content: trimmed },
      ];

      const orchestratorResult = await sendOrchestratorMessage(history, agentContext, {
        userName: app.user.name,
        userId: app.user.id,
        companyName: 'Builder Diddies',
        orchestratorMode: 'staff',
        channel: 'overlay_chat',
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

      if (source === 'voice') void speak(reply, 'auto');
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
        toast.message('Photo captured — tell Cynthia what to do');
        setComposer((c) => `${c}\n[Photo attached: ${shot.fileName || 'camera.jpg'} — please review/price]`.trim());
      }
      return;
    }
    fileRef.current?.click();
  };

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
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] md:h-[min(100dvh,920px)] max-w-3xl mx-auto bg-[#e5ddd5] relative">
      <header className="shrink-0 flex items-center gap-3 px-3 py-2.5 bg-[#075e54] text-white shadow">
        <CynthiaAvatar name={name} sizeClass="h-10 w-10" className="ring-2 ring-white/25" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{name}</p>
          <p className="text-[11px] text-emerald-100 truncate">Runs the whole operation · chat first</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-white hover:bg-white/10 text-xs"
          onClick={() => navigate('/projects')}
        >
          App
        </Button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-3 space-y-2">
        {bubbles.length === 0 && !sending && (
          <div className="mx-auto max-w-sm rounded-2xl bg-white/90 p-4 text-center shadow-sm mt-8">
            <CynthiaAvatar name={name} sizeClass="h-14 w-14" className="mx-auto mb-2 ring-2 ring-emerald-600/20" />
            <p className="text-sm font-semibold text-slate-900">Hi — I&apos;m {name}</p>
            <p className="text-xs text-slate-600 mt-1">
              Share a note, speak, or paste details. I can quote, create PDFs &amp; reports, email, call, and push cards when you&apos;re on the phone.
            </p>
          </div>
        )}

        {bubbles.map((b) => {
          if (b.kind === 'card' && b.message.card) {
            return (
              <div key={b.id} className="flex justify-start">
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

      <div className="shrink-0 bg-[#f0f2f5] px-2 py-2 flex items-end gap-1.5 border-t border-slate-200">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setComposer((c) => `${c}\n[Attached: ${f.name} — tell me what to do]`.trim());
              toast.message(`${f.name} noted`);
            }
          }}
        />
        <Button type="button" size="icon" variant="ghost" className="shrink-0 rounded-full" onClick={() => void pasteFromClipboard()} title="Paste">
          <ClipboardPaste className="h-5 w-5 text-slate-600" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="shrink-0 rounded-full" onClick={() => void attachPhoto()} title="Attach">
          {isNativeBridgeAvailable() ? <ImageIcon className="h-5 w-5 text-slate-600" /> : <Paperclip className="h-5 w-5 text-slate-600" />}
        </Button>
        <textarea
          value={composer}
          onChange={(e) => setComposer(e.target.value)}
          rows={1}
          placeholder={`Message ${name}…`}
          className="flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm max-h-28 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void runSend(composer, 'cynthia');
            }
          }}
        />
        {isSupported ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={isTranscribing || sending}
            className={`shrink-0 rounded-full ${isListening || isTranscribing ? 'bg-red-100 text-red-600' : ''}`}
            title={isNative ? 'Hold to speak' : 'Voice input'}
            onClick={() => {
              if (isNative) return;
              if (isListening) void stopListening();
              else void startListening();
            }}
            onPointerDown={(e) => {
              if (!isNative) return;
              e.preventDefault();
              void startListening();
            }}
            onPointerUp={() => {
              if (!isNative) return;
              void stopListening();
            }}
            onPointerLeave={() => {
              if (!isNative || !isListening) return;
              void stopListening();
            }}
            onPointerCancel={() => {
              if (!isNative || !isListening) return;
              void stopListening();
            }}
          >
            {isTranscribing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isListening ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5 text-slate-600" />
            )}
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="shrink-0 rounded-full opacity-50"
            title="Voice not available"
            onClick={() => toast.error('Voice input is not supported here — type your message instead')}
          >
            <Mic className="h-5 w-5 text-slate-400" />
          </Button>
        )}
        <Button
          type="button"
          size="icon"
          className="shrink-0 rounded-full bg-[#075e54] hover:bg-[#064e46]"
          disabled={sending || !composer.trim()}
          onClick={() => void runSend(composer, isListening || isTranscribing ? 'voice' : 'cynthia')}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

      {artifact && <ArtifactViewer artifact={artifact} onClose={() => setArtifact(null)} />}
    </div>
  );
}
