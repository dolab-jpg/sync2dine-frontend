import { MapPin, Phone, PoundSterling, FileText, ExternalLink, Mail } from 'lucide-react';
import { Button } from '../ui/button';
import type { CynthiaStaffCard } from '../../engine/cynthia/cynthiaStaffApi';
import { toast } from 'sonner';

interface StaffActionCardProps {
  card: CynthiaStaffCard;
  onNavigate?: (route: string) => void;
  onOpenPdf?: (dataUrl: string, title: string) => void;
  onOpenReport?: (markdown: string, title: string) => void;
  highlight?: boolean;
}

function openExternalUri(uri: string) {
  try {
    const a = document.createElement('a');
    a.href = uri;
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    window.location.href = uri;
  }
}

export function StaffActionCard({
  card,
  onNavigate,
  onOpenPdf,
  onOpenReport,
  highlight,
}: StaffActionCardProps) {
  const amountLabel =
    card.amount != null
      ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: card.currency || 'GBP' }).format(card.amount)
      : null;

  const runAction = (kind: string, value: string) => {
    if (kind === 'call') {
      const digits = value.replace(/[^\d+]/g, '');
      if (!digits) {
        toast.error('No phone number on this card');
        return;
      }
      openExternalUri(`tel:${digits}`);
      toast.message('Opening dialer…');
      return;
    }
    if (kind === 'email') {
      if (!value.trim()) {
        toast.error('No email on this card');
        return;
      }
      openExternalUri(`mailto:${value.trim()}`);
      return;
    }
    if (kind === 'navigate' || kind === 'open') {
      onNavigate?.(value);
    }
  };

  return (
    <div
      className={`rounded-2xl border px-3 py-3 max-w-[92%] shadow-sm ${
        highlight
          ? 'border-emerald-400 bg-emerald-50'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start gap-2">
        <FileText className="h-4 w-4 text-emerald-700 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 leading-snug">{card.title}</p>
          {card.customerName && (
            <p className="text-xs text-slate-600 mt-0.5">{card.customerName}</p>
          )}
        </div>
      </div>

      <div className="mt-2 space-y-1 text-xs text-slate-700">
        {card.address && (
          <p className="flex gap-1.5 items-start">
            <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" />
            <span>{card.address}</span>
          </p>
        )}
        {card.phone && (
          <p className="flex gap-1.5 items-center">
            <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>{card.phone}</span>
          </p>
        )}
        {amountLabel && (
          <p className="flex gap-1.5 items-center font-medium text-slate-900">
            <PoundSterling className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>{amountLabel}</span>
          </p>
        )}
        {card.summary && <p className="text-slate-600 pt-1">{card.summary}</p>}
        {card.notes && <p className="text-slate-500 italic">{card.notes}</p>}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(card.actions ?? []).map((a) => (
          <Button
            key={`${a.kind}-${a.label}`}
            type="button"
            size="sm"
            variant={a.kind === 'call' ? 'default' : 'outline'}
            className="h-8 text-xs rounded-full"
            onClick={() => runAction(a.kind, a.value)}
          >
            {a.kind === 'call' && <Phone className="h-3 w-3 mr-1" />}
            {a.kind === 'email' && <Mail className="h-3 w-3 mr-1" />}
            {(a.kind === 'navigate' || a.kind === 'open') && <ExternalLink className="h-3 w-3 mr-1" />}
            {a.label}
          </Button>
        ))}
        {card.pdfDataUrl && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs rounded-full"
            onClick={() => onOpenPdf?.(card.pdfDataUrl!, card.pdfFilename || card.title)}
          >
            Open PDF
          </Button>
        )}
        {card.reportMarkdown && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs rounded-full"
            onClick={() => onOpenReport?.(card.reportMarkdown!, card.title)}
          >
            Open report
          </Button>
        )}
      </div>
    </div>
  );
}
