import { useContext, useState } from 'react';
import { AppContext, Quote } from '../App';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { FileText, Search, Eye, Send, Check, Clock, XCircle, Mail, Phone, MapPin, BadgeCheck, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { messagingHub } from '../engine/messaging/messagingHub';
import { renderTemplate, buildQuoteVariables, type TemplateVariables } from '../engine/messaging/templateRenderer';
import { buildQuotePdfAttachment } from '../engine/messaging/quotePdfHelpers';
import { pdfPathFromAttachment } from '../engine/messaging/documentPersist';
import { AddressMapLink } from './ui/AddressMapLink';
import { getAllTrades } from '../config/trades';
import { createProjectFromQuote, getProject, syncToServer } from '../engine/project/projectStore';
import { getPackage, isSaasPackageId } from '../engine/saas/saasPackages';

function isSaasQuote(quote: Quote): boolean {
  return quote.wizardAnswers?.saas === true || quote.tradeName === 'Sync2Dine SaaS';
}

function buildSaasQuoteEmail(quote: Quote, vars: TemplateVariables): { subject: string; body: string } {
  const wa = (quote.wizardAnswers ?? {}) as Record<string, unknown>;
  const packageId = typeof wa.packageId === 'string' ? wa.packageId : '';
  const pkg = isSaasPackageId(packageId) ? getPackage(packageId) : null;
  const packageName = pkg?.name ?? quote.items?.[0]?.name ?? 'Sync2Dine';
  const interval = wa.billingInterval === 'annual' ? 'annual' : 'weekly';
  const launchActive = wa.launchActive !== false;
  const weeklyTotal =
    typeof wa.weeklyTotal === 'number' && Number.isFinite(wa.weeklyTotal)
      ? wa.weeklyTotal
      : interval === 'weekly'
        ? quote.total
        : pkg?.launchWeeklyGbp ?? quote.total;
  const annualTotal =
    typeof wa.annualTotal === 'number' && Number.isFinite(wa.annualTotal)
      ? wa.annualTotal
      : pkg?.annualPrepayGbp;
  const priceLine =
    interval === 'annual'
      ? `£${quote.total.toLocaleString('en-GB')}/year`
      : `£${weeklyTotal.toLocaleString('en-GB')}/week${launchActive && pkg ? ` launch (normally £${pkg.standardWeeklyGbp}/week)` : ''}`;

  const includesAtmosphere = pkg?.includesAtmosphere === true || packageId.startsWith('combined') || packageId === 'atmosphere';
  const judieMins = pkg?.weeklyAiMinutes ?? 0;
  const outboundMins = pkg?.weeklyOutboundMinutes ?? 0;
  const fareBits: string[] = [];
  if (judieMins > 0) {
    fareBits.push(`${judieMins} Judie AI minutes/week`);
    if (outboundMins > 0) fareBits.push(`${outboundMins} outbound minutes/week`);
    else if (pkg?.inboundOnly) fareBits.push('inbound calls only');
  }
  if (includesAtmosphere) {
    fareBits.push('Atmosphere — venue audio, promotional messaging, and staff training');
  }

  const subject = renderTemplate(`Your Sync2Dine quote — ${packageName}`, vars);
  const body = renderTemplate(
    [
      `Dear {CUSTOMER_NAME},`,
      ``,
      `Thank you for considering Sync2Dine. Here is your quotation for ${packageName}.`,
      ``,
      `Investment: ${priceLine}`,
      annualTotal != null && interval === 'weekly'
        ? `Annual prepay alternative: £${Number(annualTotal).toLocaleString('en-GB')}/year (50% off annualized launch).`
        : null,
      `Valid until {QUOTE_EXPIRY}.`,
      ``,
      `What you get:`,
      `• Judie — AI phone receptionist for orders, bookings, and call handling, powered by your Company AI Brain`,
      includesAtmosphere
        ? `• Atmosphere — venue audio and messaging so the floor sells while the phone is covered`
        : `• Phone-first hosting with transfers to your team when needed`,
      fareBits.length ? `• Included: ${fareBits.join('; ')}` : null,
      `• Integrations — voice telephony, CRM, email/WhatsApp, Stripe, and orders/bookings into the app`,
      judieMins >= 420
        ? `• Pro-level capacity — more AI talk time and outbound minutes so you handle busy periods and winbacks without drowning the pass`
        : `• Clear weekly allowances — minutes reset each week so costs stay predictable`,
      ``,
      `Why go ahead with Sync2Dine:`,
      `• Answer every call — fewer missed orders and bookings at rush`,
      `• One system for phone and venue — Judie plus Atmosphere instead of juggling add-ons`,
      `• Launch pricing you keep after you sign — transparent weekly (or annual) fares`,
      `• Built to grow with you — move up tiers when you need more cells of capacity`,
      ``,
      `Please find your quotation PDF attached.`,
      ``,
      `Reply to this email or call us with any questions — happy to walk you through go-live.`,
      ``,
      `Best regards,`,
      `{COMPANY_NAME}`,
    ]
      .filter((line): line is string => line != null)
      .join('\n'),
    vars,
  );

  return { subject, body };
}

export default function QuotesList() {
  const context = useContext(AppContext);
  const navigate = useNavigate();

  if (!context) return null;

  const { quotes, customers, updateQuote } = context;

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tradeFilter, setTradeFilter] = useState<string>('all');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const formatDateTime = (date: string) =>
    new Date(date).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const isRecentQuote = (quote: Quote) =>
    Date.now() - new Date(quote.createdAt).getTime() < 60 * 60 * 1000;

  const handleAcceptQuote = (quote: Quote) => {
    const customer = customers.find(c => c.id === quote.customerId);
    if (!customer) {
      toast.error('Customer not found');
      return;
    }
    if (quote.projectId && getProject(quote.projectId)) {
      toast.info('Project already exists for this quote');
      updateQuote(quote.id, { status: 'accepted' });
      return;
    }
    const project = createProjectFromQuote(quote, customer);
    updateQuote(quote.id, { status: 'accepted', projectId: project.id });
    syncToServer();
    toast.success(`Project ${project.id} created — open Projects to manage`);
    if (selectedQuote?.id === quote.id) {
      setSelectedQuote({ ...quote, status: 'accepted', projectId: project.id });
    }
  };

  const handleSendQuote = async (quote: Quote) => {
    if (sendingId) return;
    if (!quote.customerId) {
      toast.error('This quote has no customer — open the quote wizard and select a customer first');
      return;
    }
    const customer = customers.find(c => c.id === quote.customerId);
    if (!customer) {
      toast.error('Customer not found for this quote');
      return;
    }
    if (!customer.email && !customer.phone) {
      toast.error('Customer needs an email or phone number to receive the quote');
      return;
    }
    setSendingId(quote.id);
    try {
      const attachment = await buildQuotePdfAttachment(quote);
      updateQuote(quote.id, { status: 'sent', pdfPath: pdfPathFromAttachment(attachment) });
      const vars = buildQuoteVariables(customer, quote, undefined, quote.discount);
      const saas = isSaasQuote(quote);
      const emailCopy = saas
        ? buildSaasQuoteEmail(quote, vars)
        : {
            subject: renderTemplate('Your Quote from {COMPANY_NAME}', vars),
            body: renderTemplate(
              `Dear {CUSTOMER_NAME},\n\nYour quote for £{QUOTE_TOTAL} is ready. Valid until {QUOTE_EXPIRY}.\n\nPlease find your quotation PDF attached.\n\nReply to this email or call us with any questions.`,
              vars,
            ),
          };
      const result = await messagingHub.send({
        channels: ['email', 'whatsapp'],
        to: {
          email: customer.email,
          phone: customer.phone,
          customerId: customer.id,
          customerName: customer.name,
        },
        subject: renderTemplate('Your Quote from {COMPANY_NAME}', vars),
        body: renderTemplate(
          `Dear {CUSTOMER_NAME},\n\nYour quote for £{QUOTE_TOTAL} is ready. Valid until {QUOTE_EXPIRY}.\n\nPlease find your quotation PDF attached.\n\nReply to this email or call us with any questions.`,
          vars
        ),
        eventType: 'quote_sent',
        templateId: 'quote_ready',
        attachment,
      }, customer);
      const mode = result.logs[0]?.status === 'mock' ? ' (mock)' : '';
      toast.success(`Quote PDF sent to ${quote.customerName}${mode}`);
      if (selectedQuote?.id === quote.id) {
        setSelectedQuote({ ...quote, status: 'sent', pdfPath: pdfPathFromAttachment(attachment) });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not generate or send quote PDF');
    } finally {
      setSendingId(null);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setTradeFilter('all');
  };

  const getJobGroupLabel = (jobGroupId: string, quote: Quote): string | null => {
    const siblings = quotes.filter(q => q.jobGroupId === jobGroupId && q.customerId === quote.customerId);
    if (siblings.length < 2) return null;
    const names = siblings.map(q => q.tradeName ?? q.tradeId ?? 'Trade').join(' + ');
    return `${names} — ${quote.customerName}`;
  };

  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = quote.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         quote.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter;
    const matchesTrade = tradeFilter === 'all' || quote.tradeId === tradeFilter || (!quote.tradeId && tradeFilter === 'bathroom');
    return matchesSearch && matchesStatus && matchesTrade;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'indicative': return 'bg-amber-100 text-amber-900';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'awaiting_approval': return 'bg-orange-100 text-orange-900';
      case 'approved': return 'bg-emerald-100 text-emerald-900';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'expired': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'indicative': return <Clock className="w-4 h-4" />;
      case 'draft': return <Clock className="w-4 h-4" />;
      case 'awaiting_approval': return <Clock className="w-4 h-4" />;
      case 'approved': return <BadgeCheck className="w-4 h-4" />;
      case 'rejected': return <X className="w-4 h-4" />;
      case 'sent': return <Send className="w-4 h-4" />;
      case 'accepted': return <Check className="w-4 h-4" />;
      case 'expired': return <XCircle className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const formatStatusLabel = (status: string) => status.replace(/_/g, ' ');

  const promoteIndicative = (quoteId: string) => {
    updateQuote(quoteId, { status: 'draft' });
    toast.success('Promoted to draft — ready for staff review');
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500" />
              Quotes
            </h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">Manage and track all customer quotes</p>
          </div>
          <Button onClick={() => navigate('/quote')} className="bg-amber-500 hover:bg-amber-600 w-full sm:w-auto min-h-11">
            <FileText className="w-4 h-4 mr-2" />
            Create New Quote
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Quotes</p>
                  <p className="text-2xl font-bold">{quotes.length}</p>
                </div>
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Quotes</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {quotes.filter(q => q.status === 'sent' || q.status === 'draft').length}
                  </p>
                </div>
                <Send className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Accepted</p>
                  <p className="text-2xl font-bold text-green-600">
                    {quotes.filter(q => q.status === 'accepted').length}
                  </p>
                </div>
                <Check className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Value</p>
                  <p className="text-2xl font-bold text-amber-600">
                    £{quotes.reduce((sum, q) => sum + q.total, 0).toLocaleString()}
                  </p>
                </div>
                <FileText className="w-8 h-8 text-amber-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex-1 relative min-w-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search customer or quote ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 min-h-11"
            />
          </div>
          <Select value={tradeFilter} onValueChange={setTradeFilter}>
            <SelectTrigger className="w-full sm:w-44 min-h-11">
              <SelectValue placeholder="Trade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trades</SelectItem>
              {getAllTrades().map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48 min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="indicative">Indicative</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="awaiting_approval">Awaiting approval</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quotes List */}
      {filteredQuotes.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">
              {searchTerm || statusFilter !== 'all' || tradeFilter !== 'all'
                ? 'No quotes match your filters'
                : 'No quotes created yet'}
            </p>
            {searchTerm || statusFilter !== 'all' || tradeFilter !== 'all' ? (
              <Button variant="outline" onClick={clearFilters} className="min-h-11">
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => navigate('/quote')} className="min-h-11">
                <FileText className="w-4 h-4 mr-2" />
                Create First Quote
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredQuotes.map(quote => (
            <Card key={quote.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-lg font-bold text-gray-900 truncate">{quote.customerName}</h3>
                      <Badge className={`${getStatusColor(quote.status)} flex items-center gap-1`}>
                        {getStatusIcon(quote.status)}
                        <span className="capitalize">{formatStatusLabel(quote.status)}</span>
                      </Badge>
                      {isRecentQuote(quote) && (
                        <Badge className="bg-amber-100 text-amber-800">Recent</Badge>
                      )}
                      {quote.jobGroupId && getJobGroupLabel(quote.jobGroupId, quote) && (
                        <Badge variant="outline" className="border-purple-300 text-purple-700 text-xs">
                          {getJobGroupLabel(quote.jobGroupId, quote)}
                        </Badge>
                      )}
                      {quote.tradeName && (
                        <Badge variant="outline" className="text-xs">{quote.tradeName}</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Quote ID</p>
                        <p className="font-medium">#{quote.id.slice(0, 8)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Created</p>
                        <p className="font-medium">{formatDateTime(quote.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Expires</p>
                        <p className="font-medium">
                          {new Date(quote.expiresAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Total</p>
                        <p className="font-bold text-amber-600 text-lg">£{quote.total.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 sm:ml-4 shrink-0">
                    <Button variant="outline" className="min-h-11 flex-1 sm:flex-none" onClick={() => setSelectedQuote(quote)}>
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                    {quote.status === 'indicative' && (
                      <Button
                        variant="outline"
                        className="min-h-11 flex-1 sm:flex-none border-amber-300"
                        onClick={() => promoteIndicative(quote.id)}
                      >
                        Promote to draft
                      </Button>
                    )}
                    {quote.status === 'draft' && (
                      <Button
                        className="bg-blue-600 hover:bg-blue-700 min-h-11 flex-1 sm:flex-none"
                        onClick={() => handleSendQuote(quote)}
                        disabled={sendingId === quote.id}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        {sendingId === quote.id ? 'Sending…' : 'Send'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedQuote} onOpenChange={(open) => !open && setSelectedQuote(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedQuote && (() => {
            const customer = customers.find(c => c.id === selectedQuote.customerId);
            const subtotal =
              selectedQuote.items.reduce((sum, item) => sum + item.total, 0) +
              selectedQuote.labour.reduce((sum, item) => sum + item.total, 0) +
              selectedQuote.extras.reduce((sum, item) => sum + item.price, 0);
            const hasLineItems =
              selectedQuote.items.length > 0 ||
              selectedQuote.labour.length > 0 ||
              selectedQuote.extras.length > 0;

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-2xl flex items-center gap-3 flex-wrap">
                    Quote for {selectedQuote.customerName}
                    <Badge className={`${getStatusColor(selectedQuote.status)} flex items-center gap-1`}>
                      {getStatusIcon(selectedQuote.status)}
                      <span className="capitalize">{formatStatusLabel(selectedQuote.status)}</span>
                    </Badge>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-gray-600">Quote ID</Label>
                      <p className="font-medium">#{selectedQuote.id}</p>
                    </div>
                    <div>
                      <Label className="text-gray-600">Total</Label>
                      <p className="font-bold text-amber-600 text-xl">£{selectedQuote.total.toLocaleString()}</p>
                    </div>
                    <div>
                      <Label className="text-gray-600">Created</Label>
                      <p className="font-medium">{formatDateTime(selectedQuote.createdAt)}</p>
                    </div>
                    <div>
                      <Label className="text-gray-600">Expires</Label>
                      <p className="font-medium">{formatDateTime(selectedQuote.expiresAt)}</p>
                    </div>
                  </div>

                  {customer && (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <Label className="font-bold">Customer Contact</Label>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Mail className="w-4 h-4" />
                        <a href={`mailto:${customer.email}`} className="hover:text-blue-600">{customer.email}</a>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Phone className="w-4 h-4" />
                        <a href={`tel:${customer.phone}`} className="hover:text-blue-600">{customer.phone}</a>
                      </div>
                      <div className="flex items-start gap-2 text-sm text-gray-700">
                        <MapPin className="w-4 h-4 mt-0.5" />
                        <AddressMapLink address={customer.address} />
                      </div>
                    </div>
                  )}

                  {hasLineItems ? (
                    <div className="space-y-4">
                      {selectedQuote.items.length > 0 && (
                        <div>
                          <Label className="font-bold mb-2 block">Products & Finishes</Label>
                          <div className="border rounded-lg divide-y">
                            {selectedQuote.items.map((item, index) => (
                              <div key={index} className="flex justify-between p-3 text-sm">
                                <span>
                                  {item.name}
                                  {item.quantity > 1 && ` × ${item.quantity}`}
                                </span>
                                <span className="font-medium">£{item.total.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedQuote.labour.length > 0 && (
                        <div>
                          <Label className="font-bold mb-2 block">Labour</Label>
                          <div className="border rounded-lg divide-y">
                            {selectedQuote.labour.map((item, index) => (
                              <div key={index} className="flex justify-between p-3 text-sm">
                                <span>{item.description}</span>
                                <span className="font-medium">£{item.total.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedQuote.extras.length > 0 && (
                        <div>
                          <Label className="font-bold mb-2 block">Additional Costs</Label>
                          <div className="border rounded-lg divide-y">
                            {selectedQuote.extras.map((item, index) => (
                              <div key={index} className="flex justify-between p-3 text-sm">
                                <span>{item.description}</span>
                                <span className="font-medium">£{item.price.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedQuote.discount > 0 && (
                        <div className="flex justify-between text-sm text-green-700">
                          <span>Discount ({selectedQuote.discount}%)</span>
                          <span>-£{((subtotal * selectedQuote.discount) / 100).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
                      <p className="font-medium">Quote total: £{selectedQuote.total.toLocaleString()}</p>
                      <p className="mt-1 text-amber-800">
                        Detailed line items are not available for this quote. New quotes will include a full breakdown.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    {selectedQuote.status === 'indicative' && (
                      <Button
                        className="flex-1 border-amber-300"
                        variant="outline"
                        onClick={() => {
                          promoteIndicative(selectedQuote.id);
                          setSelectedQuote({ ...selectedQuote, status: 'draft' });
                        }}
                      >
                        Promote to draft (needs review)
                      </Button>
                    )}
                    {selectedQuote.status === 'draft' && (
                      <Button
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                        onClick={() => handleSendQuote(selectedQuote)}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Send to Customer
                      </Button>
                    )}
                    {(selectedQuote.status === 'sent' || selectedQuote.status === 'draft') && !selectedQuote.projectId && (
                      <Button
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => handleAcceptQuote(selectedQuote)}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Accept & Create Project
                      </Button>
                    )}
                    {selectedQuote.projectId && (
                      <Button variant="outline" className="flex-1" onClick={() => navigate('/projects')}>
                        Open Project
                      </Button>
                    )}
                    <Button variant="outline" className="flex-1" onClick={() => setSelectedQuote(null)}>
                      Close
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
