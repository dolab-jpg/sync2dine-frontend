import { useContext, useState } from 'react';
import { Link } from 'react-router';
import { AppContext, type Quote } from '../../App';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { BadgeCheck, X, ExternalLink, FileSignature, ClipboardCheck, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  createContractDraftFromQuote,
  resolveBookingDeposit,
  sendPricePack,
} from '../../engine/salesCloseFlow';
import type { WizardAnswers } from '../../config/types';

const fmt = (n: number) => `£${n.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

export default function ApprovalsQueue() {
  const context = useContext(AppContext);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);

  if (!context) return null;
  const { quotes, updateQuote, user, customers } = context;

  const pending = quotes.filter((q) => q.status === 'awaiting_approval');
  const recentlyHandled = quotes
    .filter((q) => q.status === 'approved' || q.status === 'rejected')
    .slice(-5)
    .reverse();

  const approve = (quote: Quote) => {
    const total = edits[quote.id] ?? quote.total;
    const deposit = resolveBookingDeposit(total, quote.wizardAnswers as WizardAnswers | undefined);
    updateQuote(quote.id, {
      status: 'approved',
      total,
      approval: {
        state: 'approved',
        by: user.name,
        at: new Date().toISOString(),
        note: notes[quote.id],
        originalTotal: quote.approval?.originalTotal ?? quote.total,
      },
    });
    try {
      createContractDraftFromQuote({ ...quote, total, status: 'approved' }, deposit);
      toast.success(`Approved ${quote.customerName} at ${fmt(total)} — contract draft ready`);
    } catch {
      toast.success(`Approved quote for ${quote.customerName} at ${fmt(total)}`);
    }
  };

  const sendPack = async (quote: Quote) => {
    const customer = customers.find((c) => c.id === quote.customerId);
    if (!customer) {
      toast.error('Customer not found for this quote');
      return;
    }
    if (!customer.email && !customer.phone) {
      toast.error('Customer needs an email or phone to receive the pack');
      return;
    }
    setSendingId(quote.id);
    try {
      const approved: Quote = { ...quote, status: 'approved', total: edits[quote.id] ?? quote.total };
      const result = await sendPricePack({
        quote: approved,
        customer,
        userName: user.name,
      });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to send');
        return;
      }
      updateQuote(quote.id, { status: 'sent', total: approved.total });
      toast.success(result.mock ? 'Pack prepared (mock messaging)' : 'Price pack sent to customer');
    } finally {
      setSendingId(null);
    }
  };

  const reject = (quote: Quote) => {
    updateQuote(quote.id, {
      status: 'rejected',
      approval: {
        state: 'rejected',
        by: user.name,
        at: new Date().toISOString(),
        note: notes[quote.id],
        originalTotal: quote.approval?.originalTotal ?? quote.total,
      },
    });
    toast.message(`Rejected quote for ${quote.customerName}`);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-3 rounded-2xl">
          <ClipboardCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Price Approvals</h1>
          <p className="text-gray-600 text-sm">Review AI-priced jobs, adjust the price, and approve before a contract can be sent.</p>
        </div>
      </div>

      {pending.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-gray-500">Nothing awaiting approval right now.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {pending.map((quote) => (
            <Card key={quote.id} className="border-amber-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>{quote.customerName} — {quote.tradeName ?? 'Job'}</span>
                  <Badge variant="outline">awaiting approval</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {quote.pricingResearch?.summary && (
                  <p className="text-sm text-gray-600">{quote.pricingResearch.summary}</p>
                )}

                {quote.items.length > 0 && (
                  <div className="space-y-1">
                    {quote.items.map((it, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-700">{it.name}</span>
                        <span className="text-gray-900">{fmt(it.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {quote.labour.map((l, i) => (
                  <div key={`l-${i}`} className="flex justify-between text-sm text-gray-600">
                    <span>{l.description}</span><span>{fmt(l.total)}</span>
                  </div>
                ))}
                {quote.extras.map((e, i) => (
                  <div key={`e-${i}`} className="flex justify-between text-sm text-gray-600">
                    <span>{e.description}</span><span>{fmt(e.price)}</span>
                  </div>
                ))}

                {quote.pricingResearch && quote.pricingResearch.lines.some((l) => l.sources.length > 0) && (
                  <div className="text-xs text-gray-500">
                    <p className="font-medium mb-1">Local price sources ({quote.pricingResearch.provider})</p>
                    <ul className="space-y-0.5">
                      {quote.pricingResearch.lines.flatMap((l) => l.sources).slice(0, 6).map((s, i) => (
                        <li key={i}>
                          <a href={s.url} target="_blank" rel="noreferrer" className="text-blue-600 inline-flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />{s.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap items-end gap-3 border-t pt-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Approved price (£)</label>
                    <Input
                      type="number"
                      className="w-36"
                      value={edits[quote.id] ?? quote.total}
                      onChange={(e) => setEdits({ ...edits, [quote.id]: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <label className="text-xs text-gray-500 block mb-1">Note (optional)</label>
                    <Textarea
                      rows={1}
                      value={notes[quote.id] ?? ''}
                      onChange={(e) => setNotes({ ...notes, [quote.id]: e.target.value })}
                      placeholder="Reason for change / instructions"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => approve(quote)} className="bg-emerald-600 hover:bg-emerald-700">
                      <BadgeCheck className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button variant="outline" onClick={() => reject(quote)}>
                      <X className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {recentlyHandled.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">Recently handled</h2>
          <div className="space-y-2">
            {recentlyHandled.map((quote) => (
              <Card key={quote.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="text-sm">
                    <span className="font-medium">{quote.customerName}</span>{' '}
                    <span className="text-gray-500">{quote.tradeName ?? 'Job'} • {fmt(quote.total)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={quote.status === 'approved' ? 'default' : 'outline'}>{quote.status}</Badge>
                    {quote.status === 'approved' && (
                      <>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          disabled={sendingId === quote.id}
                          onClick={() => sendPack(quote)}
                        >
                          <Send className="w-4 h-4 mr-1" /> Send pack
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/contracts"><FileSignature className="w-4 h-4 mr-1" /> Contracts</Link>
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
