import { useState, useContext, useEffect } from 'react';
import { AppContext } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { MessageCircle, User, FileText, Loader2, RefreshCw } from 'lucide-react';
import { getAllConversationThreads, findCustomerByPhone } from '../engine/cyrus/cyrusChatService';
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

export default function CyrusConversations() {
  const context = useContext(AppContext);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [threads, setThreads] = useState<ReturnType<typeof getAllConversationThreads>>([]);
  const [summaryRecord, setSummaryRecord] = useState<ChatSummaryRecord | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    const list = getAllConversationThreads();
    setThreads(list);
    if (list.length > 0 && !selectedPhone) setSelectedPhone(list[0].phone);
  }, [selectedPhone]);

  useEffect(() => {
    if (!selectedPhone) {
      setSummaryRecord(null);
      setSummaryError(null);
      return;
    }
    setSummaryRecord(getCachedSummary(selectedPhone) ?? null);
    setSummaryError(null);
  }, [selectedPhone]);

  if (!context) return null;
  const { customers, updateCustomer } = context;
  const cyrusName = integrationService.getConfig('whatsapp').cyrusDisplayName || 'Cyrus';

  const selectedThread = threads.find(t => t.phone === selectedPhone);
  const selectedCustomer = selectedThread
    ? findCustomerByPhone(customers, selectedThread.phone)
    : undefined;
  const summaryIsStale = selectedThread
    ? isSummaryStale(selectedThread.phone, selectedThread.messages.length)
    : false;

  const handleGenerateSummary = async () => {
    if (!selectedThread) return;

    setSummaryLoading(true);
    setSummaryError(null);

    try {
      const record = await generateThreadSummary(
        selectedThread.phone,
        selectedThread.messages,
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <MessageCircle className="w-8 h-8 text-green-600" />
          {cyrusName} Conversations
        </h1>
        <p className="text-gray-600 mt-1">WhatsApp threads with clients — powered by Cyrus AI</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Threads ({threads.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {threads.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">
                No conversations yet. Use Integrations → WhatsApp → Simulate inbound message to test Cyrus.
              </p>
            ) : (
              <div className="divide-y max-h-[600px] overflow-auto">
                {threads.map(({ phone, messages, contactName, contactRole }) => {
                  const customer = findCustomerByPhone(customers, phone);
                  const activeProject = customer ? getActiveProjectForCustomer(customer.id) : undefined;
                  const hasRecentCyrusAudit = Boolean(activeProject?.aiActions?.some((action) => (
                    action.action === 'cyrusReply'
                    && Date.now() - new Date(action.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000
                  )));
                  const last = messages[messages.length - 1];
                  const displayName = contactName && contactName !== customer?.name
                    ? `${contactName} (${contactRole}) — ${customer?.name ?? 'Guest'}`
                    : (customer?.name ?? contactName ?? phone);
                  const threadHasSummary = hasCachedSummary(phone);
                  const threadSummaryStale = isSummaryStale(phone, messages.length);

                  return (
                    <button
                      key={phone}
                      type="button"
                      className={`w-full text-left p-4 hover:bg-gray-50 ${selectedPhone === phone ? 'bg-green-50' : ''}`}
                      onClick={() => setSelectedPhone(phone)}
                    >
                      <p className="font-medium flex items-center gap-2 flex-wrap">
                        <span>{displayName}</span>
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
                      <p className="text-xs text-gray-400">{phone}</p>
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
            <CardTitle className="text-lg flex items-center gap-2">
              {selectedThread ? (
                <>
                  <User className="w-4 h-4" />
                  {selectedCustomer?.name ?? selectedThread.phone}
                </>
              ) : (
                'Select a thread'
              )}
            </CardTitle>
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
                            <>
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              Generating...
                            </>
                          ) : summaryRecord ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-1" />
                              Refresh summary
                            </>
                          ) : (
                            <>
                              <FileText className="w-4 h-4 mr-1" />
                              Generate summary
                            </>
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
                        Generate an AI summary so other staff can quickly understand this conversation
                        without reading every message.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <div className="space-y-3 max-h-[500px] overflow-auto">
                  {selectedThread.messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                          msg.role === 'user'
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        {msg.role === 'assistant' && (
                          <Badge variant="outline" className="mb-1 text-xs">{cyrusName}</Badge>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-green-100' : 'text-gray-400'}`}>
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
