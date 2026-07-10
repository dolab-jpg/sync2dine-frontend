import { useState, useContext, useEffect } from 'react';
import { Link } from 'react-router';
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
import { Mail, MessageCircle, Send, FileText, Plug, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { messagingHub } from '../engine/messaging/messagingHub';
import { renderTemplate, buildQuoteVariables } from '../engine/messaging/templateRenderer';
import type { MessageChannel, MessageEventType } from '../engine/messaging/types';
import { integrationService } from '../engine/integrations/integrationService';
import { mailboxService, type MailboxConnection } from '../engine/mailbox/mailboxService';
import { InboxPanel } from './mailbox/InboxPanel';
import { EmailComposePanel } from './mailbox/EmailComposePanel';
import { MailboxConnectPanel } from './mailbox/MailboxConnectPanel';

const DEFAULT_TEMPLATES = [
  {
    id: 'quote',
    name: 'Quote Email',
    subject: 'Your Quote from {COMPANY_NAME}',
    body: `Dear {CUSTOMER_NAME},\n\nYour quote total is £{QUOTE_TOTAL}, valid until {QUOTE_EXPIRY}.\n\nReply to this message or chat with Cyrus on WhatsApp if you have questions.\n\nBest regards,\n{USER_NAME}\n{COMPANY_NAME}`,
    type: 'quote_sent' as MessageEventType,
  },
  {
    id: 'booking',
    name: 'Booking Confirmation',
    subject: 'Booking Confirmed - {COMPANY_NAME}',
    body: `Dear {CUSTOMER_NAME},\n\nYour site visit is confirmed for {BOOKING_DATE} at {BOOKING_TIME}.\n\nWe look forward to seeing you!\n\n{COMPANY_NAME}`,
    type: 'booking_confirmed' as MessageEventType,
  },
];

export default function CommunicationsHub() {
  const context = useContext(AppContext);
  const userId = context?.user?.id;
  const [activeTab, setActiveTab] = useState('send');
  const [logs, setLogs] = useState(messagingHub.getLogs());
  const [sendEmail, setSendEmail] = useState(true);
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [mailboxConnection, setMailboxConnection] = useState<MailboxConnection | null>(null);

  const loadMailbox = async () => {
    if (!userId) return;
    const list = await mailboxService.getConnections(userId, 'default');
    setMailboxConnection(list[0] ?? null);
  };

  useEffect(() => {
    void loadMailbox();
  }, [userId]);

  const [form, setForm] = useState({
    customerId: '',
    templateId: 'quote',
    subject: DEFAULT_TEMPLATES[0].subject,
    body: DEFAULT_TEMPLATES[0].body,
    quoteId: '',
  });

  useEffect(() => {
    setLogs(messagingHub.getLogs());
  }, [activeTab]);

  if (!context) return null;
  const { customers, quotes, user } = context;

  const emailStatus = integrationService.getStatus(
    integrationService.getActiveEmailProvider() ?? 'email_smtp'
  );
  const whatsappStatus = integrationService.getStatus('whatsapp');

  const handleTemplateSelect = (templateId: string) => {
    const t = DEFAULT_TEMPLATES.find(x => x.id === templateId);
    if (t) setForm({ ...form, templateId, subject: t.subject, body: t.body });
  };

  const handleSend = async () => {
    const customer = customers.find(c => c.id === form.customerId);
    if (!customer) {
      toast.error('Please select a customer');
      return;
    }

    const quote = form.quoteId ? quotes.find(q => q.id === form.quoteId) : undefined;
    const vars = quote
      ? buildQuoteVariables(customer, quote, user.name, quote.discount)
      : { CUSTOMER_NAME: customer.name, USER_NAME: user.name };

    const channels: MessageChannel[] = [];
    if (sendEmail) channels.push('email');
    if (sendWhatsApp) channels.push('whatsapp');

    if (channels.length === 0) {
      toast.error('Select at least one channel');
      return;
    }

    const template = DEFAULT_TEMPLATES.find(t => t.id === form.templateId);
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
    }, customer);

    setLogs(messagingHub.getLogs());

    if (result.success) {
      const channelNames = result.channels.join(' + ');
      toast.success(`Message sent via ${channelNames}${result.logs[0]?.status === 'mock' ? ' (mock mode)' : ''}`);
    } else {
      toast.error(result.errors.join('; ') || 'Send failed');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Communications Hub</h1>
          <p className="text-gray-600 mt-1">Send messages via email and WhatsApp</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1">
            <Mail className="w-3 h-3" /> Email: {emailStatus}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <MessageCircle className="w-3 h-3" /> WhatsApp: {whatsappStatus}
          </Badge>
          {user.role === 'super_admin' && (
            <Button variant="outline" size="sm" asChild>
              <Link to="/integrations"><Plug className="w-4 h-4 mr-1" /> Integrations</Link>
            </Button>
          )}
        </div>
      </div>

      <Card className="mb-6 bg-blue-50 border-blue-200">
        <CardContent className="p-4 text-sm text-blue-900">
          Configure API keys in <strong>Settings → Integrations</strong> (super admin).
          SMTP settings have moved there — this hub reads connection status automatically.
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="send">Send</TabsTrigger>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="compose">Compose</TabsTrigger>
          <TabsTrigger value="mailbox">Mailbox</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="logs">Logs ({logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Compose Message</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox id="ch-email" checked={sendEmail} onCheckedChange={v => setSendEmail(!!v)} />
                  <Label htmlFor="ch-email">Email</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="ch-wa" checked={sendWhatsApp} onCheckedChange={v => setSendWhatsApp(!!v)} />
                  <Label htmlFor="ch-wa">WhatsApp</Label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Customer</Label>
                  <Select value={form.customerId} onValueChange={v => setForm({ ...form, customerId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>
                      {customers.map(c => (
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
                      {DEFAULT_TEMPLATES.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Subject (email)</Label>
                <Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
              </div>
              <div>
                <Label>Message</Label>
                <Textarea rows={8} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
              </div>

              {(user.role === 'staff' || user.role === 'manager' || user.role === 'super_admin') && form.body.trim().length > 20 && (
                <Button variant="outline" className="w-full" asChild>
                  <Link
                    to={`/building-control?sourceEmail=${encodeURIComponent(form.body)}`}
                  >
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Send to Building Control Agent
                  </Link>
                </Button>
              )}

              <Button onClick={handleSend} className="w-full">
                <Send className="w-4 h-4 mr-2" /> Send Message
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inbox" className="mt-4">
          <InboxPanel userId={user.id} orgId="default" connection={mailboxConnection} />
        </TabsContent>

        <TabsContent value="compose" className="mt-4">
          <EmailComposePanel userId={user.id} orgId="default" connection={mailboxConnection} />
        </TabsContent>

        <TabsContent value="mailbox" className="mt-4">
          <MailboxConnectPanel
            userId={user.id}
            orgId="default"
            onConnectionChange={() => void loadMailbox()}
          />
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <div className="grid gap-4">
            {DEFAULT_TEMPLATES.map(t => (
              <Card key={t.id}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-4 h-4" /> {t.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium text-gray-700">{t.subject}</p>
                  <pre className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{t.body}</pre>
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
                  {logs.map(log => (
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
