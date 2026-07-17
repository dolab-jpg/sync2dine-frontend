import { useContext, useState, useEffect } from 'react';
import { AppContext, Customer } from '../App';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, Search, Phone, Mail, MapPin, FileText, Trash2, Edit, MessageCircle, KeyRound } from 'lucide-react';
import { Switch } from './ui/switch';
import { toast } from 'sonner';
import { PasswordField } from '../auth/components/PasswordField';
import { createCustomerLogin } from '../auth/lib/authApi';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase/client';
import { AddressMapLink } from './ui/AddressMapLink';
import { CustomerContactsPanel } from './CustomerContactsPanel';
import { seedContactsFromCustomers } from '../engine/contacts/contactStore';
import { syncToServer } from '../engine/project/projectStore';
import { getAllTrades } from '../config/trades';
import type { TradeId } from '../config/types';
import { LANG_OPTIONS } from '../i18n/languages';

export default function CustomerManagement() {
  const context = useContext(AppContext);
  if (!context) return null;

  const { customers, addCustomer, updateCustomer, deleteCustomer } = context;

  useEffect(() => {
    seedContactsFromCustomers(customers);
    syncToServer();
  }, [customers]);

  useEffect(() => {
    const onPersistError = (event: Event) => {
      const detail = (event as CustomEvent<{ table?: string; error?: string }>).detail;
      if (detail?.table === 'customers') {
        toast.error(`Customer not saved to cloud: ${detail.error || 'unknown error'}`);
      }
    };
    window.addEventListener('tradepro:persist-error', onPersistError);
    return () => window.removeEventListener('tradepro:persist-error', onPersistError);
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [portalPassword, setPortalPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    status: 'lead' as Customer['status'],
    notes: '',
    photos: [] as string[],
    whatsappOptIn: false,
    preferredChannel: 'email' as Customer['preferredChannel'],
    preferredLanguage: 'en' as NonNullable<Customer['preferredLanguage']>,
    interestedTrades: [] as TradeId[],
  });

  const toggleTrade = (tradeId: TradeId) => {
    setFormData(prev => ({
      ...prev,
      interestedTrades: prev.interestedTrades.includes(tradeId)
        ? prev.interestedTrades.filter(t => t !== tradeId)
        : [...prev.interestedTrades, tradeId],
    }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      status: 'lead',
      notes: '',
      photos: [],
      whatsappOptIn: false,
      preferredChannel: 'email',
      preferredLanguage: 'en',
      interestedTrades: [],
    });
    setEditingCustomer(null);
    setPortalPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (editingCustomer) {
      updateCustomer(editingCustomer.id, formData);
      toast.success('Customer updated successfully');
      setIsAddDialogOpen(false);
      resetForm();
      return;
    }

    const wantsPortalLogin = portalPassword.trim().length > 0;
    if (wantsPortalLogin && portalPassword.length < 8) {
      toast.error('Portal password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      if (wantsPortalLogin) {
        if (!isSupabaseConfigured()) {
          toast.error('Supabase is not configured — cannot create a portal login');
          return;
        }
        const { data } = await getSupabase().auth.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) {
          toast.error('You must be signed in to create a customer portal login');
          return;
        }
        try {
          const result = await createCustomerLogin(
            { name: formData.name, email: formData.email, password: portalPassword },
            accessToken,
          );
          toast.success(`Portal login created for ${result.user.email}`);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to create portal login');
          return;
        }
      }
      addCustomer(formData);
      toast.success('Customer added successfully');
      setIsAddDialogOpen(false);
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      status: customer.status,
      notes: customer.notes,
      photos: customer.photos,
      whatsappOptIn: customer.whatsappOptIn ?? false,
      preferredChannel: customer.preferredChannel ?? 'email',
      preferredLanguage: customer.preferredLanguage ?? 'en',
      interestedTrades: customer.interestedTrades ?? [],
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this customer?')) {
      deleteCustomer(id);
      toast.success('Customer deleted');
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = (customer.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.email ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm);
    const matchesStatus = filterStatus === 'all' || customer.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: Customer['status']) => {
    switch (status) {
      case 'lead': return 'bg-yellow-100 text-yellow-700';
      case 'quoted': return 'bg-blue-100 text-blue-700';
      case 'won': return 'bg-green-100 text-green-700';
      case 'lost': return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
          <p className="text-gray-600 mt-1">Manage your customer database and track leads</p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={formData.phone}
                    onChange={e => setFormData({
                      ...formData,
                      phone: e.target.value.replace(/[^\d+\s()-]/g, ''),
                    })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value: Customer['status']) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="quoted">Quoted</SelectItem>
                    <SelectItem value="won">Won</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <Label>Interested trades</Label>
                <p className="text-xs text-gray-500 mb-2">Select all trades this customer may need — AI can also set these</p>
                <div className="flex flex-wrap gap-2">
                  {getAllTrades().map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTrade(t.id)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        formData.interestedTrades.includes(t.id)
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-green-50 rounded-lg border border-green-200 space-y-4">
                <div className="flex items-center gap-2 font-medium text-green-900">
                  <MessageCircle className="w-4 h-4" /> WhatsApp & Communications
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="whatsappOptIn">WhatsApp opt-in</Label>
                  <Switch
                    id="whatsappOptIn"
                    checked={formData.whatsappOptIn}
                    onCheckedChange={v => setFormData({ ...formData, whatsappOptIn: v })}
                  />
                </div>
                <div>
                  <Label htmlFor="preferredChannel">Preferred channel</Label>
                  <Select
                    value={formData.preferredChannel}
                    onValueChange={(v: Customer['preferredChannel']) => setFormData({ ...formData, preferredChannel: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="preferredLanguage">Preferred language</Label>
                  <Select
                    value={formData.preferredLanguage}
                    onValueChange={(v: NonNullable<Customer['preferredLanguage']>) =>
                      setFormData({ ...formData, preferredLanguage: v })
                    }
                  >
                    <SelectTrigger id="preferredLanguage"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LANG_OPTIONS.map((opt) => (
                        <SelectItem key={opt.code} value={opt.code}>
                          {opt.flag} {opt.label} — {opt.persona}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-green-800 mt-1">
                    Spoken/chat language for phone and WhatsApp. Emails, contracts, quotes, and documents stay English.
                  </p>
                </div>
                <p className="text-xs text-green-800">Phone format: UK mobile e.g. 07700 900000 or +447700900000</p>
              </div>

              {!editingCustomer && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
                  <div className="flex items-center gap-2 font-medium text-blue-900">
                    <KeyRound className="w-4 h-4" /> Create portal login (optional)
                  </div>
                  <p className="text-xs text-blue-800">
                    Set a password to create a real login for this customer using the email above.
                    They can sign in at /login to view their projects. Leave blank to skip.
                  </p>
                  <PasswordField
                    id="portalPassword"
                    label="Portal password"
                    value={portalPassword}
                    onChange={setPortalPassword}
                    placeholder="Min 8 characters — leave blank to skip"
                    autoComplete="new-password"
                    disabled={isSubmitting}
                  />
                </div>
              )}

              {editingCustomer && (
                <CustomerContactsPanel
                  customerId={editingCustomer.id}
                  customerName={editingCustomer.name}
                  primaryPhone={formData.phone}
                />
              )}

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => {
                  setIsAddDialogOpen(false);
                  resetForm();
                }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving…' : `${editingCustomer ? 'Update' : 'Add'} Customer`}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search customers..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="lead">Leads</SelectItem>
            <SelectItem value="quoted">Quoted</SelectItem>
            <SelectItem value="won">Won</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredCustomers.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-500 mb-4">
              {searchTerm || filterStatus !== 'all' ? 'No customers match your filters' : 'No customers yet'}
            </p>
            {!searchTerm && filterStatus === 'all' && (
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Customer
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map(customer => (
            <Card key={customer.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{customer.name}</CardTitle>
                    <span className={`inline-block px-2 py-1 text-xs rounded-full mt-2 ${getStatusColor(customer.status)}`}>
                      {customer.status}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(customer)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(customer.id)}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4" />
                    <a href={`tel:${customer.phone}`} className="hover:text-blue-600">{customer.phone}</a>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4" />
                    <a href={`mailto:${customer.email}`} className="hover:text-blue-600 truncate">{customer.email}</a>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <AddressMapLink address={customer.address} />
                  </div>
                  {customer.interestedTrades && customer.interestedTrades.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {customer.interestedTrades.map(tid => {
                        const t = getAllTrades().find(tr => tr.id === tid);
                        return (
                          <span key={tid} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            {t?.name ?? tid}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {customer.notes && (
                    <div className="pt-2 mt-2 border-t border-gray-200">
                      <p className="text-sm text-gray-600 line-clamp-2">{customer.notes}</p>
                    </div>
                  )}
                  <div className="pt-2 mt-2 border-t border-gray-200">
                    <Link to={`/quote/${customer.interestedTrades?.[0] ?? 'bathroom'}/${customer.id}`}>
                      <Button variant="outline" size="sm" className="w-full">
                        <FileText className="w-4 h-4 mr-2" />
                        Create Quote
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
