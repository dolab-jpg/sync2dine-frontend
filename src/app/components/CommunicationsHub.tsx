import { useState, useContext, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AppContext } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Mail, MessageCircle, Send, FileText, Plug, Sparkles, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { messagingHub } from '../engine/messaging/messagingHub';
import { renderTemplate } from '../engine/messaging/templateRenderer';
import type { MessageChannel } from '../engine/messaging/types';
import { integrationService } from '../engine/integrations/integrationService';
import { mailboxService, type MailboxConnection } from '../engine/mailbox/mailboxService';
import { InboxPanel } from './mailbox/InboxPanel';
import { EmailComposePanel } from './mailbox/EmailComposePanel';
import { MailboxConnectPanel } from './mailbox/MailboxConnectPanel';
import { LeadInboxPanel } from './mailbox/LeadInboxPanel';
import { getActiveOrgId } from '../engine/platform/orgContext';
import { BDIDDIES_HOME_ORG_ID } from '../engine/platform/homeOrg';
import { SALES_TEMPLATES, getSalesTemplate } from '../engine/messaging/salesTemplates';
import { buildSalesEmailHtmlPreview } from '../engine/messaging/salesEmailHtml';

type ScheduledJob = {
  id: string;
  sendAt: string;
  subject: string;
  status: string;
  toEmail?: string;
  channels: string[];
};

