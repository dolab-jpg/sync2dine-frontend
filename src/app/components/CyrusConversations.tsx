import { useState, useContext, useEffect, useCallback } from 'react';
import { AppContext } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  MessageCircle, User, FileText, Loader2, RefreshCw, Mic, MicOff, Send, Bot, UserRoundCog,
} from 'lucide-react';
import { findCustomerByPhone, getAllConversationThreads } from '../engine/cyrus/cyrusChatService';
import { integrationService } from '../engine/integrations/integrationService';
import { getActiveProjectForCustomer } from '../engine/project/projectStore';
import {
  generateThreadSummary,
  getCachedSummary,
  hasCachedSummary,
  isSummaryStale,
  syncSummaryToCustomerNotes,
  type ChatSummaryRecord,
} from '../engine/cyrus/conversationSummaryService';
import {
  askCyrusOnThread,
  fetchCyrusThreads,
  setThreadHandoff,
  staffReplyToThread,
  type ServerThread,
} from '../engine/cyrus/cyrusThreadApi';
import { checkOpenAIConnection, type OpenAIConnectionState } from '../engine/ai/openaiConnectionService';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useVoiceOutput } from '../hooks/useVoiceOutput';
import { toast } from 'sonner';

function mergeThreads(server: ServerThread[], localFallback: ReturnType<typeof getAllConversationThreads>): ServerThread[] {
  if (server.length > 0) return server;
  return localFallback.map((t) => ({
    sessionId: t.phone,
    phone: t.phone,
    orgId: 'local',
    channel: 'whatsapp',
    contactName: t.contactName,
    handoffMode: 'ai_active' as const,
    messages: t.messages.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      channel: 'whatsapp',
    })),
    lastAt: t.lastAt,
    updatedAt: t.lastAt,
  }));
}

