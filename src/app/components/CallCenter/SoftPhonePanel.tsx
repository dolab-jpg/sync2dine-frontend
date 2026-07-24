'use client';

import { useContext, useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  ExternalLink,
  Copy,
  Check,
  Loader2,
  Smartphone,
  Monitor,
  Globe,
  AlertTriangle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppContext } from '../../App';
import type { PhoneLine } from './CallCenter';
import { getHomeOrgId } from '../../engine/platform/homeOrg';

const MASKED = '••••••';

const VOIS_WEB = 'https://soho66.co.uk/softphone';
const VOIS_WINDOWS = 'https://soho66.co.uk/softphoneapp/';
const GROUNDWIRE_GUIDE = 'http://soho66.co.uk/124483/all/1/Acrobits-Groundwire-Softphone.aspx';
const GROUNDWIRE_IOS =
  'https://apps.apple.com/app/groundwire-voip-sip-phone/id388364593';
const GROUNDWIRE_ANDROID =
  'https://play.google.com/store/apps/details?id=com.acrobits.groundwire';

function isUsablePassword(password?: string): boolean {
  return !!password && password !== MASKED;
}

function normalizeUkDid(did: string): string {
  const d = did.replace(/\D/g, '');
  if (d.startsWith('44') && d.length >= 12) return `+${d}`;
  if (d.startsWith('0') && d.length >= 10) return `+44${d.slice(1)}`;
  if (d.length >= 10) return `+${d}`;
  return did.trim();
}

async function copyText(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`Copied ${label}`);
  } catch {
    toast.error(`Could not copy ${label}`);
  }
}

function CredRow(props: {
  label: string;
  value: string;
  secret?: boolean;
  revealable?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const show = !props.secret || revealed || !props.revealable;
  const display = show ? props.value : MASKED;

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-s2d-ink-muted">{props.label}</p>
        <p className="font-mono text-sm text-s2d-teal-deep truncate">{display || '—'}</p>
      </div>
      {props.revealable && props.secret && (
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="shrink-0 min-h-9 min-w-9 border-s2d-teal/20"
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? 'Hide password' : 'Show password'}
        >
          {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </Button>
      )}
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="shrink-0 min-h-9 min-w-9 border-s2d-teal/20"
        disabled={!props.value}
        onClick={() => void copyText(props.label, props.value)}
        aria-label={`Copy ${props.label}`}
      >
        <Copy className="w-4 h-4" />
      </Button>
    </div>
  );
}

