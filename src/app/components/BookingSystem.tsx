import { useContext, useEffect, useRef, useState } from 'react';
import { AppContext, Customer } from '../App';
import { useLocation, useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Calendar, Clock, Mail, MessageSquare, User, MapPin, Phone, Search, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { messagingHub } from '../engine/messaging/messagingHub';
import { renderTemplate } from '../engine/messaging/templateRenderer';

type BookingCustomerState = Pick<Customer, 'id' | 'name' | 'email' | 'phone' | 'address'>;

export default function BookingSystem() {
  const context = useContext(AppContext);
  const navigate = useNavigate();
  const location = useLocation();
  const customers = context?.customers ?? [];

  const [step, setStep] = useState(0);
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    postcode: '',
    preferredDate: '',
    preferredTime: '',
    notes: '',
    sendSMS: true,
    sendEmail: true
  });

  const timeSlots = [
    '09:00 - 10:00',
    '10:00 - 11:00',
    '11:00 - 12:00',
    '12:00 - 13:00',
    '14:00 - 15:00',
    '15:00 - 16:00',
    '16:00 - 17:00',
    '17:00 - 18:00'
  ];

  const prefillCustomer = (customer: BookingCustomerState) => {
    const addressParts = customer.address.split(',');
    const existing = customers.find(
      c => c.id === customer.id || c.email.toLowerCase() === customer.email.toLowerCase()
    );

    setCustomerMode('existing');
    setSelectedCustomerId(existing?.id ?? '');
    setFormData(prev => ({
      ...prev,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: addressParts[0]?.trim() || customer.address,
      postcode: addressParts[addressParts.length - 1]?.trim() || '',
    }));
    setStep(1);
  };

  const handleSelectCustomer = (customer: Customer) => {
    prefillCustomer(customer);
  };

  const hasPrefilledFromNavigation = useRef(false);

  useEffect(() => {
    const state = location.state as { customer?: BookingCustomerState } | null;
    if (!state?.customer || hasPrefilledFromNavigation.current) return;

    hasPrefilledFromNavigation.current = true;
    prefillCustomer(state.customer);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, customers, navigate]);

  const handleNext = () => {
    if (step === 0 && customerMode === 'existing' && !selectedCustomerId) {
      toast.error('Please select a customer');
      return;
    }
    if (step === 0 && customerMode === 'new') {
      setStep(1);
      return;
    }
    if (step === 1 && (!formData.name || !formData.phone || !formData.email)) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (step === 2 && (!formData.address || !formData.postcode)) {
      toast.error('Please enter the property address');
      return;
    }
    if (step === 3 && (!formData.preferredDate || !formData.preferredTime)) {
      toast.error('Please select a date and time');
      return;
    }
    setStep(step + 1);
  };

  const handleSubmit = async () => {
    if (!context) return;

    const appointmentNotes = `Site Visit: ${formData.preferredDate} at ${formData.preferredTime}\n${formData.notes}`;

    const existingCustomer = customers.find(c =>
      (selectedCustomerId && c.id === selectedCustomerId) ||
      c.email.toLowerCase() === formData.email.toLowerCase() ||
      c.phone === formData.phone
    );

    let customerId = existingCustomer?.id ?? '';
    let customer = existingCustomer;

    if (existingCustomer) {
      if (!selectedCustomerId) {
        toast.info(`Found existing customer: ${existingCustomer.name}`);
      }
    } else {
      const newCustomer = context.addCustomer({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: `${formData.address}, ${formData.postcode}`,
        status: 'lead',
        notes: appointmentNotes,
        photos: [],
        whatsappOptIn: formData.sendSMS,
        preferredChannel: formData.sendEmail && formData.sendSMS ? 'both' : formData.sendSMS ? 'whatsapp' : 'email',
      });
      customerId = newCustomer.id;
      customer = newCustomer;
      toast.success('New lead created!');
    }

    if (!customerId || !customer) {
      toast.error('Could not save customer details');
      return;
    }

    const appointmentDateFormatted = new Date(formData.preferredDate).toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const channels: Array<'email' | 'whatsapp'> = [];
    if (formData.sendEmail) channels.push('email');
    if (formData.sendSMS) channels.push('whatsapp');

    if (channels.length > 0) {
      const body = renderTemplate(
        `Dear {CUSTOMER_NAME},\n\nYour site visit is confirmed for {BOOKING_DATE} at {BOOKING_TIME}.\n\nWe look forward to seeing you!\n\n{COMPANY_NAME}`,
        {
          CUSTOMER_NAME: customer.name,
          BOOKING_DATE: appointmentDateFormatted,
          BOOKING_TIME: formData.preferredTime,
        }
      );
      await messagingHub.send({
        channels,
        to: {
          email: customer.email,
          phone: customer.phone,
          customerId: customer.id,
          customerName: customer.name,
        },
        subject: renderTemplate('Booking Confirmed - {COMPANY_NAME}', { CUSTOMER_NAME: customer.name }),
        body,
        eventType: 'booking_confirmed',
        templateId: 'booking_confirmed',
      }, customer);
    }

    toast.success('Appointment booked successfully!');

    setTimeout(() => {
      navigate('/site-survey');
    }, 1500);
  };

  if (!context) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Book Site Visit</h1>
        <p className="text-gray-600 mt-1">Schedule a consultation with the customer</p>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[0, 1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {s + 1}
              </div>
              {s < 4 && (
                <div className={`flex-1 h-1 mx-2 ${
                  step > s ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-gray-600">Customer</span>
          <span className="text-xs text-gray-600">Details</span>
          <span className="text-xs text-gray-600">Address</span>
          <span className="text-xs text-gray-600">Schedule</span>
          <span className="text-xs text-gray-600">Confirm</span>
        </div>
      </div>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Select or Create Customer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-4">
              <button
                onClick={() => setCustomerMode('existing')}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  customerMode === 'existing'
                    ? 'border-blue-600 bg-blue-50 shadow-lg'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Users className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                <p className="font-semibold">Existing Customer</p>
                <p className="text-sm text-gray-600 mt-1">Select from CRM</p>
              </button>
              <button
                onClick={() => setCustomerMode('new')}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  customerMode === 'new'
                    ? 'border-blue-600 bg-blue-50 shadow-lg'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <UserPlus className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <p className="font-semibold">New Lead</p>
                <p className="text-sm text-gray-600 mt-1">Create new customer</p>
              </button>
            </div>

            {customerMode === 'existing' && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    placeholder="Search customers by name, email, or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 text-lg p-6"
                  />
                </div>

                <div className="max-h-96 overflow-y-auto space-y-2">
                  {customers
                    .filter(c =>
                      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      c.phone.includes(searchTerm)
                    )
                    .slice(0, 10)
                    .map(customer => (
                      <button
                        key={customer.id}
                        onClick={() => handleSelectCustomer(customer)}
                        className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                          selectedCustomerId === customer.id
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-semibold">{customer.name}</p>
                            <p className="text-sm text-gray-600">{customer.email}</p>
                            <p className="text-sm text-gray-600">{customer.phone}</p>
                          </div>
                          <div className="ml-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              customer.status === 'lead' ? 'bg-blue-100 text-blue-800' :
                              customer.status === 'quoted' ? 'bg-yellow-100 text-yellow-800' :
                              customer.status === 'won' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {customer.status}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  {customers.filter(c =>
                    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    c.phone.includes(searchTerm)
                  ).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No customers found</p>
                      <Button
                        onClick={() => setCustomerMode('new')}
                        variant="link"
                        className="mt-2"
                      >
                        Create new customer instead
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {customerMode === 'new' && (
              <div className="p-6 bg-green-50 rounded-lg border-2 border-green-200">
                <div className="flex items-center gap-3 mb-3">
                  <UserPlus className="w-6 h-6 text-green-600" />
                  <p className="font-semibold text-green-900">Creating New Lead</p>
                </div>
                <p className="text-sm text-green-800">
                  You'll enter their details in the next step. They will be automatically added to your CRM as a lead.
                </p>
              </div>
            )}

            <Button
              onClick={handleNext}
              size="lg"
              className="w-full text-lg py-6"
              disabled={customerMode === 'existing' && !selectedCustomerId}
            >
              {customerMode === 'existing' ? 'Continue with Selected Customer' : 'Continue to Enter Details'}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Customer Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedCustomerId && (
              <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-blue-600" />
                  <p className="font-semibold text-blue-900">Existing Customer Selected</p>
                </div>
                <p className="text-sm text-blue-800 mt-1">
                  Details pre-filled from CRM. You can edit the address if needed.
                </p>
              </div>
            )}
            {!selectedCustomerId && (
              <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200">
                <div className="flex items-center gap-3">
                  <UserPlus className="w-5 h-5 text-green-600" />
                  <p className="font-semibold text-green-900">Creating New Lead</p>
                </div>
                <p className="text-sm text-green-800 mt-1">
                  This customer will be added to your CRM as a lead when you complete the booking.
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Smith"
                className="text-lg p-6"
                disabled={!!selectedCustomerId}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="07XXX XXXXXX"
                  className="text-lg p-6"
                  disabled={!!selectedCustomerId}
                />
              </div>
              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                  className="text-lg p-6"
                  disabled={!!selectedCustomerId}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={() => setStep(0)} variant="outline" size="lg" className="flex-1 text-lg py-6">
                Back
              </Button>
              <Button onClick={handleNext} size="lg" className="flex-1 text-lg py-6">
                Next: Property Address
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Property Address
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="address">Full Address *</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 High Street, London"
                rows={3}
                className="text-lg p-4"
              />
            </div>

            <div>
              <Label htmlFor="postcode">Postcode *</Label>
              <Input
                id="postcode"
                value={formData.postcode}
                onChange={e => setFormData({ ...formData, postcode: e.target.value })}
                placeholder="SW1A 1AA"
                className="text-lg p-6"
              />
            </div>

            <div className="flex gap-3">
              <Button onClick={() => setStep(1)} variant="outline" size="lg" className="flex-1 text-lg py-6">
                Back
              </Button>
              <Button onClick={handleNext} size="lg" className="flex-1 text-lg py-6">
                Next: Schedule Visit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Schedule Appointment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="date">Preferred Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.preferredDate}
                onChange={e => setFormData({ ...formData, preferredDate: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                className="text-lg p-6"
              />
            </div>

            <div>
              <Label htmlFor="time">Preferred Time Slot *</Label>
              <Select value={formData.preferredTime} onValueChange={(value) => setFormData({ ...formData, preferredTime: value })}>
                <SelectTrigger className="text-lg p-6">
                  <SelectValue placeholder="Select a time slot" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map(slot => (
                    <SelectItem key={slot} value={slot} className="text-lg py-3">
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any special requirements or access instructions..."
                rows={3}
                className="text-lg p-4"
              />
            </div>

            <div className="flex gap-3">
              <Button onClick={() => setStep(2)} variant="outline" size="lg" className="flex-1 text-lg py-6">
                Back
              </Button>
              <Button onClick={handleNext} size="lg" className="flex-1 text-lg py-6">
                Next: Confirm
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Confirm Appointment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-gray-50 p-6 rounded-lg space-y-4">
              <div>
                <p className="text-sm text-gray-600">Customer</p>
                <p className="font-medium text-lg">{formData.name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-medium">{formData.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium">{formData.email}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600">Property Address</p>
                <p className="font-medium">{formData.address}</p>
                <p className="font-medium">{formData.postcode}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Date</p>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {new Date(formData.preferredDate).toLocaleDateString('en-GB', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Time</p>
                  <p className="font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {formData.preferredTime}
                  </p>
                </div>
              </div>

              {formData.notes && (
                <div>
                  <p className="text-sm text-gray-600">Notes</p>
                  <p className="font-medium">{formData.notes}</p>
                </div>
              )}
            </div>

            <div className="bg-blue-50 p-6 rounded-lg space-y-4">
              <h4 className="font-medium">Send Reminders</h4>

              <label className="flex items-center gap-3 cursor-pointer p-3 bg-white rounded-lg border-2 border-blue-200">
                <input
                  type="checkbox"
                  checked={formData.sendEmail}
                  onChange={e => setFormData({ ...formData, sendEmail: e.target.checked })}
                  className="w-5 h-5"
                />
                <Mail className="w-5 h-5 text-blue-600" />
                <div className="flex-1">
                  <p className="font-medium">Email Confirmation</p>
                  <p className="text-sm text-gray-600">Send appointment details to {formData.email}</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 bg-white rounded-lg border-2 border-blue-200">
                <input
                  type="checkbox"
                  checked={formData.sendSMS}
                  onChange={e => setFormData({ ...formData, sendSMS: e.target.checked })}
                  className="w-5 h-5"
                />
                <MessageSquare className="w-5 h-5 text-blue-600" />
                <div className="flex-1">
                  <p className="font-medium">SMS Reminder</p>
                  <p className="text-sm text-gray-600">Send text reminder to {formData.phone}</p>
                </div>
              </label>
            </div>

            <div className="flex gap-3">
              <Button onClick={() => setStep(3)} variant="outline" size="lg" className="flex-1 text-lg py-6">
                Back
              </Button>
              <Button onClick={handleSubmit} size="lg" className="flex-1 text-lg py-6 bg-green-600 hover:bg-green-700">
                Confirm & Book
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
