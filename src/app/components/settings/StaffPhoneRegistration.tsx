'use client';

import { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';

interface TeamMemberRow {
  id: string;
  userId: string;
  name: string;
  phone: string;
  role: string;
}

export function StaffPhoneRegistration() {
  const app = useContext(AppContext);
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [name, setName] = useState(app?.user.name ?? '');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState(app?.user.role ?? 'staff');

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
    const res = await fetch('/api/org/staff/register-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: app?.user.id ?? `tm-${Date.now()}`,
        userId: app?.user.id,
        name: name || app?.user.name,
        phone,
        role,
      }),
    });
    if (!res.ok) {
      toast.error('Failed to register phone');
      return;
    }
    toast.success('Staff phone registered for WhatsApp routing');
    setPhone('');
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff WhatsApp / phone routing</CardTitle>
        <CardDescription>
          Register team mobiles so inbound WhatsApp and calls route to the staff orchestrator with full tools.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Mobile (E.164 or UK)</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="447..." />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={register}>Register phone</Button>
        {members.length > 0 && (
          <ul className="text-sm space-y-1 border-t pt-3">
            {members.map((m) => (
              <li key={m.id} className="flex justify-between">
                <span>{m.name} · {m.phone}</span>
                <span className="text-gray-500">{m.role}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
