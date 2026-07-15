import { useContext, useState, useEffect, useMemo } from 'react';
import { AppContext, QuoteLine } from '../App';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import QuoteLineEditor, { calcQuoteTotals } from './QuoteLineEditor';
import { createQuoteLine, migrateQuoteToLines, linesToLegacy } from '../engine/quotes/quoteLineUtils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Plus, Trash2, FileText, Send, Percent } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { toast } from 'sonner';
import { messagingHub } from '../engine/messaging/messagingHub';
import { renderTemplate, buildQuoteVariables } from '../engine/messaging/templateRenderer';
import { generateQuotePdfStub } from '../engine/messaging/pdfGenerator';
import type { MessageChannel } from '../engine/messaging/types';

export default function QuoteLineBuilder() {
  const context = useContext(AppContext);
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const routeTradeId = searchParams.get('tradeId') ?? undefined;

  if (!context) return null;

  const { customers, addQuote, user } = context;

  const [selectedCustomerId, setSelectedCustomerId] = useState(customerId || '');
  const [lines, setLines] = useState<QuoteLine[]>([createQuoteLine({ description: '', quantity: 1, unit: 'item', rate: 0 })]);
  const [discount, setDiscount] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [attachPdf, setAttachPdf] = useState(false);

  useEffect(() => {
    if (customerId) setSelectedCustomerId(customerId);
  }, [customerId]);

  useEffect(() => {
    if (searchParams.get('prefill') === 'ai') {
      const raw = sessionStorage.getItem('aiQuotePrefill');
      if (raw) {
        try {
          const data = JSON.parse(raw);
          if (Array.isArray(data.lines)) setLines(data.lines);
        } catch { /* ignore */ }
      }
    }
  }, [searchParams]);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const totals = calcQuoteTotals(lines, discount);
  const hasLines = lines.some((l) => l.description.trim());

  const handleLinesChange = (nextLines: QuoteLine[], nextDiscount: number) => {
    setLines(nextLines);
    setDiscount(nextDiscount);
  };

  const buildQuotePayload = (status: 'draft' | 'sent') => {
    const legacy = linesToLegacy({ lines, items: [], labour: [], extras: [] } as never);
    return {
      customerId: selectedCustomerId,
      customerName: selectedCustomer!.name,
      tradeId: routeTradeId as never,
      tradeName: routeTradeId ? routeTradeId.charAt(0).toUpperCase() + routeTradeId.slice(1) : undefined,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      lines,
      ...legacy,
      discount,
      total: totals.total,
      status,
    };
  };

  const handleSaveQuote = () => {
    if (!selectedCustomerId) {
      toast.error('Please select a customer');
      return;
    }
    if (lines.filter((l) => l.description.trim()).length === 0) {
      toast.error('Please add at least one line item');
      return;
    }
    addQuote(buildQuotePayload('draft'));
    toast.success('Quote saved successfully!');
    navigate('/quotes');
  };

  const handleSendQuote = () => {
    if (!selectedCustomerId) {
      toast.error('Please select a customer');
      return;
    }
    setShowPreview(true);
  };

  const confirmSendQuote = async () => {
    if (!selectedCustomerId) return;
    const customer = customers.find(c => c.id === selectedCustomerId);
    if (!customer) {
      toast.error('Customer not found');
      return;
    }
    if (!customer.email && !customer.phone) {
      toast.error('Customer needs an email or phone to receive the quote');
      return;
    }

    const quoteData = buildQuotePayload('sent');
    addQuote(quoteData);

    const channels: MessageChannel[] = [];
    if (sendEmail) channels.push('email');
    if (sendWhatsApp) channels.push('whatsapp');

    if (channels.length > 0) {
      const vars = buildQuoteVariables(customer, quoteData, user.name, discount);
      const body = renderTemplate(
        `Dear {CUSTOMER_NAME},\n\nYour quote total is £{QUOTE_TOTAL}, valid until {QUOTE_EXPIRY}.\n\nReply to this email or call us with any questions.\n\n{COMPANY_NAME}`,
        vars
      );
      const result = await messagingHub.send({
        channels,
        to: {
          email: customer.email,
          phone: customer.phone,
          customerId: customer.id,
          customerName: customer.name,
        },
        subject: renderTemplate('Your Quote from {COMPANY_NAME}', vars),
        body,
        eventType: 'quote_sent',
        attachment: attachPdf ? await generateQuotePdfStub(customer.name, totals.total) : undefined,
        templateId: 'quote_ready',
      }, customer);

      if (!result.success) {
        toast.warning(`Quote saved but delivery issue: ${result.errors.join('; ')}`);
      } else {
        const mode = result.logs[0]?.status === 'mock' ? ' (mock)' : '';
        toast.success(`Quote sent via ${result.channels.join(' + ')}${mode}`);
      }
    } else {
      toast.success('Quote saved as sent');
    }

    setShowPreview(false);
    navigate('/');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Quote Builder</h1>
        <p className="text-gray-600 mt-1">Create professional quotes with smart pricing</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} - {customer.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCustomer && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
                  <p className="font-medium">{selectedCustomer.name}</p>
                  <p className="text-gray-600">{selectedCustomer.email} • {selectedCustomer.phone}</p>
                  <p className="text-gray-600">{selectedCustomer.address}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quote Builder</CardTitle>
            </CardHeader>
            <CardContent>
              <QuoteLineEditor lines={lines} discount={discount} onChange={handleLinesChange} />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Quote Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Line items</span>
                  <span>{lines.filter((l) => l.description.trim()).length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span>£{totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">VAT</span>
                  <span>£{totals.vat.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-3 border-t">
                <Label>Discount (%)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={discount}
                    onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                  />
                  <Percent className="w-4 h-4 text-gray-400" />
                </div>
                {discount > 0 && (
                  <p className="text-sm text-green-600 mt-1">
                    Save £{totals.discountAmount.toFixed(2)}
                  </p>
                )}
              </div>

              {discount === 15 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-yellow-800">
                    ⚡ Same-day decision discount applied!
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Offer expires today at midnight
                  </p>
                </div>
              )}

              <div className="pt-3 border-t">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg">Total</span>
                  <span className="font-bold text-2xl text-green-600">
                    £{totals.total.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t">
                <Button onClick={handleSendQuote} className="w-full" disabled={!selectedCustomerId || !hasLines}>
                  <Send className="w-4 h-4 mr-2" />
                  Send Quote
                </Button>
                <Button onClick={handleSaveQuote} variant="outline" className="w-full" disabled={!selectedCustomerId || !hasLines}>
                  <FileText className="w-4 h-4 mr-2" />
                  Save as Draft
                </Button>

                {discount !== 15 && (
                  <Button
                    onClick={() => setDiscount(15)}
                    variant="outline"
                    className="w-full border-yellow-400 text-yellow-700 hover:bg-yellow-50"
                  >
                    Apply 15% Same-Day Discount
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quote Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 p-6 bg-white">
            <div className="border-b pb-4">
              <h2 className="text-2xl font-bold text-gray-900">Bathroom Installation Quote</h2>
              <p className="text-gray-600 mt-1">Bathroom Pro Ltd</p>
            </div>

            {selectedCustomer && (
              <div>
                <h3 className="font-medium mb-2">Customer Details</h3>
                <p>{selectedCustomer.name}</p>
                <p className="text-sm text-gray-600">{selectedCustomer.email}</p>
                <p className="text-sm text-gray-600">{selectedCustomer.phone}</p>
                <p className="text-sm text-gray-600">{selectedCustomer.address}</p>
              </div>
            )}

            {lines.filter((l) => l.description.trim()).length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Line items</h3>
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="pb-2">Description</th>
                      <th className="pb-2 text-right">Qty</th>
                      <th className="pb-2 text-right">Unit</th>
                      <th className="pb-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.filter((l) => l.description.trim()).map((line) => (
                      <tr key={line.id} className="border-b">
                        <td className="py-2">{line.description}</td>
                        <td className="py-2 text-right">{line.quantity}</td>
                        <td className="py-2 text-right">{line.unit}</td>
                        <td className="py-2 text-right">£{line.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>£{totals.subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount ({discount}%)</span>
                  <span>-£{totals.discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>VAT</span>
                <span>£{totals.vat.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold border-t pt-2">
                <span>Total</span>
                <span>£{totals.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
              <p className="font-medium mb-2">Terms & Conditions</p>
              <ul className="space-y-1 text-xs">
                <li>• Quote valid until {new Date().toLocaleDateString()}</li>
                <li>• 50% deposit required to secure booking</li>
                <li>• Unforeseen structural issues not included</li>
                <li>• Price subject to site conditions</li>
                <li>• Additional works charged separately</li>
              </ul>
            </div>

            <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium">Send via</p>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox id="qb-email" checked={sendEmail} onCheckedChange={v => setSendEmail(!!v)} />
                  <Label htmlFor="qb-email">Email</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="qb-wa" checked={sendWhatsApp} onCheckedChange={v => setSendWhatsApp(!!v)} />
                  <Label htmlFor="qb-wa">WhatsApp</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="qb-pdf" checked={attachPdf} onCheckedChange={v => setAttachPdf(!!v)} />
                  <Label htmlFor="qb-pdf">Attach PDF</Label>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={confirmSendQuote} className="flex-1">
                Confirm & Send
              </Button>
              <Button variant="outline" onClick={() => setShowPreview(false)} className="flex-1">
                Back to Edit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
