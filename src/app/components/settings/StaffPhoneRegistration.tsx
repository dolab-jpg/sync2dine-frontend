'use client';

import { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { LANG_OPTIONS, normalizeLang, type SupportedLang } from '../../i18n/languages';

interface TeamMemberRow {
  id: string;
  userId: string;
  name: string;
  phone: string;
  role: string;
  preferredLanguage?: string | null;
  hasPhonePin?: boolean;
}

export function StaffPhoneRegistration() {
  const app = useContext(AppContext);
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [name, setName] = useState(app?.user.name ?? '');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState(app?.user.role ?? 'staff');
  const [preferredLanguage, setPreferredLanguage] = useState<SupportedLang>('en');
  const [phonePin, setPhonePin] = useState('');
  const [phonePinConfirm, setPhonePinConfirm] = useState('');
  const [resetMemberId, setResetMemberId] = useState<string | null>(null);
  const [resetPin, setResetPin] = useState('');

  const load = () => {
    void fetch('/api/org/staff/list')
      .then((r) => r.json())
      .then((d) => setMembers(d.members ?? []))
      .catch(() => undefined);
  };

  useEffect(() => { load(); }, []);

  const register = async () => {
    if (!phone.trim()) {
      toast.error('Enter a mobile number');
      return;
    }
    if (!/^\d{4}$/.test(phonePin.replace(/\D/g, ''))) {
      toast.error('Phone PIN must be exactly 4 digits');
      return;
    }
    if (phonePin !== phonePinConfirm) {
      toast.error('PIN confirmation does not match');
      return;
    }
    const res = await fetch('/api/org/staff/register-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: app?.user.id ?? `tm-${Date.now()}`,
        userId: app?.user.id,
        name: name || app?.user.name,
        phone,
        role,
        preferredLanguage,
        phonePin: phonePin.replace(/\D/g, ''),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || 'Failed to register phone');
      return;
    }
    toast.success(`Registered — save PIN ${data.phonePinOnce || phonePin.replace(/\D/g, '')} (shown once)`);
    setPhone('');
    setPhonePin('');
    setPhonePinConfirm('');
    load();
  };

  const resetPinFor = async (memberId: string) => {
    const pin = resetPin.replace(/\D/g, '');
    if (!/^\d{4}$/.test(pin)) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }
    const res = await fetch('/api/org/staff/phone-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: memberId, phonePin: pin }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || 'Failed to reset PIN');
      return;
    }
    toast.success(`PIN updated — remember ${pin}`);
    setResetMemberId(null);
    setResetPin('');
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff WhatsApp / phone routing</CardTitle>
        <CardDescription>
          Register team mobiles and a 4-digit phone PIN. On Cynthia calls from that number, say the digits to unlock staff/builder tools — Cynthia keeps chatting if the code is wrong.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Mobile (E.164 or UK)</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="447..." />
          </div>
          <div>
            <Label>Language</Label>
            <Select
              value={preferredLanguage}
              onValueChange={(v) => setPreferredLanguage(normalizeLang(v))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANG_OPTIONS.map((opt) => (
                  <SelectItem key={opt.code} value={opt.code}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="staff">Staff (office / sales)</SelectItem>
                <SelectItem value="builder">Builder</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Phone PIN (4 digits)</Label>
            <Input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={4}
              value={phonePin}
              onChange={(e) => setPhonePin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
            />
          </div>
          <div>
            <Label>Confirm PIN</Label>
            <Input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={4}
              value={phonePinConfirm}
              onChange={(e) => setPhonePinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
            />
          </div>
        </div>
        <Button onClick={() => void register()}>Register phone</Button>
        {members.length > 0 && (
          <ul className="text-sm space-y-2 border-t pt-3">
            {members.map((m) => (
              <li key={m.id} className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{m.name} · {m.phone}</span>
                  <span className="text-gray-500">
                    {m.role}
                    {m.hasPhonePin ? ' · PIN set' : ' · no PIN'}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setResetMemberId(m.id);
                      setResetPin('');
                    }}
                  >
                    Reset PIN
                  </Button>
                </div>
                {resetMemberId === m.id && (
                  <div className="flex flex-wrap items-end gap-2 pl-1">
                    <div>
                      <Label>New PIN (4 digits)</Label>
                      <Input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={resetPin}
                        onChange={(e) => setResetPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        className="w-32"
                      />
                    </div>
                    <Button size="sm" onClick={() => void resetPinFor(m.id)}>Save PIN</Button>
                    <Button size="sm" variant="ghost" onClick={() => setResetMemberId(null)}>Cancel</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
