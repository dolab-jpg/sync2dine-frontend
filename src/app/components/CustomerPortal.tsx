import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { getProjectByPortalToken, updateProject } from '../engine/project/projectStore';
import { notifyProjectEvent } from '../engine/notifications/notify';
import {
  addProjectToPortfolio,
  appendFinalInvoiceIfMissing,
  markCustomerForRepeatBusiness,
  settleBuilderPayments,
} from '../engine/project/completionService';
import { markDepositPaidOnProject } from '../engine/salesCloseFlow';
import { integrationService } from '../engine/integrations/integrationService';
import type { ChangeOrder, UnifiedProject } from '../engine/project/types';
import { toast } from 'sonner';
import {
  fetchPortalCyrusThread,
  sendPortalCyrusMessage,
  type ServerConversationMessage,
} from '../engine/cyrus/cyrusThreadApi';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useVoiceOutput } from '../hooks/useVoiceOutput';
import { Mic, MicOff } from 'lucide-react';

type CustomerDecision = 'approved' | 'rejected';

function isPendingCustomerDecision(order: ChangeOrder): boolean {
  return order.status === 'pending_customer';
}

function isSiteUpdateMessage(message: UnifiedProject['messages'][number]): boolean {
  return message.fromRole === 'office' && (message.channel === 'whatsapp' || message.channel === 'email');
}

