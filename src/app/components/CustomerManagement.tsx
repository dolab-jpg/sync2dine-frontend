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
import { Plus, Search, Phone, Mail, MapPin, FileText, Trash2, Edit, MessageCircle } from 'lucide-react';
import { Switch } from './ui/switch';
import { toast } from 'sonner';
import { AddressMapLink } from './ui/AddressMapLink';
import { CustomerContactsPanel } from './CustomerContactsPanel';
import { seedContactsFromCustomers } from '../engine/contacts/contactStore';
import { syncToServer } from '../engine/project/projectStore';
import { getAllTrades } from '../config/trades';
import type { TradeId } from '../config/types';
import { LANG_OPTIONS } from '../i18n/languages';
import { getExperience } from '../engine/platform/experience';

export default function CustomerManagement() {
  const context = useContext(AppContext);
  if (!context) return null;

  const { customers, addCustomer, updateCustomer, deleteCustomer, user } = context;
  const isRestaurant = getExperience(user.role) === 'restaurant';

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
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    status: 'lead' as Customer['status'],
    notes: '',
    specialName: '',
    specialDealNote: '',
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
      specialName: '',
      specialDealNote: '',
      photos: [],
      whatsappOptIn: false,
      preferredChannel: 'email',
      preferredLanguage: 'en',
      interestedTrades: [],
    });
    setEditingCustomer(null);
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

    setIsSubmitting(true);
    try {
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
      specialName: customer.specialName ?? '',
      specialDealNote: customer.specialDealNote ?? '',
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

              <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 space-y-3">
                <div>
                  <Label htmlFor="specialName">Named special (phone)</Label>
                  <p className="text-xs text-amber-900/70 mb-1">
                    Lizzie asks for this by name — e.g. “Family Friday” or “VIP ten percent”.
                  </p>
                  <Input
                    id="specialName"
                    value={formData.specialName}
                    onChange={e => setFormData({ ...formData, specialName: e.target.value })}
                    placeholder="e.g. Family Friday"
                  />
                </div>
                <div>
                  <Label htmlFor="specialDealNote">Deal note for Lizzie</Label>
                  <p className="text-xs text-amber-900/70 mb-1">
                    Exact deal she must apply when they use that special. Include “10% off” for an automatic discount.
                  </p>
                  <Textarea
                    id="specialDealNote"
                    value={formData.specialDealNote}
                    onChange={e => setFormData({ ...formData, specialDealNote: e.target.value })}
                    rows={2}
                    placeholder="e.g. 10% off the whole order · or free garlic bread with any main"
                  />
                </div>
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
            <Card
              key={customer.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setViewingCustomer(customer)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{customer.name}</CardTitle>
                    <span className={`inline-block px-2 py-1 text-xs rounded-full mt-2 ${getStatusColor(customer.status)}`}>
                      {customer.status}
                    </span>
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
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
                    <a href={`tel:${customer.phone}`} className="hover:text-blue-600" onClick={(e) => e.stopPropagation()}>{customer.phone}</a>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4" />
                    <a href={`mailto:${customer.email}`} className="hover:text-blue-600 truncate" onClick={(e) => e.stopPropagation()}>{customer.email}</a>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-gray-600" onClick={(e) => e.stopPropagation()}>
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <AddressMapLink address={customer.address} />
                  </div>
                  {!isRestaurant && customer.interestedTrades && customer.interestedTrades.length > 0 && (
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
                  {customer.specialName && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5">
                      <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Special</p>
                      <p className="text-sm font-semibold text-amber-950">{customer.specialName}</p>
                      {customer.specialDealNote ? (
                        <p className="text-xs text-amber-900/80 line-clamp-2 mt-0.5">{customer.specialDealNote}</p>
                      ) : null}
                    </div>
                  )}
                  {customer.notes && (
                    <div className="pt-2 mt-2 border-t border-gray-200">
                      <p className="text-sm text-gray-600 line-clamp-2">{customer.notes}</p>
                    </div>
                  )}
                  {!isRestaurant && (
                    <div className="pt-2 mt-2 border-t border-gray-200" onClick={(e) => e.stopPropagation()}>
                      <Link to={`/quote/${customer.interestedTrades?.[0] ?? 'bathroom'}/${customer.id}`}>
                        <Button variant="outline" size="sm" className="w-full">
                          <FileText className="w-4 h-4 mr-2" />
                          Create Quote
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!viewingCustomer} onOpenChange={(open) => { if (!open) setViewingCustomer(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {viewingCustomer && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-black">{viewingCustomer.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <span className={`inline-block px-2 py-1 text-xs rounded-full ${getStatusColor(viewingCustomer.status)}`}>
                  {viewingCustomer.status}
                </span>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-slate-500" />
                  <a href={`tel:${viewingCustomer.phone}`} className="font-semibold text-s2d-teal-deep hover:underline">
                    {viewingCustomer.phone || 'No phone'}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <a href={`mailto:${viewingCustomer.email}`} className="font-semibold text-s2d-teal-deep hover:underline truncate">
                    {viewingCustomer.email || 'No email'}
                  </a>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 mt-0.5 text-slate-500 shrink-0" />
                  <AddressMapLink address={viewingCustomer.address} />
                </div>
                {viewingCustomer.specialName && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Special / deal</p>
                    <p className="font-semibold text-amber-950">{viewingCustomer.specialName}</p>
                    {viewingCustomer.specialDealNote ? (
                      <p className="text-sm text-amber-900/80 mt-1">{viewingCustomer.specialDealNote}</p>
                    ) : null}
                  </div>
                )}
                {viewingCustomer.notes && (
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs font-bold uppercase text-slate-500">Notes</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{viewingCustomer.notes}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  {viewingCustomer.phone && (
                    <Button asChild className="rounded-xl bg-s2d-teal-deep font-bold text-white">
                      <a href={`tel:${viewingCustomer.phone}`}>
                        <Phone className="w-4 h-4 mr-2" />
                        Call
                      </a>
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl font-bold"
                    onClick={() => {
                      const c = viewingCustomer;
                      setViewingCustomer(null);
                      handleEdit(c);
                    }}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl font-bold text-red-600"
                    onClick={() => {
                      const id = viewingCustomer.id;
                      setViewingCustomer(null);
                      handleDelete(id);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