export function SoftPhonePanel(props: { lines?: PhoneLine[]; salesMode?: boolean }) {
  const app = useContext(AppContext);
  const isSales = props.salesMode === true;
  const [myLine, setMyLine] = useState<PhoneLine | null>(null);
  const [loading, setLoading] = useState(true);
  const [transferReady, setTransferReady] = useState<boolean | null>(null);
  const [transferSaving, setTransferSaving] = useState(false);

  const loadMine = async () => {
    if (!app?.user?.id) {
      setMyLine(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/agent/lines/mine', {
        headers: { 'X-User-Id': app.user.id },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMyLine(null);
        return;
      }
      setMyLine(data.line ?? null);
    } catch {
      setMyLine(null);
    } finally {
      setLoading(false);
    }
  };

  const checkTransferReady = async (line: PhoneLine | null) => {
    if (!line?.did) {
      setTransferReady(null);
      return;
    }
    try {
      const headers: HeadersInit = isSales ? { 'X-Org-Id': getHomeOrgId() } : {};
      const res = await fetch('/api/agent/transfer-numbers', { headers });
      const data = await res.json().catch(() => ({}));
      const sales = String(data.transferNumbers?.sales ?? '').replace(/\D/g, '');
      const did = line.did.replace(/\D/g, '');
      const salesNorm = sales.startsWith('44') ? sales : sales.startsWith('0') ? `44${sales.slice(1)}` : sales;
      const didNorm = did.startsWith('44') ? did : did.startsWith('0') ? `44${did.slice(1)}` : did;
      setTransferReady(Boolean(salesNorm) && salesNorm === didNorm);
    } catch {
      setTransferReady(null);
    }
  };

  useEffect(() => {
    void loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when user id changes
  }, [app?.user?.id]);

  useEffect(() => {
    void checkTransferReady(myLine);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- salesMode is stable per shell
  }, [myLine?.id, myLine?.did, isSales]);

  const setAsSallySalesTransfer = async () => {
    if (!myLine?.did) {
      toast.error('This softphone has no DID');
      return;
    }
    setTransferSaving(true);
    try {
      const salesDid = normalizeUkDid(myLine.did);
      const res = await fetch('/api/agent/transfer-numbers', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(isSales ? { 'X-Org-Id': getHomeOrgId() } : {}),
        },
        body: JSON.stringify({ sales: salesDid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to save sales transfer');
      setTransferReady(true);
      toast.success(
        isSales
          ? `Sally will warm-transfer Sales to ${normalizeUkDid(myLine.did)} (rings Groundwire/VOIS)`
          : `Sales transfers will ring ${normalizeUkDid(myLine.did)} on Groundwire/VOIS`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save sales transfer');
    } finally {
      setTransferSaving(false);
    }
  };

  if (loading) {
    return (
      <p className="text-sm text-s2d-ink-muted flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your softphone…
      </p>
    );
  }

  if (!myLine) {
    return (
      <p className="text-sm text-s2d-ink-muted">
        No softphone assigned to you yet. Super Admin can assign a Soho66 extension under Settings → Team →
        Staff Softphones.
      </p>
    );
  }

  const sipPassword = isUsablePassword(myLine.sipPassword) ? myLine.sipPassword : '';

  return (
    <div className="max-w-2xl space-y-4 text-sm">
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium text-amber-950">One device only per SIP line</p>
          <p className="text-amber-900/90 text-xs leading-relaxed">
            Only one app may be logged into this SIP username at a time. Log out of VOIS, Groundwire, or any desk
            phone on the same extension before logging in elsewhere — a second REGISTER steals the line and calls
            fail.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-s2d-teal/15 bg-white px-4 py-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-s2d-teal-deep">{myLine.label}</p>
          {transferReady === true && (
            <Badge className="bg-s2d-gold-soft text-s2d-teal-deep hover:bg-s2d-gold-soft">
              {isSales ? 'Sally sales handoff' : 'Sales transfer'}
            </Badge>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <CredRow label="SIP username" value={myLine.sipUsername || ''} />
          <CredRow
            label="SIP password"
            value={sipPassword}
            secret
            revealable={Boolean(sipPassword)}
          />
          <CredRow label="SIP domain" value={myLine.sipDomain || 'sbc.soho66.co.uk'} />
          <CredRow label="DID" value={myLine.did || ''} />
        </div>
        {!sipPassword && (
          <p className="text-xs text-s2d-ink-muted">
            Password not available here — ask Super Admin to re-save the SIP password under Staff Softphones, or
            copy it from your Soho66 portal.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-s2d-teal/15 bg-white px-4 py-3 space-y-3">
        <p className="font-medium text-s2d-teal-deep">Open an external softphone</p>
        <p className="text-xs text-s2d-ink-muted leading-relaxed">
          Sync2Dine does not register or answer SIP. Use Groundwire (mobile) or Soho66 VOIS, then paste the
          credentials above. Prefer Groundwire if you already use it.
        </p>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <Button asChild className="bg-s2d-teal-deep hover:bg-s2d-teal">
            <a href={GROUNDWIRE_GUIDE} target="_blank" rel="noopener noreferrer">
              <Smartphone className="w-4 h-4 mr-2" />
              Groundwire setup
              <ExternalLink className="w-3.5 h-3.5 ml-2 opacity-80" />
            </a>
          </Button>
          <Button asChild variant="outline" className="border-s2d-teal/20">
            <a href={GROUNDWIRE_IOS} target="_blank" rel="noopener noreferrer">
              App Store
              <ExternalLink className="w-3.5 h-3.5 ml-2 opacity-80" />
            </a>
          </Button>
          <Button asChild variant="outline" className="border-s2d-teal/20">
            <a href={GROUNDWIRE_ANDROID} target="_blank" rel="noopener noreferrer">
              Google Play
              <ExternalLink className="w-3.5 h-3.5 ml-2 opacity-80" />
            </a>
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 pt-1">
          <Button asChild variant="outline" className="border-s2d-teal/20">
            <a href={VOIS_WEB} target="_blank" rel="noopener noreferrer">
              <Globe className="w-4 h-4 mr-2" />
              Open VOIS (web)
              <ExternalLink className="w-3.5 h-3.5 ml-2 opacity-80" />
            </a>
          </Button>
          <Button asChild variant="outline" className="border-s2d-teal/20">
            <a href={VOIS_WINDOWS} target="_blank" rel="noopener noreferrer">
              <Monitor className="w-4 h-4 mr-2" />
              Download VOIS (Windows)
              <ExternalLink className="w-3.5 h-3.5 ml-2 opacity-80" />
            </a>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-s2d-gold/40 bg-s2d-gold-soft/30 px-4 py-3 space-y-2">
        <p className="font-medium text-s2d-teal-deep">
          {isSales ? 'Sally → you (Sales)' : 'AI → Sales transfer'}
        </p>
        <p className="text-s2d-ink-body/80 text-xs leading-relaxed">
          {isSales
            ? 'When Sally warm-transfers a sales caller, Vapi dials the Sales transfer number — not Sync2Dine. Point Sales at this DID so Groundwire or VOIS rings.'
            : 'Set Sales transfer to this DID so mid-call handoffs ring Groundwire or VOIS on this extension.'}
        </p>
        <Button
          size="sm"
          className="bg-s2d-teal-deep hover:bg-s2d-teal"
          onClick={() => void setAsSallySalesTransfer()}
          disabled={transferSaving || transferReady === true}
        >
          {transferSaving ? (
            'Saving…'
          ) : transferReady ? (
            <>
              <Check className="w-3.5 h-3.5 mr-1.5" />
              Already set for Sales
            </>
          ) : (
            `Use ${myLine.did} as Sales transfer`
          )}
        </Button>
      </div>
    </div>
  );
}
