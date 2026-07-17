/**
 * Settings → Phone & Soho66 — staff home for trunk setup, rates, and usage.
 */
import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Loader2, Phone, Radio, Save, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { getActiveOrgId } from '../../engine/platform/orgContext';
import { BDIDDIES_HOME_ORG_ID } from '../../engine/platform/homeOrg';
import { StaffSoftphones } from './StaffSoftphones';

const API = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/$/, '');

interface PhoneBilling {
  phoneMinutesIncluded: number;
  phoneRateMobilePerMin: number;
  phoneRateLandlinePerMin: number;
  soho66SipUsername?: string;
  soho66SipPassword?: string;
  soho66SipDomain?: string;
  soho66FromNumber?: string;
  soho66BridgeUrl?: string;
  hasSoho66Password?: boolean;
}

interface PhoneUsage {
  outboundMinutes: number;
  mobileMinutes: number;
  landlineMinutes: number;
  freeMinutesRemaining: number;
  overageMobileMinutes: number;
  overageLandlineMinutes: number;
  estimatedCostGbp: number;
  phoneMinutesIncluded: number;
  callCount: number;
}

interface ElevenLabsStatus {
  configured: boolean;
  source: 'org' | 'platform' | 'none';
  maskedHint?: string;
  charactersThisMonth?: number;
  monthlyCharCap?: number;
  voiceId?: string;
}

function authHeaders(): HeadersInit {
  const orgId = getActiveOrgId() || BDIDDIES_HOME_ORG_ID;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Org-Id': orgId,
  };
  try {
    const raw = localStorage.getItem('authUser') || localStorage.getItem('user');
    if (raw) {
      const u = JSON.parse(raw) as { role?: string; id?: string };
      if (u.role) headers['X-User-Role'] = u.role;
      if (u.id) headers['X-User-Id'] = u.id;
    }
  } catch {
    /* ignore */
  }
  return headers;
}

