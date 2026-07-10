import { FormEvent, useContext, useMemo, useState } from 'react';
import { AppContext } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { CheckCircle2, Clock, Plus, ShieldCheck, User, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { loadProjects, updateProject, syncToServer } from '../engine/project/projectStore';
import type { ChangeOrder, UnifiedProject } from '../engine/project/types';
import { approveChangeOrderForCustomer } from '../engine/projectAi/projectAiService';
import { notifyCustomerChangeOrder } from '../engine/ai/foremanExecutor';

interface ChangeOrderRow {
  projectId: string;
  projectName: string;
  customerName: string;
  order: ChangeOrder;
}

function formatAmount(order: ChangeOrder): string {
  if (typeof order.amountMin === 'number' && typeof order.amountMax === 'number') {
    return `£${order.amountMin.toLocaleString('en-GB')} - £${order.amountMax.toLocaleString('en-GB')}`;
  }
  return `£${order.amount.toLocaleString('en-GB')}`;
}

export default function ChangeOrders() {
  const context = useContext(AppContext);
  if (!context) return null;

  const { user } = context;
  const [projects, setProjects] = useState<UnifiedProject[]>(() => loadProjects());
  const [showForm, setShowForm] = useState(false);
  const [newOrder, setNewOrder] = useState({
    projectId: '',
    title: '',
    description: '',
    reason: '',
    amount: '',
    estimatedDays: '',
  });

  const refreshProjects = () => setProjects(loadProjects());

  const editableProjects = useMemo(() => (
    user.role === 'customer'
      ? projects.filter((project) => project.customerName === user.name)
      : projects
  ), [projects, user.name, user.role]);

  const rows = useMemo<ChangeOrderRow[]>(() => {
    return editableProjects.flatMap((project) => (
      (project.changeOrders ?? []).map((order) => ({
        projectId: project.id,
        projectName: project.projectName,
        customerName: project.customerName,
        order,
      }))
    ));
  }, [editableProjects]);

  const visibleRows = useMemo(() => (
    rows
      .filter((row) => (
        user.role !== 'customer'
          ? true
          : row.customerName === user.name && row.order.status !== 'proposed'
      ))
      .sort((a, b) => new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime())
  ), [rows, user.name, user.role]);

  const proposedCount = visibleRows.filter((row) => row.order.status === 'proposed').length;
  const pendingCustomerCount = visibleRows.filter((row) => row.order.status === 'pending_customer').length;
  const approvedCount = visibleRows.filter((row) => row.order.status === 'approved').length;
  const rejectedCount = visibleRows.filter((row) => row.order.status === 'rejected').length;

  const staffProjects = editableProjects.filter((project) => user.role !== 'customer');
  const selectedProjectId = newOrder.projectId || staffProjects[0]?.id || '';
  const selectedProject = staffProjects.find((project) => project.id === selectedProjectId);

  const handleCreate = (event: FormEvent) => {
    event.preventDefault();
    if (user.role === 'customer') return;
    if (!selectedProjectId) {
      toast.error('Select a project first.');
      return;
    }

    const project = projects.find((item) => item.id === selectedProjectId);
    if (!project) {
      toast.error('Project not found.');
      return;
    }

    const amount = Number(newOrder.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid change-order amount.');
      return;
    }

    const nextOrder: ChangeOrder = {
      id: `CO${Date.now()}`,
      title: newOrder.title.trim(),
      amount,
      status: 'proposed',
      createdAt: new Date().toISOString(),
      description: newOrder.description.trim() || undefined,
      reason: newOrder.reason.trim() || undefined,
      estimatedDays: newOrder.estimatedDays ? Number(newOrder.estimatedDays) : undefined,
    };

    const updated = updateProject(project.id, {
      changeOrders: [...(project.changeOrders ?? []), nextOrder],
    });
    if (!updated) {
      toast.error('Could not create change order.');
      return;
    }

    toast.success(`Change order drafted for ${project.customerName}. Staff approval needed before the customer is asked.`);
    setShowForm(false);
    setNewOrder({
      projectId: '',
      title: '',
      description: '',
      reason: '',
      amount: '',
      estimatedDays: '',
    });
    refreshProjects();
    void syncToServer();
  };

  const handleStaffApprove = async (projectId: string, changeOrderId: string) => {
    const updated = approveChangeOrderForCustomer(projectId, changeOrderId, user.name);
    if (!updated) {
      toast.error('Change order could not be approved.');
      return;
    }

    refreshProjects();
    const sent = await notifyCustomerChangeOrder(projectId, changeOrderId);
    refreshProjects();
    void syncToServer();
    if (sent) {
      toast.success('Sent to the customer to approve before work starts.');
    } else {
      toast.success('Approved, but no customer email/phone was on file to notify.');
    }
  };

  const handleStaffReject = (projectId: string, changeOrderId: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project?.changeOrders) return;
    const updated = updateProject(projectId, {
      changeOrders: project.changeOrders.map((order) => (
        order.id === changeOrderId
          ? { ...order, status: 'rejected' as const }
          : order
      )),
    });
    if (!updated) {
      toast.error('Could not reject change order.');
      return;
    }
    toast.success('Change order rejected.');
    refreshProjects();
    void syncToServer();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="rounded-2xl bg-slate-900 p-6 text-white flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Change Orders</h1>
            <p className="text-slate-200 text-sm mt-1">
              Staff financial gate controls when customers can see and approve variation costs.
            </p>
          </div>
          {user.role !== 'customer' && (
            <Button onClick={() => setShowForm((prev) => !prev)}>
              <Plus className="w-4 h-4 mr-1" />
              New Draft
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-slate-500">Drafted</p>
              <p className="text-2xl font-bold">{proposedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-slate-500">Waiting Customer</p>
              <p className="text-2xl font-bold">{pendingCustomerCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-slate-500">Approved</p>
              <p className="text-2xl font-bold">{approvedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-slate-500">Rejected</p>
              <p className="text-2xl font-bold">{rejectedCount}</p>
            </CardContent>
          </Card>
        </div>

        {showForm && user.role !== 'customer' && staffProjects.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-slate-500">
              No projects available. A change order must belong to a project with a customer.
              Create or convert a quote into a project first.
            </CardContent>
          </Card>
        )}

        {showForm && user.role !== 'customer' && staffProjects.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Create Draft Change Order</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <Label>Project</Label>
                  <Select
                    value={selectedProjectId}
                    onValueChange={(value) => setNewOrder((prev) => ({ ...prev, projectId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffProjects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.projectName} — {project.customerName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedProject && (
                    <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <User className="w-3.5 h-3.5" />
                        {selectedProject.customerName}
                      </span>
                      {selectedProject.customerEmail && <span>{selectedProject.customerEmail}</span>}
                      {selectedProject.address && <span>{selectedProject.address}</span>}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    The change order is attached to this project. After staff approval it is sent to
                    the customer to approve before any work starts.
                  </p>
                </div>
                <div>
                  <Label>Title</Label>
                  <Input
                    value={newOrder.title}
                    onChange={(event) => setNewOrder((prev) => ({ ...prev, title: event.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={newOrder.description}
                    onChange={(event) => setNewOrder((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>Reason</Label>
                    <Input
                      value={newOrder.reason}
                      onChange={(event) => setNewOrder((prev) => ({ ...prev, reason: event.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Amount (£)</Label>
                    <Input
                      type="number"
                      value={newOrder.amount}
                      onChange={(event) => setNewOrder((prev) => ({ ...prev, amount: event.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label>Estimated Days</Label>
                    <Input
                      type="number"
                      value={newOrder.estimatedDays}
                      onChange={(event) => setNewOrder((prev) => ({ ...prev, estimatedDays: event.target.value }))}
                    />
                  </div>
                </div>
                <Button type="submit">Save Draft</Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {visibleRows.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-slate-500">
                No change orders yet.
              </CardContent>
            </Card>
          )}
          {visibleRows.map(({ projectId, projectName, customerName, order }) => (
            <Card key={`${projectId}:${order.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{order.title}</CardTitle>
                    <p className="text-sm text-slate-500">{projectName} - {customerName}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {order.status.replace('_', ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {order.description && <p className="text-sm text-slate-700">{order.description}</p>}
                {order.reason && <p className="text-sm text-slate-600">Reason: {order.reason}</p>}
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="font-medium">Amount: {formatAmount(order)}</span>
                  {typeof order.estimatedDays === 'number' && (
                    <span>Estimated days: {order.estimatedDays}</span>
                  )}
                  <span>Created: {new Date(order.createdAt).toLocaleDateString('en-GB')}</span>
                </div>
                {order.status === 'proposed' && order.staffApprovedBy && (
                  <p className="text-xs text-slate-500">
                    Staff approved by {order.staffApprovedBy} on {order.staffApprovedAt ? new Date(order.staffApprovedAt).toLocaleString('en-GB') : 'n/a'}
                  </p>
                )}
                {user.role !== 'customer' && order.status === 'proposed' && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void handleStaffApprove(projectId, order.id)}>
                      <ShieldCheck className="w-4 h-4 mr-1" />
                      Staff Approve + Notify
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleStaffReject(projectId, order.id)}>
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                )}
                {order.status === 'pending_customer' && (
                  <p className="text-sm text-amber-700 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Customer decision pending.
                  </p>
                )}
                {order.status === 'approved' && (
                  <p className="text-sm text-green-700 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Customer approved.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
