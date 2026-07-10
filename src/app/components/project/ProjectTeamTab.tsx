import { useMemo, useState } from 'react';
import { Users, UserPlus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { getAllTrades } from '../../config/trades';
import { loadBuilders, upsertBuilder } from '../../engine/builder/builderStore';
import { updateProject } from '../../engine/project/projectStore';
import type { AssignedContractor, UnifiedProject } from '../../engine/project/types';

interface Props {
  project: UnifiedProject;
  onUpdate: (project: UnifiedProject) => void;
}

const MANUAL_OPTION = '__manual__';

function buildTradeLabel(contractor: AssignedContractor): string {
  return contractor.trade ?? contractor.tradeId ?? 'Unassigned trade';
}

export function ProjectTeamTab({ project, onUpdate }: Props) {
  const trades = useMemo(() => getAllTrades(), []);
  const builders = useMemo(() => loadBuilders(), [project.id, project.assignedBuilder]);
  const leadBuilder = useMemo(
    () => builders.find((builder) => builder.name === project.assignedBuilder),
    [builders, project.assignedBuilder]
  );
  const tradeLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const trade of trades) {
      map.set(trade.id, trade.name);
    }
    return map;
  }, [trades]);

  const [selectedBuilderId, setSelectedBuilderId] = useState<string>(MANUAL_OPTION);
  const [name, setName] = useState('');
  const [tradeId, setTradeId] = useState(project.tradeId ?? 'bathroom');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const contractors = project.assignedContractors ?? [];

  const handleSelectBuilder = (builderId: string) => {
    setSelectedBuilderId(builderId);
    if (builderId === MANUAL_OPTION) return;
    const selectedBuilder = builders.find((builder) => builder.id === builderId);
    if (!selectedBuilder) return;
    setName(selectedBuilder.name);
    setPhone(selectedBuilder.phone ?? '');
    setEmail(selectedBuilder.email ?? '');
  };

  const resetForm = () => {
    setSelectedBuilderId(MANUAL_OPTION);
    setName('');
    setPhone('');
    setEmail('');
  };

  const addContractor = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Contractor name is required');
      return;
    }

    const selectedBuilder = selectedBuilderId === MANUAL_OPTION
      ? undefined
      : builders.find((builder) => builder.id === selectedBuilderId);
    const effectiveTradeId = tradeId.trim() || project.tradeId || 'bathroom';
    const tradeName = tradeLookup.get(effectiveTradeId) ?? effectiveTradeId;

    const duplicate = contractors.some((contractor) =>
      contractor.name.toLowerCase() === trimmedName.toLowerCase()
      || (selectedBuilder?.id && contractor.contractorId === selectedBuilder.id)
    );
    if (duplicate) {
      toast.error('This subcontractor is already assigned');
      return;
    }

    if (!selectedBuilder && trimmedName) {
      upsertBuilder({
        id: `SB${Date.now()}`,
        name: trimmedName,
        email: email.trim(),
        phone: phone.trim(),
        whatsappOptIn: true,
        specialties: [tradeName],
        status: 'active',
        joinedDate: new Date().toISOString().split('T')[0],
        defaultPaymentType: 'price_work',
      });
    }

    const nextContractor: AssignedContractor = {
      id: `AC${Date.now()}`,
      contractorId: selectedBuilder?.id,
      name: trimmedName,
      tradeId: effectiveTradeId,
      trade: tradeName,
      role: 'sub',
      phone: phone.trim() || selectedBuilder?.phone || undefined,
      email: email.trim() || selectedBuilder?.email || undefined,
    };

    const updated = updateProject(project.id, {
      assignedContractors: [...contractors, nextContractor],
    });
    if (!updated) {
      toast.error('Could not add subcontractor');
      return;
    }

    onUpdate(updated);
    resetForm();
    toast.success(`${trimmedName} added to project team`);
  };

  const removeContractor = (contractorId: string) => {
    const updated = updateProject(project.id, {
      assignedContractors: contractors.filter((contractor) => contractor.id !== contractorId),
    });
    if (!updated) {
      toast.error('Could not remove subcontractor');
      return;
    }
    onUpdate(updated);
    toast.success('Subcontractor removed');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4" />
            Project team
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded border p-3 bg-slate-50">
            <p className="font-medium text-slate-900">{project.assignedBuilder || 'Unassigned builder'}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">Lead</Badge>
              <span className="text-xs text-slate-600">{project.tradeName ?? 'General project lead'}</span>
            </div>
            {(leadBuilder?.phone || leadBuilder?.email) && (
              <p className="text-xs text-slate-500 mt-1">
                {leadBuilder.phone ?? 'No phone'} {leadBuilder.email ? `• ${leadBuilder.email}` : ''}
              </p>
            )}
          </div>

          {contractors.length === 0 ? (
            <p className="text-xs text-slate-500">No subcontractors assigned yet.</p>
          ) : (
            <div className="space-y-2">
              {contractors.map((contractor) => (
                <div key={contractor.id} className="rounded border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{contractor.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="capitalize">{contractor.role ?? 'sub'}</Badge>
                        <span className="text-xs text-slate-600">{buildTradeLabel(contractor)}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {contractor.phone ?? 'No phone'} {contractor.email ? `• ${contractor.email}` : ''}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeContractor(contractor.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Add subcontractor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>From builder list</Label>
            <Select value={selectedBuilderId} onValueChange={handleSelectBuilder}>
              <SelectTrigger>
                <SelectValue placeholder="Select existing builder/subcontractor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MANUAL_OPTION}>Manual entry</SelectItem>
                {builders.map((builder) => (
                  <SelectItem key={builder.id} value={builder.id}>
                    {builder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contractor name" />
            </div>
            <div className="space-y-2">
              <Label>Trade</Label>
              <Select value={tradeId} onValueChange={setTradeId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {trades.map((trade) => (
                    <SelectItem key={trade.id} value={trade.id}>
                      {trade.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="07..." />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" />
            </div>
          </div>

          <Button type="button" onClick={addContractor} className="w-full">
            Add to team
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
