import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Plus, Trash2, Phone } from 'lucide-react';
import { toast } from 'sonner';
import {
  getContactsForCustomer,
  addContact,
  deleteContact,
} from '../engine/contacts/contactStore';
import type { ContactRole } from '../engine/project/types';
import { syncToServer } from '../engine/project/projectStore';
import { normalizeUkPhone } from '../engine/messaging/whatsappProvider';

interface Props {
  customerId: string;
  customerName: string;
  primaryPhone: string;
}

export function CustomerContactsPanel({ customerId, customerName, primaryPhone }: Props) {
  const [contacts, setContacts] = useState(() => getContactsForCustomer(customerId));
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    role: 'partner' as ContactRole,
    whatsappOptIn: true,
  });

  const refresh = () => setContacts(getContactsForCustomer(customerId));

  const handleAdd = () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    addContact({
      customerId,
      name: form.name.trim(),
      phone: normalizeUkPhone(form.phone),
      role: form.role,
      whatsappOptIn: form.whatsappOptIn,
      isPrimary: false,
    });
    syncToServer();
    refresh();
    setForm({ name: '', phone: '', role: 'partner', whatsappOptIn: true });
    setShowAdd(false);
    toast.success('Contact added');
  };

  const ensurePrimary = () => {
    if (contacts.some(c => c.isPrimary)) return;
    if (primaryPhone) {
      addContact({
        customerId,
        name: customerName,
        phone: normalizeUkPhone(primaryPhone),
        role: 'primary',
        whatsappOptIn: true,
        isPrimary: true,
      });
      refresh();
    }
  };

  if (contacts.length === 0) {
    ensurePrimary();
  }

  return (
    <div className="p-4 bg-slate-50 rounded-lg border space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 font-medium">
          <Phone className="w-4 h-4" /> Additional contacts
        </Label>
        <Button type="button" size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="w-3 h-3 mr-1" /> Add
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        Partner, site contact, etc. AI recognises who messaged by any linked number.
      </p>

      {showAdd && (
        <div className="grid grid-cols-2 gap-2 p-3 bg-white rounded border">
          <Input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <Select value={form.role} onValueChange={v => setForm({ ...form, role: v as ContactRole })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="partner">Partner</SelectItem>
              <SelectItem value="site_contact">Site contact</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch checked={form.whatsappOptIn} onCheckedChange={v => setForm({ ...form, whatsappOptIn: v })} />
            <span className="text-xs">WhatsApp opt-in</span>
          </div>
          <Button type="button" size="sm" className="col-span-2" onClick={handleAdd}>Save contact</Button>
        </div>
      )}

      <div className="space-y-2">
        {contacts.map(c => (
          <div key={c.id} className="flex items-center justify-between p-2 bg-white rounded border text-sm">
            <div>
              <p className="font-medium">{c.name} <span className="text-slate-400 font-normal">({c.role})</span></p>
              <p className="text-xs text-slate-500">{c.phone}{c.whatsappOptIn ? ' · WhatsApp' : ''}</p>
            </div>
            {!c.isPrimary && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  deleteContact(c.id);
                  syncToServer();
                  refresh();
                }}
              >
                <Trash2 className="w-3 h-3 text-red-500" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