export default function CyrusConversations() {
  const context = useContext(AppContext);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ServerThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryRecord, setSummaryRecord] = useState<ChatSummaryRecord | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [composer, setComposer] = useState('');
  const [sending, setSending] = useState(false);
  const [openaiState, setOpenaiState] = useState<OpenAIConnectionState | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const server = await fetchCyrusThreads();
      const merged = mergeThreads(server, getAllConversationThreads());
      setThreads(merged);
      setSelectedId((prev) => {
        if (prev && merged.some((t) => t.sessionId === prev || t.phone === prev)) return prev;
        return merged[0]?.sessionId ?? null;
      });
    } catch {
      const merged = mergeThreads([], getAllConversationThreads());
      setThreads(merged);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const id = window.setInterval(() => { void reload(); }, 15000);
    return () => window.clearInterval(id);
  }, [reload]);

  useEffect(() => {
    void checkOpenAIConnection({ role: context?.user?.role }).then(setOpenaiState);
  }, [context?.user?.role]);

  useEffect(() => {
    if (!selectedId) {
      setSummaryRecord(null);
      setSummaryError(null);
      return;
    }
    setSummaryRecord(getCachedSummary(selectedId) ?? null);
    setSummaryError(null);
  }, [selectedId]);

  const onVoice = useCallback((text: string) => {
    if (text) setComposer((prev) => (prev ? `${prev} ${text}` : text));
  }, []);
  const { isListening, startListening, stopListening, isSupported } = useVoiceInput(onVoice, {
    onError: (message) => toast.error(message),
  });
  const { speak } = useVoiceOutput();

  if (!context) return null;
  const { customers, updateCustomer, user } = context;
  const userRole = user.role;
  const cyrusName = integrationService.getConfig('whatsapp').cyrusDisplayName || 'Cynthia';

  const selectedThread = threads.find((t) => t.sessionId === selectedId || t.phone === selectedId);
  const selectedCustomer = selectedThread
    ? findCustomerByPhone(customers, selectedThread.phone)
    : undefined;
  const summaryIsStale = selectedThread
    ? isSummaryStale(selectedThread.sessionId, selectedThread.messages.length)
    : false;

  const handleGenerateSummary = async () => {
    if (!selectedThread) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const msgs = selectedThread.messages.map((m) => ({
        id: m.timestamp,
        role: m.role === 'system' ? 'assistant' as const : m.role,
        content: m.content,
        timestamp: m.timestamp,
        phone: selectedThread.phone,
      }));
      const record = await generateThreadSummary(
        selectedThread.sessionId,
        msgs,
        selectedCustomer?.name ?? selectedThread.contactName,
      );
      setSummaryRecord(record);
      if (selectedCustomer) {
        syncSummaryToCustomerNotes(selectedCustomer, record, updateCustomer);
      }
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  const sendStaff = async () => {
    if (!selectedThread || !composer.trim()) return;
    setSending(true);
    try {
      await staffReplyToThread(selectedThread.sessionId, composer.trim(), user.name);
      setComposer('');
      await reload();
      toast.success('Reply sent — thread is in human takeover');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const askCyrus = async () => {
    if (!selectedThread || !composer.trim()) return;
    setSending(true);
    try {
      const data = await askCyrusOnThread(selectedThread.sessionId, composer.trim());
      setComposer('');
      await reload();
      if (data.reply) {
        const voiceMode = (integrationService.getConfig('openai').ttsVoice
          ? 'openai'
          : 'browser') as 'openai' | 'browser';
        void speak(data.reply, voiceMode);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cynthia failed — check OpenAI in Integrations');
      void checkOpenAIConnection({ role: userRole }).then(setOpenaiState);
    } finally {
      setSending(false);
    }
  };

  const toggleHandoff = async () => {
    if (!selectedThread) return;
    const next = selectedThread.handoffMode === 'human_takeover' ? 'ai_active' : 'human_takeover';
    try {
      await setThreadHandoff(selectedThread.sessionId, next);
      await reload();
      toast.success(next === 'human_takeover' ? 'You own this chat' : `${cyrusName} is handling replies again`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Handoff update failed');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <MessageCircle className="w-8 h-8 text-green-600" />
            {cyrusName} Conversations
          </h1>
          <p className="text-gray-600 mt-1">
            Live inbox — website and portal — powered by OpenAI via Cynthia
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {openaiState && openaiState.status !== 'connected' && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {openaiState.message ?? 'AI brain not connected.'}
          {' '}
          Add your API key in <strong>Settings → Integrations → Company AI Brain</strong> and Save.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Threads ({threads.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading && threads.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </p>
            ) : threads.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">
                No conversations yet. Use Integrations → WhatsApp → Simulate inbound, the website embed,
                or portal Ask Cynthia.
              </p>
            ) : (
              <div className="divide-y max-h-[600px] overflow-auto">
                {threads.map((thread) => {
                  const customer = findCustomerByPhone(customers, thread.phone);
                  const activeProject = customer ? getActiveProjectForCustomer(customer.id) : undefined;
                  const hasRecentCyrusAudit = Boolean(activeProject?.aiActions?.some((action) => (
                    action.action === 'cyrusReply'
                    && Date.now() - new Date(action.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000
                  )));
                  const last = thread.messages[thread.messages.length - 1];
                  const displayName = thread.contactName && thread.contactName !== customer?.name
                    ? `${thread.contactName} — ${customer?.name ?? 'Guest'}`
                    : (customer?.name ?? thread.contactName ?? thread.phone);
                  const threadHasSummary = hasCachedSummary(thread.sessionId);
                  const threadSummaryStale = isSummaryStale(thread.sessionId, thread.messages.length);

                  return (
                    <button
                      key={thread.sessionId}
                      type="button"
                      className={`w-full text-left p-4 hover:bg-gray-50 ${selectedId === thread.sessionId ? 'bg-green-50' : ''}`}
                      onClick={() => setSelectedId(thread.sessionId)}
                    >
                      <p className="font-medium flex items-center gap-2 flex-wrap">
                        <span>{displayName}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">{thread.channel}</Badge>
                        {thread.handoffMode === 'human_takeover' && (
                          <Badge className="text-[10px] bg-blue-100 text-blue-800">Human</Badge>
                        )}
                        {threadHasSummary && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <FileText className="w-3 h-3" />
                            Summary
                          </Badge>
                        )}
                        {threadSummaryStale && (
                          <Badge variant="secondary" className="text-[10px]">Outdated</Badge>
                        )}
                        {hasRecentCyrusAudit && (
                          <Badge variant="secondary" className="text-[10px]">Audit</Badge>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">{thread.phone}</p>
                      <p className="text-sm text-gray-600 truncate">{last?.content}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {last ? new Date(last.timestamp).toLocaleString() : ''}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                {selectedThread ? (
                  <>
                    <User className="w-4 h-4" />
                    {selectedCustomer?.name ?? selectedThread.contactName ?? selectedThread.phone}
                  </>
                ) : (
                  'Select a thread'
                )}
              </CardTitle>
              {selectedThread && (
                <Button type="button" size="sm" variant="outline" onClick={() => void toggleHandoff()}>
                  {selectedThread.handoffMode === 'human_takeover' ? (
                    <><Bot className="w-4 h-4 mr-1" /> Return to {cyrusName}</>
                  ) : (
                    <><UserRoundCog className="w-4 h-4 mr-1" /> Take over</>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedThread ? (
              <p className="text-gray-500 text-center py-12">Select a conversation to view messages</p>
            ) : (
              <div className="space-y-4">
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="w-4 h-4 text-amber-700" />
                          Conversation Summary
                        </CardTitle>
                        {summaryRecord && (
                          <p className="text-xs text-gray-500 mt-1">
                            Generated {new Date(summaryRecord.generatedAt).toLocaleString()}
                            {' · '}
                            {summaryRecord.messageCount} messages
                            {selectedCustomer && ' · synced to CRM notes'}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {summaryIsStale && (
                          <Badge variant="secondary" className="text-xs">Outdated</Badge>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleGenerateSummary}
                          disabled={summaryLoading || selectedThread.messages.length === 0}
                        >
                          {summaryLoading ? (
                            <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Generating...</>
                          ) : summaryRecord ? (
                            <><RefreshCw className="w-4 h-4 mr-1" /> Refresh summary</>
                          ) : (
                            <><FileText className="w-4 h-4 mr-1" /> Generate summary</>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {summaryError && (
                      <p className="text-sm text-red-600 mb-2">{summaryError}</p>
                    )}
                    {summaryRecord ? (
                      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                        {summaryRecord.summary}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-600">
                        Generate an AI summary so other staff can quickly understand this conversation.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <div className="space-y-3 max-h-[360px] overflow-auto">
                  {selectedThread.messages.map((msg, idx) => {
                    const isUser = msg.role === 'user';
                    const isStaff = msg.fromRole === 'staff';
                    return (
                      <div
                        key={`${msg.timestamp}-${idx}`}
                        className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                            isUser
                              ? 'bg-green-600 text-white'
                              : isStaff
                                ? 'bg-blue-100 text-blue-950'
                                : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          {!isUser && (
                            <Badge variant="outline" className="mb-1 text-xs">
                              {isStaff ? 'Staff' : msg.fromRole === 'system' ? 'System' : cyrusName}
                            </Badge>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <p className={`text-xs mt-1 ${isUser ? 'text-green-100' : 'text-gray-400'}`}>
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t pt-3 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={composer}
                      onChange={(e) => setComposer(e.target.value)}
                      placeholder="Type a reply or ask Cynthia…"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void sendStaff();
                        }
                      }}
                    />
                    {isSupported && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => (isListening ? stopListening() : startListening())}
                        title="Dictate (Speak)"
                      >
                        {isListening ? <MicOff className="w-4 h-4 text-red-600" /> : <Mic className="w-4 h-4" />}
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => void sendStaff()} disabled={sending || !composer.trim()}>
                      <Send className="w-4 h-4 mr-1" />
                      Send as staff
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void askCyrus()}
                      disabled={sending || !composer.trim() || openaiState?.status === 'missing'}
                    >
                      <Bot className="w-4 h-4 mr-1" />
                      Ask {cyrusName}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
