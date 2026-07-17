import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Megaphone, RefreshCw, PhoneOutgoing } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Batch lapsed-customer campaigns (Super Master C11).
 * Wired to the live campaign APIs — preview who lapsed, then queue review /
 * reorder / win-back calls into the existing outbound queue (pause/stop apply).
 */

interface CampaignTemplate {
  id: string;
  label: string;
  defaultDays: number;
  brief: string;
}

interface LapsedCustomerRow {
  customerId?: string;
  customerName: string;
  phone: string;
  lastOrderAt: string;
  daysSinceOrder: number;
  orderCount: number;
}

export default function LapsedCampaignPanel({ onQueued }: { onQueued?: () => void }) {
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [templateId, setTemplateId] = useState('lapse_winback');
  const [days, setDays] = useState('30');
  const [rows, setRows] = useState<LapsedCustomerRow[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [queueing, setQueueing] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/campaigns/templates');
        const data = await res.json();
        if (Array.isArray(data.templates) && data.templates.length) {
          setTemplates(data.templates);
        }
      } catch {
        // panel still works with the default template id
      }
    })();
  }, []);

  const activeTemplate = templates.find((t) => t.id === templateId);

  const handleTemplateChange = (id: string) => {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl?.defaultDays) setDays(String(tpl.defaultDays));
    setRows(null);
  };

  const preview = useCallback(async () => {
    const daysNum = Math.max(1, parseInt(days, 10) || 30);
    setPreviewing(true);
    try {
      const res = await fetch(`/api/campaigns/lapsed-customers?days=${daysNum}`);
      const data = await res.json();
      setRows(Array.isArray(data.customers) ? data.customers : []);
    } catch {
      toast.error('Could not load lapsed customers');
    } finally {
      setPreviewing(false);
    }
  }, [days]);

  const queueCampaign = useCallback(async () => {
    const daysNum = Math.max(1, parseInt(days, 10) || 30);
    setQueueing(true);
    try {
      const res = await fetch('/api/campaigns/queue-lapsed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: templateId, daysOlderThan: daysNum, dryRun: false }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || `Queue failed (${res.status})`);
      }
      const skipped = Math.max(0, (data.candidates?.length ?? 0) - (data.queued ?? 0));
      toast.success(
        `Queued ${data.queued ?? 0} call${data.queued === 1 ? '' : 's'}${skipped ? ` (${skipped} skipped — already queued or no dialable number)` : ''}`,
        { duration: 8000 },
      );
      setRows(null);
      onQueued?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Campaign queue failed');
    } finally {
      setQueueing(false);
    }
  }, [days, templateId, onQueued]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          Lapsed customer campaigns
        </CardTitle>
        <CardDescription>
          Preview customers who have not ordered recently, then queue review, reorder, or win-back calls.
          Queued calls respect the outbound queue pause/stop controls above.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Label>Campaign</Label>
            <Select value={templateId} onValueChange={handleTemplateChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(templates.length ? templates : [
                  { id: 'customer_review', label: 'Customer review call', defaultDays: 3, brief: '' },
                  { id: 'customer_reorder', label: 'Reorder reminder', defaultDays: 14, brief: '' },
                  { id: 'lapse_winback', label: 'Lapse win-back', defaultDays: 30, brief: '' },
                ]).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeTemplate?.brief && (
              <p className="mt-1 text-xs text-slate-500">Brief: {activeTemplate.brief}</p>
            )}
          </div>
          <div>
            <Label>No order in (days)</Label>
            <Input
              type="number"
              min="1"
              value={days}
              onChange={(e) => { setDays(e.target.value); setRows(null); }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void preview()} disabled={previewing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${previewing ? 'animate-spin' : ''}`} />
            Preview lapsed customers
          </Button>
          <Button
            onClick={() => void queueCampaign()}
            disabled={queueing || (rows !== null && rows.length === 0)}
          >
            <PhoneOutgoing className="mr-2 h-4 w-4" />
            {queueing ? 'Queueing…' : `Queue ${rows?.length ?? ''} call${rows?.length === 1 ? '' : 's'}`}
          </Button>
        </div>

        {rows !== null && (
          rows.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              No customers have lapsed beyond {days} days — nothing to call.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">Last order</th>
                    <th className="px-3 py-2 text-right">Days ago</th>
                    <th className="px-3 py-2 text-right">Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.customerId ?? row.phone} className="border-t">
                      <td className="px-3 py-2 font-medium">{row.customerName}</td>
                      <td className="px-3 py-2">{row.phone}</td>
                      <td className="px-3 py-2">{new Date(row.lastOrderAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-right">
                        <Badge variant="secondary">{row.daysSinceOrder}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right">{row.orderCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