export default function CustomerPortal() {
  const { token } = useParams<{ token: string }>();
  const [project, setProject] = useState<UnifiedProject | null>(null);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [isUpdatingChangeOrder, setIsUpdatingChangeOrder] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const notifiedPendingChangeOrders = useRef<Set<string>>(new Set());
  const [cyrusMessages, setCyrusMessages] = useState<ServerConversationMessage[]>([]);
  const [cyrusInput, setCyrusInput] = useState('');
  const [cyrusBusy, setCyrusBusy] = useState(false);
  const cyrusName = integrationService.getConfig('whatsapp').cyrusDisplayName || 'Cynthia';
  const { speak } = useVoiceOutput();
  const onCyrusVoice = useCallback((text: string) => {
    if (text) setCyrusInput((prev) => (prev ? `${prev} ${text}` : text));
  }, []);
  const { isListening, startListening, stopListening, isSupported } = useVoiceInput(onCyrusVoice);

  const refreshProject = useCallback(() => {
    if (!token) return;
    const local = getProjectByPortalToken(token);
    if (local) {
      setProject(local);
      setError('');
      return;
    }

    fetch(`/api/portal/${token}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(() => {
        const refreshed = getProjectByPortalToken(token);
        if (refreshed) {
          setProject(refreshed);
          setError('');
        } else {
          setError('Invalid or expired link');
        }
      })
      .catch(() => setError('Invalid or expired link'));
  }, [token]);

  useEffect(() => {
    refreshProject();
  }, [refreshProject]);

  useEffect(() => {
    if (!token) return;
    void fetchPortalCyrusThread(token).then((data) => {
      setCyrusMessages(data.messages ?? []);
    });
  }, [token]);

  useEffect(() => {
    if (!project || searchParams.get('deposit') !== 'paid') return;
    const due = project.paymentStages.find((s) => s.status === 'due');
    if (due) {
      markDepositPaidOnProject(project.id);
      toast.success('Deposit payment received — booking confirmed');
      refreshProject();
    }
    searchParams.delete('deposit');
    setSearchParams(searchParams, { replace: true });
  }, [project, searchParams, setSearchParams, refreshProject]);

  useEffect(() => {
    if (!token) return;
    const intervalId = window.setInterval(() => {
      refreshProject();
    }, 30000);
    const handleFocus = () => refreshProject();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshProject();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshProject, token]);

  const pendingChangeOrders = useMemo(
    () => (project?.changeOrders ?? []).filter(isPendingCustomerDecision),
    [project?.changeOrders]
  );
  const duePaymentStages = useMemo(
    () => (project?.paymentStages ?? []).filter(stage => stage.status === 'due'),
    [project?.paymentStages]
  );
  const nextUnpaidStage = useMemo(
    () => (project?.paymentStages ?? []).find(stage => stage.status !== 'paid'),
    [project?.paymentStages]
  );
  const siteUpdateMessages = useMemo(
    () => (project?.messages ?? []).filter(isSiteUpdateMessage).slice(-3).reverse(),
    [project?.messages]
  );

  useEffect(() => {
    if (!project) return;
    const tracked = notifiedPendingChangeOrders.current;
    const currentPendingIds = new Set(pendingChangeOrders.map(order => order.id));
    for (const trackedId of Array.from(tracked)) {
      if (!currentPendingIds.has(trackedId)) tracked.delete(trackedId);
    }
    for (const order of pendingChangeOrders) {
      if (tracked.has(order.id)) continue;
      notifyProjectEvent(
        'customer_action_required',
        'Customer approval required',
        `${project.projectName}: ${order.title}`,
        { projectId: project.id, route: '/portal', changeOrderId: order.id }
      );
      tracked.add(order.id);
    }
  }, [pendingChangeOrders, project]);

  const sendReply = () => {
    if (!project || !reply.trim()) return;
    const msg = {
      id: `PM${Date.now()}`,
      from: project.customerName,
      fromRole: 'customer' as const,
      body: reply.trim(),
      timestamp: new Date().toISOString(),
      channel: 'portal' as const,
    };
    const updated = updateProject(project.id, { messages: [...project.messages, msg] });
    if (updated) {
      setProject(updated);
      setReply('');
    }
  };

  const handleChangeOrderDecision = (changeOrderId: string, decision: CustomerDecision) => {
    if (!project || !project.changeOrders) return;
    const selectedOrder = project.changeOrders.find(order => order.id === changeOrderId);
    if (!selectedOrder || selectedOrder.status !== 'pending_customer') return;

    setIsUpdatingChangeOrder(changeOrderId);
    const now = new Date().toISOString();
    const isApproved = decision === 'approved';
    const nextPaymentStages = isApproved
      ? [
          ...project.paymentStages,
          {
            id: `PS_CO_${Date.now()}`,
            name: `Change order - ${selectedOrder.title}`,
            percentage: 0,
            amount: selectedOrder.amount,
            status: 'pending' as const,
            notes: 'Added automatically after approved change order',
          },
        ]
      : project.paymentStages;

    const updated = updateProject(project.id, {
      changeOrders: project.changeOrders.map(order =>
        order.id === changeOrderId
          ? {
              ...order,
              status: decision,
              customerDecisionAt: now,
              customerDecisionBy: project.customerName,
            }
          : order
      ),
      totalCustomerCost: isApproved
        ? project.totalCustomerCost + selectedOrder.amount
        : project.totalCustomerCost,
      paymentStages: nextPaymentStages,
    });
    if (updated) setProject(updated);
    setIsUpdatingChangeOrder(null);
  };

  async function sendCyrus() {
    if (!token || !cyrusInput.trim()) return;
    const text = cyrusInput.trim();
    setCyrusBusy(true);
    setCyrusInput('');
    try {
      const data = await sendPortalCyrusMessage(token, text);
      setCyrusMessages(data.messages ?? []);
      if (data.reply) {
        const voiceMode = (integrationService.getConfig('openai').ttsVoice
          ? 'openai'
          : 'browser') as 'openai' | 'browser';
        void speak(data.reply, voiceMode);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${cyrusName} is unavailable`);
    } finally {
      setCyrusBusy(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-slate-600">{error}</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-slate-500">Loading your project...</p>
      </div>
    );
  }

  const hasActionRequired = pendingChangeOrders.length > 0 || duePaymentStages.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 p-4 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">{project.projectName}</h1>
        <p className="text-sm text-slate-600">Hi {project.customerName} - your project portal</p>
      </div>

      <div className="grid gap-4 mb-6">
        {hasActionRequired && (
          <Card className="border-amber-300 bg-amber-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-amber-900">Action required</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-amber-900 space-y-1">
              {pendingChangeOrders.length > 0 && (
                <p>
                  {pendingChangeOrders.length} change order{pendingChangeOrders.length > 1 ? 's' : ''} awaiting your approval.
                </p>
              )}
              {duePaymentStages.length > 0 && (
                <p>
                  {duePaymentStages.length} payment stage{duePaymentStages.length > 1 ? 's are' : ' is'} due.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {project.status === 'handover' && (
          <Card className="border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Handover sign-off</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>Please confirm you are happy with the completed work. This releases the final payment stage.</p>
              <Button
                className="w-full"
                onClick={() => {
                  const finalStage = project.paymentStages?.find((s) => s.name.toLowerCase().includes('completion') || s.name.toLowerCase().includes('final'));
                  const paymentStages = (project.paymentStages ?? []).map((s) =>
                    s.id === finalStage?.id ? { ...s, status: 'due' as const } : s,
                  );
                  const invoices = appendFinalInvoiceIfMissing(project, finalStage);
                  const updated = updateProject(project.id, {
                    status: 'completed',
                    handover: { signedAt: new Date().toISOString(), signedBy: project.customerName, retentionReleased: true },
                    paymentStages,
                    invoices,
                    builderPayments: settleBuilderPayments(project),
                    warranty: { durationMonths: 12, startDate: new Date().toISOString().split('T')[0], notes: 'Standard workmanship warranty' },
                    archivedAt: new Date().toISOString(),
                  });
                  if (updated) {
                    markCustomerForRepeatBusiness(project.customerId);
                    addProjectToPortfolio(updated);
                    setProject(updated);
                  }
                }}
              >
                Sign off & complete project
              </Button>
            </CardContent>
          </Card>
        )}

        {project.status === 'completed' && !project.review && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Leave a review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input type="number" min={1} max={5} value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))} />
              <Input placeholder="Tell us about your experience" value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const updated = updateProject(project.id, {
                    review: { rating: reviewRating, comment: reviewComment, submittedAt: new Date().toISOString() },
                  });
                  if (updated) setProject(updated);
                }}
              >
                Submit review
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Progress</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>Status: <strong>{project.status}</strong></p>
            <p>{project.startDate} → {project.finishDate}</p>
          </CardContent>
        </Card>

        {project.tasks.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Today's plan</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              {project.tasks.filter(t => t.status !== 'completed').slice(0, 5).map(t => (
                <p key={t.id}>• {t.title}</p>
              ))}
            </CardContent>
          </Card>
        )}

        {project.files.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Files & photos</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2">
              {project.files.filter(f => f.mimeType.startsWith('image/')).map(f => (
                f.dataUrl ? (
                  <img key={f.id} src={f.dataUrl} alt={f.filename} className="rounded aspect-square object-cover" />
                ) : null
              ))}
            </CardContent>
          </Card>
        )}

        {nextUnpaidStage && (
          <Card className={nextUnpaidStage.status === 'due' ? 'border-amber-300 bg-amber-50' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {/deposit|booking/i.test(nextUnpaidStage.name) ? 'Booking deposit' : 'Payment due'}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">{nextUnpaidStage.name}</p>
                <Badge variant={nextUnpaidStage.status === 'due' ? 'secondary' : 'outline'} className="capitalize">
                  {nextUnpaidStage.status}
                </Badge>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                £{nextUnpaidStage.amount.toLocaleString('en-GB')}
              </p>
              {nextUnpaidStage.dueDate && (
                <p>Due: {new Date(nextUnpaidStage.dueDate).toLocaleDateString('en-GB')}</p>
              )}
              {nextUnpaidStage.status === 'due' && (
                <>
                  <div className="rounded-lg bg-white border p-3 text-slate-700 space-y-1">
                    <p className="font-medium text-slate-900">How to pay</p>
                    <p>
                      Bank transfer to{' '}
                      {integrationService.getConfig('company').companyName || 'Builder Diddies'}
                      {integrationService.getConfig('company').email
                        ? ` — use your name as the reference, or email ${integrationService.getConfig('company').email}`
                        : ' — use your surname and postcode as the payment reference'}
                      .
                    </p>
                    <p className="text-xs text-slate-500">
                      Card checkout can be enabled when Stripe customer payments are connected; until then
                      transfer or pay your salesperson.
                    </p>
                  </div>
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={async () => {
                      // Prefer Stripe Checkout when available
                      try {
                        const res = await fetch('/api/project-deposit-checkout', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            portalToken: token,
                            projectId: project.id,
                            stageId: nextUnpaidStage.id,
                            amount: nextUnpaidStage.amount,
                          }),
                        });
                        if (res.ok) {
                          const data = (await res.json()) as { url?: string };
                          if (data.url) {
                            window.location.href = data.url;
                            return;
                          }
                        }
                      } catch {
                        /* fall through to mark paid */
                      }
                      const ok = markDepositPaidOnProject(project.id);
                      if (ok) {
                        notifyProjectEvent(
                          'payment_stage_due',
                          'Deposit paid',
                          `${project.customerName} confirmed booking deposit £${nextUnpaidStage.amount.toLocaleString('en-GB')}`,
                          { projectId: project.id },
                        );
                        toast.success('Thank you — deposit marked paid. Your booking is confirmed.');
                        refreshProject();
                      } else {
                        toast.error('Could not update payment');
                      }
                    }}
                  >
                    Pay / confirm deposit paid
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {pendingChangeOrders.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Pending change orders</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingChangeOrders.map(order => (
                <div key={order.id} className="rounded border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{order.title}</p>
                    <Badge variant="outline" className="capitalize">{order.status.replace('_', ' ')}</Badge>
                  </div>
                  {order.description && <p className="text-sm text-slate-600">{order.description}</p>}
                  <p className="text-sm text-slate-700">Amount: £{order.amount.toLocaleString()}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleChangeOrderDecision(order.id, 'approved')}
                      disabled={isUpdatingChangeOrder === order.id}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleChangeOrderDecision(order.id, 'rejected')}
                      disabled={isUpdatingChangeOrder === order.id}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {siteUpdateMessages.length > 0 && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Latest site updates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {siteUpdateMessages.map(message => (
                <div key={message.id} className="rounded border border-blue-200 bg-white p-2 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary">Site update</Badge>
                    <p className="text-xs text-slate-500">{new Date(message.timestamp).toLocaleString('en-GB')}</p>
                  </div>
                  <p>{message.body}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="border-green-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Ask {cyrusName}</CardTitle>
          <p className="text-xs text-slate-500">
            Quick answers about your project — the office can also take over from Cynthia.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-h-56 overflow-y-auto space-y-2">
            {cyrusMessages.length === 0 ? (
              <p className="text-sm text-slate-500">Ask about schedule, payments, or next steps.</p>
            ) : (
              cyrusMessages.map((m, idx) => (
                <div
                  key={`${m.timestamp}-${idx}`}
                  className={`text-sm p-2 rounded ${
                    m.role === 'user' ? 'bg-green-50 ml-6' : 'bg-white border mr-6'
                  }`}
                >
                  <p className="text-xs font-medium text-slate-500 mb-1">
                    {m.role === 'user' ? 'You' : cyrusName}
                  </p>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={cyrusInput}
              onChange={e => setCyrusInput(e.target.value)}
              placeholder={`Message ${cyrusName}…`}
              onKeyDown={e => {
                if (e.key === 'Enter') void sendCyrus();
              }}
              disabled={cyrusBusy}
            />
            {isSupported && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => (isListening ? stopListening() : startListening())}
                title="Speak"
              >
                {isListening ? <MicOff className="w-4 h-4 text-red-600" /> : <Mic className="w-4 h-4" />}
              </Button>
            )}
            <Button onClick={() => void sendCyrus()} disabled={cyrusBusy || !cyrusInput.trim()}>
              {cyrusBusy ? '…' : 'Ask'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Messages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-h-64 overflow-y-auto space-y-2">
            {project.messages.map(m => (
              <div
                key={m.id}
                className={`text-sm p-2 rounded ${
                  m.fromRole === 'customer'
                    ? 'bg-blue-50 ml-6'
                    : isSiteUpdateMessage(m)
                    ? 'bg-indigo-50 border border-indigo-200 mr-6'
                    : 'bg-white border mr-6'
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-xs font-medium text-slate-500">
                    {m.senderContactName ?? m.from}
                    {m.channel !== 'app' ? ` - ${m.channel}` : ''}
                  </p>
                  {isSiteUpdateMessage(m) && <Badge variant="secondary">Site update</Badge>}
                </div>
                <p>{m.body}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder="Reply to your team..."
              onKeyDown={e => e.key === 'Enter' && sendReply()}
            />
            <Button onClick={sendReply}>Send</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
