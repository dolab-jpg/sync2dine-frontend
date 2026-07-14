import { useState, useContext, useEffect } from 'react';
import { useLocation } from 'react-router';
import { AppContext } from '../App';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import {
  Users, TrendingUp, DollarSign, Calendar, Hammer, BarChart3, PoundSterling,
  Award, Clock, CheckCircle2, AlertCircle, Edit2, FileText, Calculator
} from 'lucide-react';
import { toast } from 'sonner';
import { loadBuilders, saveBuilders, type BuilderRecord } from '../engine/builder/builderStore';

type Builder = BuilderRecord;

interface BuilderStats {
  builderId: string;
  builderName: string;
  projectsCompleted: number;
  projectsInProgress: number;
  projectsUpcoming: number;
  totalEarned: number;
  averageProjectValue: number;
  customerRating: number;
  onTimeCompletion: number; // percentage
}

interface BuilderPaymentRecord {
  id: string;
  builderId: string;
  builderName: string;
  projectId: string;
  projectName: string;
  paymentType: 'price_work' | 'day_rate';
  amount: number;
  status: 'pending' | 'approved' | 'paid';
  date: string;
  approvedBy?: string;
  paidDate?: string;
}

export default function BuilderManagement() {
  const context = useContext(AppContext);
  if (!context) return null;

  const { user } = context;

  const [builders, setBuilders] = useState<Builder[]>(() => loadBuilders());

  useEffect(() => {
    saveBuilders(builders);
  }, [builders]);

  const [builderStats] = useState<BuilderStats[]>([
    {
      builderId: 'B001',
      builderName: 'Mike Wilson',
      projectsCompleted: 12,
      projectsInProgress: 2,
      projectsUpcoming: 1,
      totalEarned: 42750,
      averageProjectValue: 3562,
      customerRating: 4.8,
      onTimeCompletion: 92
    },
    {
      builderId: 'B002',
      builderName: 'Tom Richards',
      projectsCompleted: 8,
      projectsInProgress: 1,
      projectsUpcoming: 2,
      totalEarned: 28400,
      averageProjectValue: 3550,
      customerRating: 4.6,
      onTimeCompletion: 88
    },
    {
      builderId: 'B003',
      builderName: 'Dave Collins',
      projectsCompleted: 15,
      projectsInProgress: 3,
      projectsUpcoming: 1,
      totalEarned: 51200,
      averageProjectValue: 3413,
      customerRating: 4.9,
      onTimeCompletion: 95
    }
  ]);

  const [paymentRecords, setPaymentRecords] = useState<BuilderPaymentRecord[]>([
    {
      id: 'PAY001',
      builderId: 'B001',
      builderName: 'Mike Wilson',
      projectId: 'P001',
      projectName: 'Emma Clarke - Birmingham',
      paymentType: 'price_work',
      amount: 1750,
      status: 'approved',
      date: '2026-04-28',
      approvedBy: 'Admin'
    },
    {
      id: 'PAY002',
      builderId: 'B003',
      builderName: 'Dave Collins',
      projectId: 'P003',
      projectName: 'Sarah Johnson - London',
      paymentType: 'day_rate',
      amount: 2000,
      status: 'paid',
      date: '2026-04-25',
      approvedBy: 'Admin',
      paidDate: '2026-04-26'
    },
    {
      id: 'PAY003',
      builderId: 'B002',
      builderName: 'Tom Richards',
      projectId: 'P005',
      projectName: 'Alex Brown - Manchester',
      paymentType: 'day_rate',
      amount: 1400,
      status: 'pending',
      date: '2026-04-27'
    }
  ]);

  const [selectedBuilder, setSelectedBuilder] = useState<Builder | null>(null);
  const [editingBuilder, setEditingBuilder] = useState<Builder | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    status: 'active' as Builder['status'],
    dayRate: '',
    specialties: '',
  });

  const location = useLocation();

  useEffect(() => {
    const builderName = (location.state as { builderName?: string } | null)?.builderName;
    if (!builderName) return;
    const match = builders.find((b) => b.name === builderName);
    if (match) setSelectedBuilder(match);
  }, [location.state, builders]);

  const openEditBuilder = (builder: Builder) => {
    setEditForm({
      name: builder.name,
      email: builder.email,
      phone: builder.phone,
      status: builder.status,
      dayRate: builder.dayRate?.toString() ?? '',
      specialties: builder.specialties.join(', '),
    });
    setEditingBuilder(builder);
  };

  const saveEditedBuilder = () => {
    if (!editingBuilder) return;
    const updated: Builder = {
      ...editingBuilder,
      name: editForm.name.trim() || editingBuilder.name,
      email: editForm.email.trim(),
      phone: editForm.phone.trim(),
      status: editForm.status,
      dayRate: editForm.dayRate ? Number(editForm.dayRate) : undefined,
      specialties: editForm.specialties.split(',').map((s) => s.trim()).filter(Boolean),
    };
    setBuilders(builders.map((b) => (b.id === updated.id ? updated : b)));
    setEditingBuilder(null);
    toast.success('Builder updated');
  };

  const approvePayment = (paymentId: string) => {
    setPaymentRecords(paymentRecords.map(payment =>
      payment.id === paymentId
        ? { ...payment, status: 'approved', approvedBy: user.name }
        : payment
    ));
    toast.success('Payment approved');
  };

  const markPaymentPaid = (paymentId: string) => {
    setPaymentRecords(paymentRecords.map(payment =>
      payment.id === paymentId
        ? { ...payment, status: 'paid', paidDate: new Date().toISOString().split('T')[0] }
        : payment
    ));
    toast.success('Payment marked as paid');
  };

  // Only super admin and managers can access
  if (user.role !== 'super_admin' && user.role !== 'platform_owner' && user.role !== 'manager') {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card>
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold">Access Restricted</h2>
            <p className="text-slate-600 mt-2">Only admins and managers can access builder management.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalStats = {
    activeBuilders: builders.filter(b => b.status === 'active').length,
    totalProjects: builderStats.reduce((sum, b) => sum + b.projectsCompleted + b.projectsInProgress + b.projectsUpcoming, 0),
    totalPaid: paymentRecords.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0),
    pendingPayments: paymentRecords.filter(p => p.status === 'pending').length
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Users className="w-8 h-8 text-amber-500" />
          Builder Management
        </h1>
        <p className="text-slate-600 mt-2">Manage builder payments, performance, and assignments</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Active Builders</p>
                <p className="text-3xl font-bold text-slate-900">{totalStats.activeBuilders}</p>
              </div>
              <Hammer className="w-10 h-10 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Projects</p>
                <p className="text-3xl font-bold text-blue-600">{totalStats.totalProjects}</p>
              </div>
              <BarChart3 className="w-10 h-10 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Paid</p>
                <p className="text-3xl font-bold text-green-600">£{totalStats.totalPaid.toLocaleString()}</p>
              </div>
              <PoundSterling className="w-10 h-10 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Pending Payments</p>
                <p className="text-3xl font-bold text-orange-600">{totalStats.pendingPayments}</p>
              </div>
              <Clock className="w-10 h-10 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="performance">
            <BarChart3 className="w-4 h-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="payments">
            <DollarSign className="w-4 h-4 mr-2" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="builders">
            <Users className="w-4 h-4 mr-2" />
            Builders
          </TabsTrigger>
        </TabsList>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {builderStats.map(stats => (
              <Card key={stats.builderId}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{stats.builderName}</span>
                    <div className="flex items-center gap-1">
                      <Award className="w-5 h-5 text-amber-500" />
                      <span className="text-lg">{stats.customerRating.toFixed(1)}</span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-green-600">{stats.projectsCompleted}</p>
                      <p className="text-xs text-slate-600">Completed</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{stats.projectsInProgress}</p>
                      <p className="text-xs text-slate-600">In Progress</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-orange-600">{stats.projectsUpcoming}</p>
                      <p className="text-xs text-slate-600">Upcoming</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Total Earned</span>
                      <span className="text-lg font-bold text-slate-900">£{stats.totalEarned.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Avg Project Value</span>
                      <span className="text-lg font-bold text-slate-900">£{stats.averageProjectValue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">On-Time Completion</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500"
                            style={{ width: `${stats.onTimeCompletion}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">{stats.onTimeCompletion}%</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setSelectedBuilder(builders.find(b => b.id === stats.builderId) || null)}
                  >
                    View Details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts */}
          <Card>
            <CardHeader>
              <CardTitle>Builder Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Total Earned (YTD)</h4>
                  {builderStats.map(stats => (
                    <div key={stats.builderId} className="flex items-center gap-3 mb-3">
                      <span className="text-sm w-32 text-slate-900 font-medium">{stats.builderName}</span>
                      <div className="flex-1 h-8 bg-slate-100 rounded-lg overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-amber-600"
                          style={{ width: `${(stats.totalEarned / 60000) * 100}%` }}
                        ></div>
                        <span className="absolute inset-0 flex items-center justify-end pr-3 text-sm font-bold text-slate-900">
                          £{stats.totalEarned.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Customer Ratings</h4>
                  {builderStats.map(stats => (
                    <div key={stats.builderId} className="flex items-center gap-3 mb-3">
                      <span className="text-sm w-32 text-slate-900 font-medium">{stats.builderName}</span>
                      <div className="flex-1 h-8 bg-slate-100 rounded-lg overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-green-400 to-green-600"
                          style={{ width: `${(stats.customerRating / 5) * 100}%` }}
                        ></div>
                        <span className="absolute inset-0 flex items-center justify-end pr-3 text-sm font-bold text-slate-900">
                          {stats.customerRating.toFixed(1)} / 5.0
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              Export Report
            </Button>
            <Button variant="outline">
              <Calculator className="w-4 h-4 mr-2" />
              Calculate Totals
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Payment Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {paymentRecords.map(payment => (
                  <div key={payment.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{payment.builderName}</p>
                          <p className="text-sm text-slate-600">{payment.projectName}</p>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {payment.paymentType.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(payment.date).toLocaleDateString('en-GB')}
                        </span>
                        {payment.approvedBy && (
                          <span>Approved by: {payment.approvedBy}</span>
                        )}
                        {payment.paidDate && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                            Paid: {new Date(payment.paidDate).toLocaleDateString('en-GB')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-slate-900">£{payment.amount.toLocaleString()}</p>
                        <Badge variant={
                          payment.status === 'paid' ? 'default' :
                          payment.status === 'approved' ? 'secondary' : 'outline'
                        }>
                          {payment.status}
                        </Badge>
                      </div>

                      <div className="flex gap-2">
                        {payment.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => approvePayment(payment.id)}
                          >
                            Approve
                          </Button>
                        )}
                        {payment.status === 'approved' && (
                          <Button
                            size="sm"
                            onClick={() => markPaymentPaid(payment.id)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Mark Paid
                          </Button>
                        )}
                        <Button size="sm" variant="outline">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Builders Tab */}
        <TabsContent value="builders" className="space-y-4">
          <Button>
            <Users className="w-4 h-4 mr-2" />
            Add New Builder
          </Button>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {builders.map(builder => (
              <Card key={builder.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{builder.name}</CardTitle>
                      <p className="text-sm text-slate-600">{builder.email}</p>
                    </div>
                    <Badge variant={builder.status === 'active' ? 'default' : 'secondary'}>
                      {builder.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs text-slate-600">Phone</Label>
                    <p className="text-sm font-medium">{builder.phone}</p>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-600">Specialties</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {builder.specialties.map((specialty, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {specialty}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <Label className="text-xs text-slate-600">Payment Type</Label>
                      <p className="font-medium capitalize">{builder.defaultPaymentType.replace('_', ' ')}</p>
                    </div>
                    {builder.dayRate && (
                      <div>
                        <Label className="text-xs text-slate-600">Day Rate</Label>
                        <p className="font-medium">£{builder.dayRate}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs text-slate-600">Joined</Label>
                    <p className="text-sm">{new Date(builder.joinedDate).toLocaleDateString('en-GB', {
                      month: 'long', year: 'numeric'
                    })}</p>
                  </div>

                  <Button variant="outline" size="sm" className="w-full" onClick={() => openEditBuilder(builder)}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit Builder
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingBuilder} onOpenChange={(open) => !open && setEditingBuilder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit builder</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div>
              <Label>Specialties (comma-separated)</Label>
              <Input value={editForm.specialties} onChange={(e) => setEditForm({ ...editForm, specialties: e.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v as Builder['status'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="on_leave">On leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Day rate (£)</Label>
              <Input type="number" value={editForm.dayRate} onChange={(e) => setEditForm({ ...editForm, dayRate: e.target.value })} />
            </div>
            <Button className="w-full" onClick={saveEditedBuilder}>Save changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedBuilder} onOpenChange={(open) => !open && setSelectedBuilder(null)}>
        <DialogContent>
          {selectedBuilder && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedBuilder.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <p>{selectedBuilder.email}</p>
                <p>{selectedBuilder.phone}</p>
                <p>Specialties: {selectedBuilder.specialties.join(', ')}</p>
                <p>Status: {selectedBuilder.status}</p>
                {selectedBuilder.dayRate && <p>Day rate: £{selectedBuilder.dayRate}</p>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
