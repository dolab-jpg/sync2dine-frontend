import { useState, useContext } from 'react';
import { AppContext } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Mail, Send, Settings, FileText, Eye, Trash2, Plus, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: 'quote' | 'invoice' | 'reminder' | 'followup' | 'booking';
}

interface SMTPSettings {
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  secure: boolean;
}

interface EmailLog {
  id: string;
  to: string;
  subject: string;
  sentAt: string;
  status: 'sent' | 'failed' | 'pending';
  customerId: string;
  customerName: string;
}

export default function EmailSystem() {
  const context = useContext(AppContext);
  if (!context) return null;

  const { customers, quotes, user } = context;

  const [activeTab, setActiveTab] = useState('send');
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  const [smtpSettings, setSmtpSettings] = useState<SMTPSettings>({
    host: 'smtp.gmail.com',
    port: 587,
    username: 'your-email@gmail.com',
    password: '',
    fromEmail: 'info@bathroompro.com',
    fromName: 'TradePro',
    secure: true
  });

  const [templates, setTemplates] = useState<EmailTemplate[]>([
    {
      id: '1',
      name: 'Quote Email',
      subject: 'Your Bathroom Quote from {COMPANY_NAME}',
      body: `Dear {CUSTOMER_NAME},

Thank you for your interest in our premium bathroom services.

Please find attached your personalized quote for your bathroom project at {CUSTOMER_ADDRESS}.

**Quote Summary:**
- Total Cost: £{QUOTE_TOTAL}
- Valid Until: {QUOTE_EXPIRY}
- Project Duration: {LABOUR_DAYS} days

{DISCOUNT_MESSAGE}

**What's Included:**
✓ All labour and installation
✓ Premium materials and waterproofing
✓ Waste removal and disposal
✓ Full guarantee on workmanship

**Next Steps:**
To secure your preferred installation date, simply reply to this email or call us on {COMPANY_PHONE}.

We offer flexible payment options including 0% finance available.

Best regards,
{USER_NAME}
{COMPANY_NAME}
{COMPANY_PHONE}`,
      type: 'quote'
    },
    {
      id: '2',
      name: 'Booking Confirmation',
      subject: 'Booking Confirmed - {CUSTOMER_NAME}',
      body: `Dear {CUSTOMER_NAME},

Great news! Your bathroom installation has been confirmed.

**Booking Details:**
- Start Date: {BOOKING_DATE}
- Duration: {LABOUR_DAYS} days
- Location: {CUSTOMER_ADDRESS}
- Booking Deposit: £{BOOKING_DEPOSIT} (Paid)

**Before We Start:**
Please ensure:
✓ Clear access to the bathroom
✓ Remove personal items from the area
✓ Parking available for our team

We'll send you a reminder 48 hours before we start.

If you have any questions, please don't hesitate to contact us.

Best regards,
{USER_NAME}
{COMPANY_NAME}`,
      type: 'booking'
    },
    {
      id: '3',
      name: 'Payment Reminder',
      subject: 'Payment Reminder - Invoice #{QUOTE_ID}',
      body: `Dear {CUSTOMER_NAME},

This is a friendly reminder that payment is due for your recent bathroom installation.

**Invoice Details:**
- Invoice Number: #{QUOTE_ID}
- Amount Due: £{QUOTE_TOTAL}
- Due Date: {QUOTE_EXPIRY}

**Payment Methods:**
- Bank Transfer: [Account Details]
- Card Payment: Reply to arrange
- Finance: 0% options available

Please contact us if you have any questions about your invoice.

Thank you for choosing {COMPANY_NAME}.

Best regards,
{USER_NAME}`,
      type: 'invoice'
    },
    {
      id: '4',
      name: '15% Same-Day Discount',
      subject: '⚡ Special Offer - 15% OFF Today Only!',
      body: `Dear {CUSTOMER_NAME},

Thank you for meeting with us today!

**EXCLUSIVE SAME-DAY OFFER:**
Book your bathroom installation TODAY and receive:

🎉 15% DISCOUNT - Save £{DISCOUNT_AMOUNT}!

**Your Special Price:**
Original: £{QUOTE_SUBTOTAL}
Discount: -£{DISCOUNT_AMOUNT} (15%)
**TODAY ONLY: £{QUOTE_TOTAL}**

**Why Book Today?**
✓ Lock in this special price
✓ Secure your preferred installation date
✓ Premium quality guaranteed
✓ Flexible payment options

⏰ **This offer expires at MIDNIGHT tonight!**

To accept this offer, simply reply to this email or call us now on {COMPANY_PHONE}.

Best regards,
{USER_NAME}
{COMPANY_NAME}`,
      type: 'quote'
    },
    {
      id: '5',
      name: 'Follow-Up Email',
      subject: 'Following up on your bathroom quote',
      body: `Dear {CUSTOMER_NAME},

I hope this email finds you well.

I wanted to follow up on the quote we provided for your bathroom project at {CUSTOMER_ADDRESS}.

**Quick Recap:**
- Quote Total: £{QUOTE_TOTAL}
- Project Duration: {LABOUR_DAYS} days
- Quote Valid Until: {QUOTE_EXPIRY}

**Do you have any questions?**
I'm here to help with:
✓ Design options and finishes
✓ Payment plans and finance
✓ Project timeline and availability
✓ Product selections

**Ready to proceed?**
We currently have availability starting from [DATE]. Let me know if you'd like to secure a slot.

Looking forward to hearing from you!

Best regards,
{USER_NAME}
{COMPANY_NAME}
{COMPANY_PHONE}`,
      type: 'followup'
    }
  ]);

  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([
    {
      id: '1',
      to: 'james.wilson@email.com',
      subject: 'Your {TRADE_NAME} Quote from TradePro',
      sentAt: new Date(2026, 3, 20, 14, 30).toISOString(),
      status: 'sent',
      customerId: '2',
      customerName: 'James Wilson'
    },
    {
      id: '2',
      to: 'sophie.a@email.com',
      subject: 'Your {TRADE_NAME} Quote from TradePro',
      sentAt: new Date(2026, 3, 18, 10, 15).toISOString(),
      status: 'sent',
      customerId: '5',
      customerName: 'Sophie Anderson'
    },
    {
      id: '3',
      to: 'emma.clarke@email.com',
      subject: 'Booking Confirmed - Emma Clarke',
      sentAt: new Date(2026, 3, 11, 16, 45).toISOString(),
      status: 'sent',
      customerId: '3',
      customerName: 'Emma Clarke'
    }
  ]);

  const [emailForm, setEmailForm] = useState({
    customerId: '',
    templateId: '1',
    subject: '',
    body: '',
    quoteId: ''
  });

  const [templateForm, setTemplateForm] = useState({
    name: '',
    subject: '',
    body: '',
    type: 'quote' as EmailTemplate['type']
  });

  const replaceVariables = (text: string, customerId: string, quoteId?: string) => {
    const customer = customers.find(c => c.id === customerId);
    const quote = quoteId ? quotes.find(q => q.id === quoteId) : null;

    if (!customer) return text;

    let result = text;

    // Customer variables
    result = result.replace(/{CUSTOMER_NAME}/g, customer.name);
    result = result.replace(/{CUSTOMER_EMAIL}/g, customer.email);
    result = result.replace(/{CUSTOMER_PHONE}/g, customer.phone);
    result = result.replace(/{CUSTOMER_ADDRESS}/g, customer.address);

    // Company variables
    result = result.replace(/{COMPANY_NAME}/g, 'TradePro');
    result = result.replace(/{TRADE_NAME}/g, 'Construction');
    result = result.replace(/{COMPANY_PHONE}/g, '020 1234 5678');
    result = result.replace(/{USER_NAME}/g, user.name);

    // Quote variables
    if (quote) {
      result = result.replace(/{QUOTE_ID}/g, quote.id);
      result = result.replace(/{QUOTE_TOTAL}/g, quote.total.toFixed(0));
      result = result.replace(/{QUOTE_SUBTOTAL}/g, (quote.total / (1 - quote.discount / 100)).toFixed(0));
      result = result.replace(/{QUOTE_EXPIRY}/g, new Date(quote.expiresAt).toLocaleDateString('en-GB'));
      result = result.replace(/{DISCOUNT_AMOUNT}/g, ((quote.total / (1 - quote.discount / 100)) - quote.total).toFixed(0));
      result = result.replace(/{LABOUR_DAYS}/g, '5'); // Placeholder
      result = result.replace(/{BOOKING_DATE}/g, new Date().toLocaleDateString('en-GB'));
      result = result.replace(/{BOOKING_DEPOSIT}/g, '500');

      if (quote.discount === 15) {
        result = result.replace(/{DISCOUNT_MESSAGE}/g, '🎉 **15% SAME-DAY DISCOUNT APPLIED** - Offer expires today!');
      } else {
        result = result.replace(/{DISCOUNT_MESSAGE}/g, '');
      }
    } else {
      result = result.replace(/{QUOTE_TOTAL}/g, '[AMOUNT]');
      result = result.replace(/{LABOUR_DAYS}/g, '[DAYS]');
      result = result.replace(/{DISCOUNT_MESSAGE}/g, '');
    }

    return result;
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setEmailForm({
        ...emailForm,
        templateId,
        subject: template.subject,
        body: template.body
      });
    }
  };

  const handleSendEmail = () => {
    const customer = customers.find(c => c.id === emailForm.customerId);
    if (!customer) {
      toast.error('Please select a customer');
      return;
    }

    if (!smtpSettings.password) {
      toast.error('Please configure SMTP settings first');
      setActiveTab('settings');
      return;
    }

    const processedSubject = replaceVariables(emailForm.subject, emailForm.customerId, emailForm.quoteId);
    const processedBody = replaceVariables(emailForm.body, emailForm.customerId, emailForm.quoteId);

    // Simulate email sending
    const newLog: EmailLog = {
      id: Date.now().toString(),
      to: customer.email,
      subject: processedSubject,
      sentAt: new Date().toISOString(),
      status: 'sent',
      customerId: customer.id,
      customerName: customer.name
    };

    setEmailLogs([newLog, ...emailLogs]);

    toast.success(`Email sent to ${customer.email}!`);
    toast.info('(This is simulated - connect SMTP for real sending)');

    setEmailForm({
      customerId: '',
      templateId: '1',
      subject: '',
      body: '',
      quoteId: ''
    });
  };

  const handleSaveTemplate = () => {
    if (editingTemplate) {
      setTemplates(templates.map(t =>
        t.id === editingTemplate.id
          ? { ...editingTemplate, ...templateForm }
          : t
      ));
      toast.success('Template updated');
    } else {
      const newTemplate: EmailTemplate = {
        ...templateForm,
        id: Date.now().toString()
      };
      setTemplates([...templates, newTemplate]);
      toast.success('Template created');
    }

    setTemplateForm({ name: '', subject: '', body: '', type: 'quote' });
    setEditingTemplate(null);
    setIsTemplateDialogOpen(false);
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      subject: template.subject,
      body: template.body,
      type: template.type
    });
    setIsTemplateDialogOpen(true);
  };

  const handleDeleteTemplate = (id: string) => {
    if (confirm('Delete this template?')) {
      setTemplates(templates.filter(t => t.id !== id));
      toast.success('Template deleted');
    }
  };

  const handleSaveSMTP = () => {
    toast.success('SMTP settings saved');
    toast.info('Note: Real emails will be sent using these settings');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-3xl shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-4 rounded-2xl">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">
                Email & CRM System
              </h1>
              <p className="text-amber-100 mt-1 text-lg">Send professional quotes, invoices, and follow-ups</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full mb-6 bg-white/80 p-2 rounded-2xl shadow-lg">
            <TabsTrigger value="send" className="text-lg py-4 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-amber-600 data-[state=active]:text-white">
              <Send className="w-5 h-5 mr-2" />
              Send Email
            </TabsTrigger>
            <TabsTrigger value="templates" className="text-lg py-4 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-amber-600 data-[state=active]:text-white">
              <FileText className="w-5 h-5 mr-2" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="history" className="text-lg py-4 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-amber-600 data-[state=active]:text-white">
              <Mail className="w-5 h-5 mr-2" />
              History
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-lg py-4 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-amber-600 data-[state=active]:text-white">
              <Settings className="w-5 h-5 mr-2" />
              SMTP Settings
            </TabsTrigger>
          </TabsList>

          {/* Send Email Tab */}
          <TabsContent value="send">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-xl rounded-3xl border-0">
                <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-t-3xl">
                  <CardTitle className="text-2xl">Compose Email</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div>
                    <Label className="text-lg font-bold mb-3 block">Customer</Label>
                    <Select value={emailForm.customerId} onValueChange={(value) => setEmailForm({ ...emailForm, customerId: value })}>
                      <SelectTrigger className="text-lg p-6 border-2 rounded-2xl">
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map(customer => (
                          <SelectItem key={customer.id} value={customer.id} className="text-lg py-4">
                            <div>
                              <div className="font-bold">{customer.name}</div>
                              <div className="text-sm text-gray-600">{customer.email}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-lg font-bold mb-3 block">Template</Label>
                    <Select value={emailForm.templateId} onValueChange={handleTemplateSelect}>
                      <SelectTrigger className="text-lg p-6 border-2 rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map(template => (
                          <SelectItem key={template.id} value={template.id} className="text-lg py-4">
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-lg font-bold mb-3 block">Quote (Optional)</Label>
                    <Select value={emailForm.quoteId} onValueChange={(value) => setEmailForm({ ...emailForm, quoteId: value })}>
                      <SelectTrigger className="text-lg p-6 border-2 rounded-2xl">
                        <SelectValue placeholder="Select quote for auto-fill" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No quote selected</SelectItem>
                        {quotes
                          .filter(q => q.customerId === emailForm.customerId)
                          .map(quote => (
                            <SelectItem key={quote.id} value={quote.id} className="text-lg py-4">
                              Quote #{quote.id} - £{quote.total.toFixed(0)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-lg font-bold mb-3 block">Subject</Label>
                    <Input
                      value={emailForm.subject}
                      onChange={e => setEmailForm({ ...emailForm, subject: e.target.value })}
                      className="text-lg p-6 border-2 rounded-2xl"
                      placeholder="Email subject..."
                    />
                  </div>

                  <div>
                    <Label className="text-lg font-bold mb-3 block">Message</Label>
                    <Textarea
                      value={emailForm.body}
                      onChange={e => setEmailForm({ ...emailForm, body: e.target.value })}
                      rows={12}
                      className="text-base p-4 border-2 rounded-2xl font-mono"
                      placeholder="Email body..."
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => setIsPreviewOpen(true)}
                      variant="outline"
                      size="lg"
                      className="flex-1 text-lg py-6 rounded-2xl"
                      disabled={!emailForm.customerId}
                    >
                      <Eye className="w-5 h-5 mr-2" />
                      Preview
                    </Button>
                    <Button
                      onClick={handleSendEmail}
                      size="lg"
                      className="flex-1 text-lg py-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                      disabled={!emailForm.customerId || !emailForm.subject || !emailForm.body}
                    >
                      <Send className="w-5 h-5 mr-2" />
                      Send Email
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-xl rounded-3xl border-0">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-3xl">
                  <CardTitle className="text-2xl">Available Variables</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-2xl border-2 border-amber-200">
                      <h4 className="font-bold mb-2 text-amber-900">Customer Variables</h4>
                      <div className="space-y-2 text-sm">
                        {['{CUSTOMER_NAME}', '{CUSTOMER_EMAIL}', '{CUSTOMER_PHONE}', '{CUSTOMER_ADDRESS}'].map(v => (
                          <div key={v} className="flex items-center justify-between">
                            <code className="bg-white px-2 py-1 rounded">{v}</code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                navigator.clipboard.writeText(v);
                                toast.success('Copied!');
                              }}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-2xl border-2 border-blue-200">
                      <h4 className="font-bold mb-2 text-blue-900">Company Variables</h4>
                      <div className="space-y-2 text-sm">
                        {['{COMPANY_NAME}', '{COMPANY_PHONE}', '{USER_NAME}'].map(v => (
                          <div key={v} className="flex items-center justify-between">
                            <code className="bg-white px-2 py-1 rounded">{v}</code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                navigator.clipboard.writeText(v);
                                toast.success('Copied!');
                              }}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-2xl border-2 border-green-200">
                      <h4 className="font-bold mb-2 text-green-900">Quote Variables</h4>
                      <div className="space-y-2 text-sm">
                        {['{QUOTE_ID}', '{QUOTE_TOTAL}', '{QUOTE_SUBTOTAL}', '{QUOTE_EXPIRY}', '{DISCOUNT_AMOUNT}', '{LABOUR_DAYS}', '{BOOKING_DATE}', '{BOOKING_DEPOSIT}', '{DISCOUNT_MESSAGE}'].map(v => (
                          <div key={v} className="flex items-center justify-between">
                            <code className="bg-white px-2 py-1 rounded text-xs">{v}</code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                navigator.clipboard.writeText(v);
                                toast.success('Copied!');
                              }}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-2xl border-2 border-purple-200">
                      <p className="text-sm text-purple-900">
                        <strong>💡 Tip:</strong> Variables are automatically replaced when you send the email. Preview to see the final result!
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates">
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Email Templates</h2>
                <Dialog open={isTemplateDialogOpen} onOpenChange={(open) => {
                  setIsTemplateDialogOpen(open);
                  if (!open) {
                    setEditingTemplate(null);
                    setTemplateForm({ name: '', subject: '', body: '', type: 'quote' });
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button size="lg" className="text-lg py-6 px-8 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600">
                      <Plus className="w-5 h-5 mr-2" />
                      New Template
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-2xl">{editingTemplate ? 'Edit' : 'Create'} Email Template</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Template Name</Label>
                          <Input
                            value={templateForm.name}
                            onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                            placeholder="e.g., Quote Email"
                            className="text-lg p-4"
                          />
                        </div>
                        <div>
                          <Label>Type</Label>
                          <Select value={templateForm.type} onValueChange={(value: EmailTemplate['type']) => setTemplateForm({ ...templateForm, type: value })}>
                            <SelectTrigger className="text-lg p-4">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="quote">Quote</SelectItem>
                              <SelectItem value="invoice">Invoice</SelectItem>
                              <SelectItem value="reminder">Reminder</SelectItem>
                              <SelectItem value="followup">Follow-up</SelectItem>
                              <SelectItem value="booking">Booking</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label>Subject Line</Label>
                        <Input
                          value={templateForm.subject}
                          onChange={e => setTemplateForm({ ...templateForm, subject: e.target.value })}
                          placeholder="Use {CUSTOMER_NAME} and other variables"
                          className="text-lg p-4"
                        />
                      </div>

                      <div>
                        <Label>Email Body</Label>
                        <Textarea
                          value={templateForm.body}
                          onChange={e => setTemplateForm({ ...templateForm, body: e.target.value })}
                          rows={15}
                          className="font-mono text-sm p-4"
                          placeholder="Write your email template here. Use variables like {CUSTOMER_NAME}, {QUOTE_TOTAL}, etc."
                        />
                      </div>

                      <div className="flex gap-2 justify-end pt-4 border-t">
                        <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveTemplate} disabled={!templateForm.name || !templateForm.subject || !templateForm.body}>
                          <Check className="w-4 h-4 mr-2" />
                          Save Template
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map(template => (
                  <Card key={template.id} className="shadow-lg rounded-2xl border-0 hover:shadow-xl transition-shadow">
                    <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-t-2xl">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xl">{template.name}</CardTitle>
                        <span className="px-3 py-1 bg-amber-500 text-white rounded-full text-xs font-bold uppercase">
                          {template.type}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600 font-medium">Subject:</p>
                          <p className="text-base font-medium text-gray-900">{template.subject}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 font-medium">Preview:</p>
                          <p className="text-sm text-gray-700 line-clamp-3">{template.body.substring(0, 150)}...</p>
                        </div>

                        <div className="flex gap-2 pt-3 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleEditTemplate(template)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteTemplate(template.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card className="shadow-xl rounded-3xl border-0">
              <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-t-3xl">
                <CardTitle className="text-2xl">Email History</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {emailLogs.length === 0 ? (
                  <div className="text-center py-12">
                    <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No emails sent yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {emailLogs.map(log => (
                      <div key={log.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl border-2 border-slate-200">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${
                              log.status === 'sent' ? 'bg-green-500' :
                              log.status === 'failed' ? 'bg-red-500' :
                              'bg-yellow-500'
                            }`} />
                            <div>
                              <p className="font-bold text-lg">{log.customerName}</p>
                              <p className="text-sm text-gray-600">{log.to}</p>
                            </div>
                          </div>
                          <p className="text-gray-700 mt-2">{log.subject}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">{new Date(log.sentAt).toLocaleDateString('en-GB')}</p>
                          <p className="text-xs text-gray-500">{new Date(log.sentAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mt-2 ${
                            log.status === 'sent' ? 'bg-green-100 text-green-700' :
                            log.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {log.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card className="shadow-xl rounded-3xl border-0">
              <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-t-3xl">
                <CardTitle className="text-2xl">SMTP Email Settings</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border-2 border-blue-200">
                  <h3 className="font-bold text-blue-900 mb-2">📧 Configure Your Email Server</h3>
                  <p className="text-blue-800 text-sm">
                    Enter your SMTP server details to send real emails. Common providers: Gmail, Outlook, SendGrid, Mailgun.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-lg font-bold mb-2 block">SMTP Host</Label>
                    <Input
                      value={smtpSettings.host}
                      onChange={e => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className="text-lg p-6 border-2 rounded-2xl"
                    />
                  </div>
                  <div>
                    <Label className="text-lg font-bold mb-2 block">Port</Label>
                    <Input
                      type="number"
                      value={smtpSettings.port}
                      onChange={e => setSmtpSettings({ ...smtpSettings, port: parseInt(e.target.value) })}
                      placeholder="587"
                      className="text-lg p-6 border-2 rounded-2xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-lg font-bold mb-2 block">Username</Label>
                    <Input
                      value={smtpSettings.username}
                      onChange={e => setSmtpSettings({ ...smtpSettings, username: e.target.value })}
                      placeholder="your-email@gmail.com"
                      className="text-lg p-6 border-2 rounded-2xl"
                    />
                  </div>
                  <div>
                    <Label className="text-lg font-bold mb-2 block">Password</Label>
                    <Input
                      type="password"
                      value={smtpSettings.password}
                      onChange={e => setSmtpSettings({ ...smtpSettings, password: e.target.value })}
                      placeholder="App password or SMTP password"
                      className="text-lg p-6 border-2 rounded-2xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-lg font-bold mb-2 block">From Email</Label>
                    <Input
                      value={smtpSettings.fromEmail}
                      onChange={e => setSmtpSettings({ ...smtpSettings, fromEmail: e.target.value })}
                      placeholder="info@bathroompro.com"
                      className="text-lg p-6 border-2 rounded-2xl"
                    />
                  </div>
                  <div>
                    <Label className="text-lg font-bold mb-2 block">From Name</Label>
                    <Input
                      value={smtpSettings.fromName}
                      onChange={e => setSmtpSettings({ ...smtpSettings, fromName: e.target.value })}
                      placeholder="Bathroom Pro"
                      className="text-lg p-6 border-2 rounded-2xl"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                  <input
                    type="checkbox"
                    checked={smtpSettings.secure}
                    onChange={e => setSmtpSettings({ ...smtpSettings, secure: e.target.checked })}
                    className="w-6 h-6"
                    id="secure"
                  />
                  <Label htmlFor="secure" className="text-lg">Use TLS/SSL (Recommended)</Label>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-2xl border-2 border-amber-200">
                  <h4 className="font-bold text-amber-900 mb-3">Common SMTP Settings</h4>
                  <div className="space-y-2 text-sm text-amber-800">
                    <p><strong>Gmail:</strong> smtp.gmail.com:587 (Enable 2FA and use App Password)</p>
                    <p><strong>Outlook:</strong> smtp-mail.outlook.com:587</p>
                    <p><strong>SendGrid:</strong> smtp.sendgrid.net:587</p>
                    <p><strong>Mailgun:</strong> smtp.mailgun.org:587</p>
                  </div>
                </div>

                <Button
                  onClick={handleSaveSMTP}
                  size="lg"
                  className="w-full text-xl py-8 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                >
                  <Check className="w-6 h-6 mr-2" />
                  Save SMTP Settings
                </Button>

                <p className="text-xs text-gray-500 text-center">
                  Note: In production, connect these settings to your backend to send real emails
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Preview Dialog */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">Email Preview</DialogTitle>
            </DialogHeader>
            {emailForm.customerId && (
              <div className="space-y-4">
                <div className="bg-slate-100 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">To:</p>
                  <p className="font-bold">{customers.find(c => c.id === emailForm.customerId)?.email}</p>
                </div>
                <div className="bg-slate-100 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Subject:</p>
                  <p className="font-bold">{replaceVariables(emailForm.subject, emailForm.customerId, emailForm.quoteId)}</p>
                </div>
                <div className="bg-white border-2 border-slate-200 p-6 rounded-lg">
                  <div className="whitespace-pre-wrap font-sans">
                    {replaceVariables(emailForm.body, emailForm.customerId, emailForm.quoteId)}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
