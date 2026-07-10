import { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ScrollText, Plus, MapPin, Building2, AlertTriangle, CalendarClock } from 'lucide-react';
import { AppContext } from '../../App';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {
  createPlanningApplication,
  loadPlanningApplications,
  subscribePlanningApplications,
} from '../../engine/planning/planningStore';
import {
  PLANNING_APPLICATION_TYPES,
  PLANNING_STAGES,
  applicationTypeLabel,
  stageLabel,
  type PlanningApplication,
  type PlanningApplicationType,
  type PlanningStage,
} from '../../engine/planning/types';
import { toast } from 'sonner';

const STAGE_TONE: Record<PlanningStage, string> = {
  pricing: 'bg-slate-100 text-slate-700',
  drawings: 'bg-blue-100 text-blue-700',
  customer_approval: 'bg-amber-100 text-amber-800',
  submitted: 'bg-indigo-100 text-indigo-700',
  validation: 'bg-purple-100 text-purple-700',
  changes_requested: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-700',
  refused: 'bg-red-100 text-red-700',
  post_approval: 'bg-teal-100 text-teal-700',
  completed: 'bg-emerald-100 text-emerald-700',
};

export default function PlanningHub() {
  const context = useContext(AppContext);
  const navigate = useNavigate();
  const user = context?.user;
  const customers = context?.customers ?? [];

  const [applications, setApplications] = useState<PlanningApplication[]>(loadPlanningApplications);
  const [stageFilter, setStageFilter] = useState<PlanningStage | 'all'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const [customerId, setCustomerId] = useState<string>('none');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [address, setAddress] = useState('');
  const [title, setTitle] = useState('');
  const [applicationType, setApplicationType] = useState<PlanningApplicationType>('householder');
  const [description, setDescription] = useState('');

  useEffect(() => subscribePlanningApplications(setApplications), []);

  const filtered = useMemo(
    () => (stageFilter === 'all' ? applications : applications.filter((a) => a.stage === stageFilter)),
    [applications, stageFilter]
  );

  const stats = useMemo(() => {
    const active = applications.filter((a) => !['completed', 'refused'].includes(a.stage));
    const openChanges = applications.reduce(
      (sum, a) => sum + a.changeRequests.filter((c) => c.status === 'open').length,
      0
    );
    const awaitingDecision = applications.filter((a) => ['submitted', 'validation', 'changes_requested'].includes(a.stage));
    return { active: active.length, openChanges, awaitingDecision: awaitingDecision.length };
  }, [applications]);

  const onPickCustomer = (id: string) => {
    setCustomerId(id);
    const c = customers.find((cust) => cust.id === id);
    if (c) {
      setCustomerName(c.name);
      setCustomerEmail(c.email);
      setAddress(c.address);
    }
  };

  const resetForm = () => {
    setCustomerId('none');
    setCustomerName('');
    setCustomerEmail('');
    setAddress('');
    setTitle('');
    setApplicationType('householder');
    setDescription('');
  };

  const handleCreate = () => {
    if (!user) return;
    if (!customerName.trim()) {
      toast.error('Enter a customer name');
      return;
    }
    const app = createPlanningApplication({
      customerId: customerId !== 'none' ? customerId : undefined,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim() || undefined,
      address: address.trim(),
      title: title.trim() || undefined,
      applicationType,
      description: description.trim() || undefined,
      createdBy: user.name,
    });
    setDialogOpen(false);
    resetForm();
    toast.success('Planning application created');
    navigate(`/planning/${app.id}`);
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ScrollText className="w-7 h-7 text-indigo-600" />
            Planning &amp; Consents
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage planning permission end to end — pricing, drawings, submission, validation, and post-approval consents
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-1" /> New application
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New planning application</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {customers.length > 0 && (
                <div>
                  <Label>Link a customer (optional)</Label>
                  <Select value={customerId} onValueChange={onPickCustomer}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No linked customer</SelectItem>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="pl-name">Customer name</Label>
                  <Input id="pl-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="pl-email">Customer email</Label>
                  <Input id="pl-email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className="mt-1" />
                </div>
              </div>
              <div>
                <Label htmlFor="pl-address">Site address</Label>
                <Input id="pl-address" value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="pl-title">Application title</Label>
                <Input id="pl-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Single-storey rear extension" className="mt-1" />
              </div>
              <div>
                <Label>Application type</Label>
                <Select value={applicationType} onValueChange={(v) => setApplicationType(v as PlanningApplicationType)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANNING_APPLICATION_TYPES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="pl-desc">Notes (optional)</Label>
                <Textarea id="pl-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-slate-500">Active applications</p>
          <p className="text-2xl font-bold text-slate-900">{stats.active}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-slate-500">Awaiting council</p>
          <p className="text-2xl font-bold text-indigo-700">{stats.awaitingDecision}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-slate-500">Open change requests</p>
          <p className="text-2xl font-bold text-orange-700">{stats.openChanges}</p>
        </CardContent></Card>
      </div>

      <div className="flex gap-2 items-center">
        <span className="text-sm text-slate-600">Filter by stage:</span>
        <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as PlanningStage | 'all')}>
          <SelectTrigger className="w-48 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {PLANNING_STAGES.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <Card>
            <CardContent className="p-10 text-center text-slate-500">
              <ScrollText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm">No planning applications yet. Create one to get started.</p>
            </CardContent>
          </Card>
        )}
        {filtered.map((app) => {
          const openChanges = app.changeRequests.filter((c) => c.status === 'open').length;
          return (
            <Card
              key={app.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/planning/${app.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900 truncate">{app.title}</h3>
                      <Badge className={STAGE_TONE[app.stage]}>{stageLabel(app.stage)}</Badge>
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5">{app.customerName} · {applicationTypeLabel(app.applicationType)}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                      {app.address && (
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{app.address}</span>
                      )}
                      {app.council.reference && (
                        <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{app.council.reference}</span>
                      )}
                      {app.council.targetDecisionDate && (
                        <span className="flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" />Target {app.council.targetDecisionDate}</span>
                      )}
                      {openChanges > 0 && (
                        <span className="flex items-center gap-1 text-orange-600 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" />{openChanges} change{openChanges === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{new Date(app.updatedAt).toLocaleDateString('en-GB')}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
