import { useState } from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Users, Link2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import type { UnifiedProject, WhatsAppMode, CustomerContact } from '../../engine/project/types';
import { updateProject } from '../../engine/project/projectStore';
import { messagingHub } from '../../engine/messaging/messagingHub';
import { ProjectTimeline } from './ProjectTimeline';

interface Props {
  project: UnifiedProject;
  contacts: CustomerContact[];
  onUpdate: (project: UnifiedProject) => void;
}

export function ProjectCommsPanel({ project, contacts, onUpdate }: Props) {
  const [creating, setCreating] = useState(false);
  const portalUrl = `${window.location.origin}/portal/${project.portalToken}`;

  const setMode = (mode: WhatsAppMode) => {
    onUpdate(updateProject(project.id, { whatsappMode: mode })!);
  };

  const createGroup = async () => {
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/whatsapp-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: `${project.projectName} — Team`,
          description: `Project group for ${project.customerName}`,
        }),
      });
      const data = await res.json() as { group?: UnifiedProject['whatsappGroup']; mock?: boolean };
      if (data.group) {
        onUpdate(updateProject(project.id, {
          whatsappGroup: data.group,
          whatsappMode: 'group',
        })!);
        toast.success(data.mock ? 'Mock group created (configure Meta for live)' : 'WhatsApp group created');
      }
    } catch {
      toast.error('Failed to create group');
    }
    setCreating(false);
  };

  const sendInvites = async () => {
    const group = project.whatsappGroup;
    if (!group?.inviteLink) {
      toast.error('Create a group first');
      return;
    }
    const optedIn = contacts.filter(c => c.whatsappOptIn);
    for (const contact of optedIn) {
      await messagingHub.send({
        channels: ['whatsapp'],
        to: {
          phone: contact.phone,
          customerId: project.customerId,
          customerName: contact.name,
        },
        body: `Join our project group for ${project.projectName}: ${group.inviteLink}`,
        eventType: 'project_update',
        templateId: 'project_update',
      }, { whatsappOptIn: true, email: project.customerEmail, phone: contact.phone, preferredChannel: 'whatsapp' });
    }
    toast.success(`Invites sent to ${optedIn.length} contact(s)`);
  };

  const copyPortal = () => {
    navigator.clipboard.writeText(portalUrl);
    toast.success('Portal link copied');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Communication mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={project.whatsappMode} onValueChange={v => setMode(v as WhatsAppMode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">WhatsApp 1:1 + Portal (recommended)</SelectItem>
              <SelectItem value="group">WhatsApp group (max 8, invite-only)</SelectItem>
              <SelectItem value="portal_only">Portal only (no WhatsApp)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500">
            Portal gives unlimited conversation and files. WhatsApp group requires Meta Groups API (OBA/tier).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Customer portal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs break-all text-slate-600 mb-2">{portalUrl}</p>
          <Button size="sm" variant="outline" onClick={copyPortal}>
            <Copy className="w-3 h-3 mr-1" /> Copy link
          </Button>
        </CardContent>
      </Card>

      {project.whatsappMode === 'group' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" /> WhatsApp group
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {project.whatsappGroup ? (
              <>
                <Label className="text-xs">Status: {project.whatsappGroup.status}</Label>
                {project.whatsappGroup.inviteLink && (
                  <p className="text-xs break-all">{project.whatsappGroup.inviteLink}</p>
                )}
                <Button size="sm" onClick={sendInvites}>Send invites to opted-in contacts</Button>
              </>
            ) : (
              <Button size="sm" onClick={createGroup} disabled={creating}>
                Create project group
              </Button>
            )}
            <p className="text-xs text-slate-500">Contacts on this project:</p>
            {contacts.map(c => (
              <div key={c.id} className="text-xs flex justify-between">
                <span>{c.name} ({c.role})</span>
                <span>{c.phone}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {project.escalated && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          Customer escalation flagged — review WhatsApp thread and follow up personally.
        </div>
      )}

      <ProjectTimeline project={project} />
    </div>
  );
}
