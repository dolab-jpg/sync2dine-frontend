import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Loader2, Phone, Mail, ExternalLink, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchLeadInbox,
  markLeadHandled,
  type LeadInboxItem,
} from '../../engine/leads/leadInboxService';

interface Props {
  onOpenReply?: (draft: { to: string; subject: string; body: string }) => void;
}

export function LeadInboxPanel({ onOpenReply }: Props) {
  const navigate = useNavigate();
  const [items, setItems] = useState<LeadInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionRequired, setActionRequired] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLeadInbox();
      setItems(data.items.filter(i => i.status !== 'skipped'));
      setActionRequired(data.actionRequired);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleMarkHandled = async (id: string) => {
    await markLeadHandled(id);
    toast.success('Marked as handled');
    void load();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {actionRequired > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-900">
            <strong>{actionRequired}</strong> lead{actionRequired !== 1 ? 's' : ''} need action — AI has parsed incoming emails.
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            No lead emails processed yet. Connect your mailbox and sync — new enquiries will appear here automatically.
          </CardContent>
        </Card>
      ) : (
        items.map(item => (
          <Card key={item.id} className={item.status === 'unparsed' ? 'border-red-200' : ''}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <CardTitle className="text-base">{item.subject}</CardTitle>
                <div className="flex gap-2">
                  <Badge variant={item.status === 'action_required' ? 'default' : 'outline'}>
                    {item.status.replace('_', ' ')}
                  </Badge>
                  {item.mergedDuplicate && <Badge variant="secondary">Duplicate merged</Badge>}
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {item.fromName || item.fromAddr} · {new Date(item.createdAt).toLocaleString()}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm font-medium">{item.summary}</p>
              {(item.customerName || item.phone) && (
                <p className="text-sm text-gray-600">
                  {item.customerName && <span>{item.customerName}</span>}
                  {item.phone && <span>{item.customerName ? ' · ' : ''}{item.phone}</span>}
                </p>
              )}
              <p className="text-sm text-blue-800 bg-blue-50 rounded-lg p-2">
                <strong>Next:</strong> {item.recommendation}
              </p>
              <div className="flex flex-wrap gap-2">
                {item.phone && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={`tel:${item.phone}`}>
                      <Phone className="w-4 h-4 mr-1" /> Call
                    </a>
                  </Button>
                )}
                {item.draftReply && onOpenReply && (
                  <Button size="sm" variant="outline" onClick={() => onOpenReply(item.draftReply!)}>
                    <Mail className="w-4 h-4 mr-1" /> Reply
                  </Button>
                )}
                {item.customerId && (
                  <Button size="sm" variant="outline" onClick={() => navigate(`/crm?lead=${item.customerId}`)}>
                    <ExternalLink className="w-4 h-4 mr-1" /> Open CRM
                  </Button>
                )}
                {item.status !== 'handled' && (
                  <Button size="sm" variant="ghost" onClick={() => void handleMarkHandled(item.id)}>
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Done
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