export default function CommunicationsHub() {
  const context = useContext(AppContext);
  const userId = context?.user?.id;
  const mailboxOrgId = getActiveOrgId() || BDIDDIES_HOME_ORG_ID;
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const templateFromUrl = searchParams.get('template');
  const customerFromUrl = searchParams.get('customerId');
  const [activeTab, setActiveTab] = useState(tabFromUrl === 'leads' ? 'leads' : 'send');
  const [logs, setLogs] = useState(messagingHub.getLogs());
  const [sendEmail, setSendEmail] = useState(true);
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [mailboxConnection, setMailboxConnection] = useState<MailboxConnection | null>(null);
  const [replyDraft, setReplyDraft] = useState<{ to: string; subject: string; body: string } | null>(null);
  const [aiNotes, setAiNotes] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [scheduled, setScheduled] = useState<ScheduledJob[]>([]);
  const defaultTpl = getSalesTemplate(templateFromUrl || '') ?? SALES_TEMPLATES[0];
  const [form, setForm] = useState({
    customerId: customerFromUrl || '',
    templateId: defaultTpl.id,
    subject: defaultTpl.subject,
    body: defaultTpl.body,
    restaurantName: '',
  });

  useEffect(() => {
    if (tabFromUrl === 'leads') setActiveTab('leads');
  }, [tabFromUrl]);

  useEffect(() => {
    if (templateFromUrl) {
      const t = getSalesTemplate(templateFromUrl);
      if (t) {
        setForm((prev) => ({
          ...prev,
          templateId: t.id,
          subject: t.subject,
          body: t.body,
          customerId: customerFromUrl || prev.customerId,
        }));
        setActiveTab('send');
      }
    } else if (customerFromUrl) {
      setForm((prev) => ({ ...prev, customerId: customerFromUrl }));
    }
  }, [templateFromUrl, customerFromUrl]);

  const loadMailbox = async () => {
    if (!userId) return;
    const list = await mailboxService.getConnections(userId, mailboxOrgId);
    setMailboxConnection(list[0] ?? null);
  };

  const loadScheduled = async () => {
    try {
      const res = await fetch('/api/messages/schedule', {
        headers: { 'X-Org-Id': mailboxOrgId },
      });
      if (!res.ok) return;
      const data = await res.json() as { jobs?: ScheduledJob[] };
      setScheduled((data.jobs || []).filter((j) => j.status === 'queued'));
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void loadMailbox();
    void loadScheduled();
  }, [userId, mailboxOrgId]);

  useEffect(() => {
    setLogs(messagingHub.getLogs());
  }, [activeTab]);

  const customers = context?.customers ?? [];
  const user = context?.user;
  const selectedCustomer = customers.find((c) => c.id === form.customerId);
  const previewVars = {
    CUSTOMER_NAME: selectedCustomer?.name || 'there',
    USER_NAME: user?.name || 'Sally',
    RESTAURANT_NAME: form.restaurantName || selectedCustomer?.name || 'your restaurant',
    COMPANY_NAME: 'Sync2Dine',
    COMPANY_PHONE: '020 3745 3233',
    COMPANY_EMAIL: 'info@sync2dine.io',
  };
  const previewSubject = renderTemplate(form.subject, previewVars);
  const previewBody = renderTemplate(form.body, previewVars);
  const htmlPreview = useMemo(
    () => buildSalesEmailHtmlPreview({ subject: previewSubject, bodyText: previewBody }),
    [previewSubject, previewBody],
  );

  if (!context || !user) return null;

  const emailStatus = integrationService.getStatus(
    integrationService.getActiveEmailProvider() ?? 'email_smtp',
  );
  const whatsappStatus = integrationService.getStatus('whatsapp');

  const handleTemplateSelect = (templateId: string) => {
    const t = getSalesTemplate(templateId);
    if (t) setForm({ ...form, templateId, subject: t.subject, body: t.body });
  };

  const handleWriteWithAi = async () => {
    setAiBusy(true);
    try {
      const res = await fetch('/api/ai/compose-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Org-Id': mailboxOrgId,
        },
        body: JSON.stringify({
          orgId: mailboxOrgId,
          templateId: form.templateId,
          customerName: selectedCustomer?.name,
          restaurantName: form.restaurantName || selectedCustomer?.name,
          notes: aiNotes || `Write a polished ${form.templateId} email for Sync2Dine sales.`,
          rewrite: form.body,
          apiKey: integrationService.getLiveOpenAIApiKey() || undefined,
        }),
      });
      const data = await res.json() as { subject?: string; body?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error || 'AI compose failed');
        return;
      }
      setForm((prev) => ({
        ...prev,
        subject: data.subject || prev.subject,
        body: data.body || prev.body,
      }));
      toast.success('Draft written — edit if needed, then send or schedule');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI compose failed');
    } finally {
      setAiBusy(false);
    }
  };

  const handleSend = async () => {
    const customer = selectedCustomer;
    if (!customer) {
      toast.error('Please select a customer');
      return;
    }

    const vars = {
      CUSTOMER_NAME: customer.name,
      USER_NAME: user.name,
      RESTAURANT_NAME: form.restaurantName || customer.name,
    };

    const channels: MessageChannel[] = [];
    if (sendEmail) channels.push('email');
    if (sendWhatsApp) channels.push('whatsapp');
    if (channels.length === 0) {
      toast.error('Select at least one channel');
      return;
    }

    const template = getSalesTemplate(form.templateId);
    const result = await messagingHub.send({
      channels,
      to: {
        email: customer.email,
        phone: customer.phone,
        customerId: customer.id,
        customerName: customer.name,
      },
      subject: renderTemplate(form.subject, vars),
      body: renderTemplate(form.body, vars),
      eventType: template?.type ?? 'custom',
      templateId: form.templateId,
    }, customer);

    setLogs(messagingHub.getLogs());
    if (result.success) {
      toast.success(`Message sent via ${result.channels.join(' + ')}`);
    } else {
      toast.error(result.errors.join('; ') || 'Send failed');
    }
  };

  const handleSchedule = async () => {
    const customer = selectedCustomer;
    if (!customer?.email) {
      toast.error('Select a customer with an email');
      return;
    }
    if (!scheduleAt) {
      toast.error('Pick a send time');
      return;
    }
    const vars = {
      CUSTOMER_NAME: customer.name,
      USER_NAME: user.name,
      RESTAURANT_NAME: form.restaurantName || customer.name,
    };
    const channels: Array<'email' | 'whatsapp'> = [];
    if (sendEmail) channels.push('email');
    if (sendWhatsApp) channels.push('whatsapp');
    if (!channels.length) channels.push('email');

    try {
      const res = await fetch('/api/messages/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Org-Id': mailboxOrgId,
        },
        body: JSON.stringify({
          orgId: mailboxOrgId,
          sendAt: new Date(scheduleAt).toISOString(),
          channels,
          toEmail: customer.email,
          toPhone: customer.phone,
          customerId: customer.id,
          customerName: customer.name,
          templateId: form.templateId,
          subject: renderTemplate(form.subject, vars),
          body: renderTemplate(form.body, vars),
          createdBy: 'hub',
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast.error(data.error || 'Schedule failed');
        return;
      }
      toast.success('Scheduled — it will send itself when due');
      setScheduleAt('');
      void loadScheduled();
      setActiveTab('scheduled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Schedule failed');
    }
  };

  const cancelJob = async (id: string) => {
    await fetch('/api/messages/schedule', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'X-Org-Id': mailboxOrgId },
      body: JSON.stringify({ id }),
    });
    void loadScheduled();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Communications Hub</h1>
          <p className="text-gray-600 mt-1">
            Sync2Dine sales email & WhatsApp — Sally templates, AI write, schedule later
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1">
            <Mail className="w-3 h-3" /> Email: {emailStatus}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <MessageCircle className="w-3 h-3" /> WhatsApp: {whatsappStatus}
          </Badge>
          {(user.role === 'super_admin' || user.role === 'platform_owner') && (
            <Button variant="outline" size="sm" asChild>
              <Link to="/integrations"><Plug className="w-4 h-4 mr-1" /> Integrations</Link>
            </Button>
          )}
        </div>
      </div>

      <Card className="mb-6 border-teal-200 bg-teal-50/60">
        <CardContent className="p-4 text-sm text-teal-950">
          Connect platform Gmail under <strong>Mailbox</strong> so Sally can brief inbox and send replies.
          Use <strong>Write with AI</strong> for free-form company emails (OpenAI). Scheduled sends fire automatically.
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="send">Send</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled ({scheduled.length})</TabsTrigger>
          <TabsTrigger value="leads">Lead Inbox</TabsTrigger>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="compose">Compose</TabsTrigger>
          <TabsTrigger value="mailbox">Mailbox</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="logs">Logs ({logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="space-y-4 mt-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Compose sales message</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <Checkbox id="ch-email" checked={sendEmail} onCheckedChange={(v) => setSendEmail(!!v)} />
                    <Label htmlFor="ch-email">Email</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="ch-wa" checked={sendWhatsApp} onCheckedChange={(v) => setSendWhatsApp(!!v)} />
                    <Label htmlFor="ch-wa">WhatsApp</Label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Customer / lead</Label>
                    <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                      <SelectContent>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Template</Label>
                    <Select value={form.templateId} onValueChange={handleTemplateSelect}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SALES_TEMPLATES.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Restaurant name (optional)</Label>
                  <Input
                    value={form.restaurantName}
                    onChange={(e) => setForm({ ...form, restaurantName: e.target.value })}
                    placeholder="e.g. Demo Kitchen"
                  />
                </div>

                <div>
                  <Label>AI instructions (what Sally should write)</Label>
                  <Textarea
                    rows={2}
                    value={aiNotes}
                    onChange={(e) => setAiNotes(e.target.value)}
                    placeholder="e.g. Mention they asked about delivery areas and offer a demo tomorrow afternoon"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2 w-full"
                    disabled={aiBusy}
                    onClick={() => void handleWriteWithAi()}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {aiBusy ? 'Writing…' : 'Write with AI'}
                  </Button>
                </div>

                <div>
                  <Label>Subject (email)</Label>
                  <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                </div>
                <div>
                  <Label>Message</Label>
                  <Textarea rows={8} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button onClick={() => void handleSend()} className="w-full">
                    <Send className="w-4 h-4 mr-2" /> Send now
                  </Button>
                  <div className="flex gap-2">
                    <Input
                      type="datetime-local"
                      value={scheduleAt}
                      onChange={(e) => setScheduleAt(e.target.value)}
                      className="flex-1"
                    />
                    <Button type="button" variant="secondary" onClick={() => void handleSchedule()}>
                      <Clock className="w-4 h-4 mr-1" /> Later
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Email preview</CardTitle></CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-2">Branded header & footer as sent</p>
                <div
                  className="rounded-md overflow-auto max-h-[640px] border"
                  dangerouslySetInnerHTML={{ __html: htmlPreview }}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="scheduled" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {scheduled.length === 0 ? (
                <p className="p-6 text-gray-500 text-center">No queued sends</p>
              ) : (
                <div className="divide-y">
                  {scheduled.map((job) => (
                    <div key={job.id} className="p-4 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{job.subject}</p>
                        <p className="text-sm text-gray-600">
                          {job.toEmail} · {new Date(job.sendAt).toLocaleString()} · {job.channels?.join('+')}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => void cancelJob(job.id)}>Cancel</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          <LeadInboxPanel
            onOpenReply={(draft) => {
              setReplyDraft(draft);
              setActiveTab('compose');
            }}
          />
        </TabsContent>

        <TabsContent value="inbox" className="mt-4">
          <InboxPanel userId={user.id} orgId={mailboxOrgId} connection={mailboxConnection} />
        </TabsContent>

        <TabsContent value="compose" className="mt-4">
          <EmailComposePanel
            userId={user.id}
            orgId={mailboxOrgId}
            connection={mailboxConnection}
            defaultTo={replyDraft?.to}
            defaultSubject={replyDraft?.subject}
            defaultBody={replyDraft?.body}
          />
        </TabsContent>

        <TabsContent value="mailbox" className="mt-4">
          <MailboxConnectPanel
            userId={user.id}
            orgId={mailboxOrgId}
            onConnectionChange={() => void loadMailbox()}
          />
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <div className="grid gap-4">
            {SALES_TEMPLATES.map((t) => (
              <Card key={t.id}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-4 h-4" /> {t.name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground font-normal">{t.description}</p>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium text-gray-700">{t.subject}</p>
                  <pre className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{t.body}</pre>
                  <Button
                    className="mt-3"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleTemplateSelect(t.id);
                      setActiveTab('send');
                    }}
                  >
                    Use template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {logs.length === 0 ? (
                <p className="p-6 text-gray-500 text-center">No messages sent yet</p>
              ) : (
                <div className="divide-y max-h-[500px] overflow-auto">
                  {logs.map((log) => (
                    <div key={log.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge>{log.channel}</Badge>
                        <Badge variant="outline">{log.status}</Badge>
                        <span className="text-xs text-gray-500">{new Date(log.sentAt).toLocaleString()}</span>
                      </div>
                      <p className="font-medium">{log.customerName} — {log.to}</p>
                      {log.subject && <p className="text-sm text-gray-600">{log.subject}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