export function PhoneSohoSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [billing, setBilling] = useState<PhoneBilling>({
    phoneMinutesIncluded: 100,
    phoneRateMobilePerMin: 0.12,
    phoneRateLandlinePerMin: 0.03,
    soho66SipDomain: 'sbc.soho66.co.uk',
  });
  const [usage, setUsage] = useState<PhoneUsage | null>(null);
  const [eleven, setEleven] = useState<ElevenLabsStatus | null>(null);
  const [elKey, setElKey] = useState('');
  const [sipPassword, setSipPassword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = authHeaders();
      const [bRes, uRes, eRes] = await Promise.all([
        fetch(`${API}/api/org/phone-billing`, { headers }),
        fetch(`${API}/api/org/phone-usage`, { headers }),
        fetch(`${API}/api/org/elevenlabs-key`, { headers }),
      ]);
      if (bRes.ok) {
        const b = (await bRes.json()) as PhoneBilling;
        setBilling((prev) => ({ ...prev, ...b }));
      }
      if (uRes.ok) setUsage((await uRes.json()) as PhoneUsage);
      if (eRes.ok) setEleven((await eRes.json()) as ElevenLabsStatus);
    } catch {
      toast.error('Could not load phone / ElevenLabs settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveBilling = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/org/phone-billing`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          phoneMinutesIncluded: Number(billing.phoneMinutesIncluded),
          phoneRateMobilePerMin: Number(billing.phoneRateMobilePerMin),
          phoneRateLandlinePerMin: Number(billing.phoneRateLandlinePerMin),
          soho66SipUsername: billing.soho66SipUsername,
          soho66SipPassword: sipPassword || undefined,
          soho66SipDomain: billing.soho66SipDomain,
          soho66FromNumber: billing.soho66FromNumber,
          soho66BridgeUrl: billing.soho66BridgeUrl,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Phone & Soho66 settings saved');
      setSipPassword('');
      await load();
    } catch {
      toast.error('Failed to save phone settings');
    } finally {
      setSaving(false);
    }
  };

  const saveElevenLabs = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/org/elevenlabs-key`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          apiKey: elKey,
          voiceId: eleven?.voiceId,
          monthlyCharCap: eleven?.monthlyCharCap,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('ElevenLabs key saved for this organisation');
      setElKey('');
      await load();
    } catch {
      toast.error('Failed to save ElevenLabs key');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-gray-600">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading phone settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Phone className="w-5 h-5" />
          Phone &amp; Soho66
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Configure the Soho66 trunk, outbound minute rates, and see this month&apos;s usage.
          Softphones and DIDs can also be managed in Call Centre → Phone Lines.
        </p>
      </div>

      {usage && (
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Outbound usage this month</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <Label className="text-xs text-gray-500">Minutes used</Label>
              <p className="font-semibold text-lg">{usage.outboundMinutes}</p>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Free left</Label>
              <p className="font-semibold text-lg text-green-700">{usage.freeMinutesRemaining}</p>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Mobile / Landline</Label>
              <p className="font-semibold">
                {usage.mobileMinutes} / {usage.landlineMinutes} min
              </p>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Est. overage</Label>
              <p className="font-semibold text-lg">£{usage.estimatedCostGbp.toFixed(2)}</p>
            </div>
            <div className="col-span-2 sm:col-span-4 text-xs text-gray-500">
              {usage.callCount} metered outbound call(s). Free allowance {usage.phoneMinutesIncluded}{' '}
              min/month; overage charged at mobile vs landline rates below.
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Radio className="w-4 h-4" />
            Soho66 trunk
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>SIP username</Label>
              <Input
                value={billing.soho66SipUsername ?? ''}
                onChange={(e) =>
                  setBilling({ ...billing, soho66SipUsername: e.target.value })
                }
                placeholder="Soho66 SIP user"
              />
            </div>
            <div>
              <Label>SIP password {billing.hasSoho66Password ? '(saved)' : ''}</Label>
              <Input
                type="password"
                value={sipPassword}
                onChange={(e) => setSipPassword(e.target.value)}
                placeholder={billing.hasSoho66Password ? '••••••' : 'Enter password'}
              />
            </div>
            <div>
              <Label>SIP domain</Label>
              <Input
                value={billing.soho66SipDomain ?? ''}
                onChange={(e) =>
                  setBilling({ ...billing, soho66SipDomain: e.target.value })
                }
                placeholder="sbc.soho66.co.uk"
              />
            </div>
            <div>
              <Label>From / DID number</Label>
              <Input
                value={billing.soho66FromNumber ?? ''}
                onChange={(e) =>
                  setBilling({ ...billing, soho66FromNumber: e.target.value })
                }
                placeholder="+44…"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Bridge URL (optional)</Label>
              <Input
                value={billing.soho66BridgeUrl ?? ''}
                onChange={(e) =>
                  setBilling({ ...billing, soho66BridgeUrl: e.target.value })
                }
                placeholder="https://…"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Free minutes &amp; rates (GBP)</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label>Free minutes / month</Label>
            <Input
              type="number"
              min={0}
              value={billing.phoneMinutesIncluded}
              onChange={(e) =>
                setBilling({ ...billing, phoneMinutesIncluded: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>Mobile £ / min (higher)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={billing.phoneRateMobilePerMin}
              onChange={(e) =>
                setBilling({ ...billing, phoneRateMobilePerMin: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>Landline £ / min (lower)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={billing.phoneRateLandlinePerMin}
              onChange={(e) =>
                setBilling({
                  ...billing,
                  phoneRateLandlinePerMin: Number(e.target.value),
                })
              }
            />
          </div>
          <div className="sm:col-span-3">
            <Button onClick={() => void saveBilling()} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save phone &amp; Soho66
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            ElevenLabs
            {eleven && (
              <Badge variant="secondary">
                {eleven.source === 'org'
                  ? 'Org key'
                  : eleven.source === 'platform'
                    ? 'Platform key'
                    : 'Not configured'}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            Characters this month:{' '}
            <strong>{eleven?.charactersThisMonth?.toLocaleString() ?? 0}</strong>
            {eleven?.maskedHint ? ` · ${eleven.maskedHint}` : ''}
          </p>
          <div>
            <Label>Organisation API key (optional override)</Label>
            <Input
              type="password"
              value={elKey}
              onChange={(e) => setElKey(e.target.value)}
              placeholder="sk_… leave blank to keep platform key"
            />
          </div>
          <Button variant="outline" onClick={() => void saveElevenLabs()} disabled={saving || !elKey}>
            Save ElevenLabs key
          </Button>
          <p className="text-xs text-gray-500">
            Also available under Settings → API → ElevenLabs. Voice runtime uses org key when set,
            otherwise the platform env key.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff softphones</CardTitle>
        </CardHeader>
        <CardContent>
          <StaffSoftphones />
          <a
            href="/call-centre"
            className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline mt-3"
          >
            Open Call Centre Phone Lines <ExternalLink className="w-3 h-3" />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
