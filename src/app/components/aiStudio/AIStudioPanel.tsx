import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router';
import {
  loadAIStudioConfig,
  patchPanelPrefs,
  saveAIStudioConfig,
  validateCommandRoles,
} from '../../engine/ai/aiStudioStore';
import { buildBritishVoicePrompt } from '../../engine/ai/britishVoice';
import type {
  AIStudioCommand,
  AIStudioConfig,
  CommandCategory,
  HumourLevel,
  AutonomyLevel,
} from '../../config/ai/types';
import type { AgentRole } from '../../engine/ai/agentContext';
import { BCDocLibrary } from '../buildingControl/BCDocLibrary';

const CATEGORIES: CommandCategory[] = [
  'customer_self_service',
  'sales_quoting',
  'project_pm',
  'financial',
  'foreman',
  'admin',
];

const ROLES: AgentRole[] = ['customer', 'staff', 'manager', 'super_admin', 'builder'];

const SAVE_DEBOUNCE_MS = 600;

export function AIStudioPanel() {
  const [config, setConfig] = useState<AIStudioConfig>(() => loadAIStudioConfig());
  const [voicePreview, setVoicePreview] = useState('');
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [testCommandId, setTestCommandId] = useState<string | null>(null);
  const [commandTestResults, setCommandTestResults] = useState<Record<string, string>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<AIStudioConfig | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const flushSave = (next: AIStudioConfig) => {
    saveAIStudioConfig(next);
    toast.success('AI Studio saved');
    pendingSaveRef.current = null;
  };

  const scheduleSave = (next: AIStudioConfig) => {
    pendingSaveRef.current = next;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (pendingSaveRef.current) flushSave(pendingSaveRef.current);
    }, SAVE_DEBOUNCE_MS);
  };

  const persist = (next: AIStudioConfig, immediate = false) => {
    setConfig(next);
    if (immediate) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      flushSave(next);
      return;
    }
    scheduleSave(next);
  };

  const update = (patch: Partial<AIStudioConfig>, immediate = false) => {
    let next!: AIStudioConfig;
    setConfig((prev) => {
      next = { ...prev, ...patch };
      return next;
    });
    persist(next, immediate);
    if ('defaultPanelOpen' in patch || 'panelDocked' in patch) {
      patchPanelPrefs({
        defaultPanelOpen: next.defaultPanelOpen,
        panelDocked: next.panelDocked,
      });
    }
  };

  const runVoicePreview = async () => {
    setVoiceLoading(true);
    setVoicePreview('');
    try {
      const res = await fetch('/api/ai/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Give me a one-sentence hello in your usual voice.' }],
          orchestratorMode: 'staff',
          channel: 'overlay_chat',
          staffContext: { role: 'staff' },
          systemPrompt: buildBritishVoicePrompt(config.humourLevel, 'staff', config.companyInstructions, 'overlay_chat'),
        }),
      });
      const data = await res.json();
      setVoicePreview(data.content ?? 'No reply — check OpenAI key or use mock mode.');
    } catch {
      setVoicePreview('Bit of a mess on my end — server unavailable for preview.');
    } finally {
      setVoiceLoading(false);
    }
  };

  const testCommand = async (cmd: AIStudioCommand) => {
    setTestCommandId(cmd.id);
    try {
      const res = await fetch('/api/ai/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: cmd.prompt || cmd.label }],
          orchestratorMode: 'staff',
          staffContext: { role: cmd.roles[0] ?? 'staff' },
          systemPrompt: buildBritishVoicePrompt(config.humourLevel, cmd.roles[0] ?? 'staff', config.companyInstructions),
        }),
      });
      const data = await res.json();
      setCommandTestResults((prev) => ({ ...prev, [cmd.id]: data.content ?? 'No reply.' }));
    } catch {
      setCommandTestResults((prev) => ({ ...prev, [cmd.id]: 'Preview failed — server unavailable.' }));
    } finally {
      setTestCommandId(null);
    }
  };

  const addCommand = () => {
    const cmd: AIStudioCommand = {
      id: `cmd-${Date.now()}`,
      label: 'New command',
      prompt: '',
      roles: ['staff'],
      category: 'sales_quoting',
      enabled: true,
    };
    update({ commands: [...config.commands, cmd] });
  };

  const updateCommand = (id: string, patch: Partial<AIStudioCommand>) => {
    const commands = config.commands.map((c) => (c.id === id ? { ...c, ...patch } : c));
    const updated = commands.find((c) => c.id === id);
    if (updated) {
      const err = validateCommandRoles(updated.category, updated.roles);
      if (err) {
        toast.error(err);
        return;
      }
    }
    update({ commands });
  };

  const removeCommand = (id: string) => {
    update({ commands: config.commands.filter((c) => c.id !== id) });
  };

  const addKnowledge = () => {
    update({
      knowledgeChunks: [
        ...config.knowledgeChunks,
        { id: `kb-${Date.now()}`, title: 'New doc', tags: [], body: '' },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Company voice & instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Humour level</Label>
            <Select value={config.humourLevel} onValueChange={(v: HumourLevel) => update({ humourLevel: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="straight">Straight — no jokes</SelectItem>
                <SelectItem value="dry">Dry (default)</SelectItem>
                <SelectItem value="cheeky">Cheeky — staff only</SelectItem>
                <SelectItem value="del_boy">Del Boy — chat banter (staff)</SelectItem>
              </SelectContent>
            </Select>
            {config.humourLevel === 'del_boy' && (
              <p className="text-xs text-slate-500 mt-1">
                Applies to AI overlay chat replies only. Quotes, emails, and contracts stay professional.
              </p>
            )}
          </div>
          <div>
            <Label>Company instructions</Label>
            <Textarea
              value={config.companyInstructions}
              onChange={(e) => update({ companyInstructions: e.target.value })}
              rows={5}
              placeholder="Pricing rules, tone, what AI must never say..."
            />
          </div>
          <div className="space-y-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void runVoicePreview()} disabled={voiceLoading}>
              {voiceLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Test voice preview
            </Button>
            {voicePreview && (
              <p className="text-sm text-slate-600 bg-slate-50 border rounded-lg p-3 whitespace-pre-wrap">{voicePreview}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick commands (by role)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.commands.map((cmd) => (
            <div key={cmd.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <Input
                  value={cmd.label}
                  onChange={(e) => updateCommand(cmd.id, { label: e.target.value })}
                  placeholder="Chip label"
                  className="flex-1"
                />
                <Select
                  value={cmd.category}
                  onValueChange={(v: CommandCategory) => updateCommand(cmd.id, { category: v })}
                >
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeCommand(cmd.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <Textarea
                value={cmd.prompt}
                onChange={(e) => updateCommand(cmd.id, { prompt: e.target.value })}
                rows={2}
                placeholder="Prompt sent when chip is tapped"
              />
              <div className="flex flex-wrap gap-2">
                {ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={cmd.roles.includes(role)}
                      onChange={(e) => {
                        const roles = e.target.checked
                          ? [...cmd.roles, role]
                          : cmd.roles.filter((r) => r !== role);
                        updateCommand(cmd.id, { roles });
                      }}
                    />
                    {role}
                  </label>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={testCommandId === cmd.id}
                onClick={() => void testCommand(cmd)}
              >
                {testCommandId === cmd.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                Test command
              </Button>
              {commandTestResults[cmd.id] && (
                <p className="text-xs text-slate-500 border-t pt-2">{commandTestResults[cmd.id]}</p>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addCommand}>
            <Plus className="w-4 h-4 mr-1" /> Add command
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Knowledge library</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {config.knowledgeChunks.map((chunk, i) => (
            <div key={chunk.id} className="border rounded-lg p-3 space-y-2">
              <Input
                value={chunk.title}
                onChange={(e) => {
                  const knowledgeChunks = [...config.knowledgeChunks];
                  knowledgeChunks[i] = { ...chunk, title: e.target.value };
                  update({ knowledgeChunks });
                }}
              />
              <Input
                value={chunk.tags.join(', ')}
                onChange={(e) => {
                  const knowledgeChunks = [...config.knowledgeChunks];
                  knowledgeChunks[i] = {
                    ...chunk,
                    tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                  };
                  update({ knowledgeChunks });
                }}
                placeholder="Tags, comma-separated"
              />
              <Textarea
                value={chunk.body}
                onChange={(e) => {
                  const knowledgeChunks = [...config.knowledgeChunks];
                  knowledgeChunks[i] = { ...chunk, body: e.target.value };
                  update({ knowledgeChunks });
                }}
                rows={3}
              />
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addKnowledge}>
            <Plus className="w-4 h-4 mr-1" /> Add knowledge chunk
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Building control docs</CardTitle></CardHeader>
        <CardContent>
          <BCDocLibrary />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>AI autonomy & estimates</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Autonomy level</Label>
            <Select value={config.autonomyLevel} onValueChange={(v: AutonomyLevel) => update({ autonomyLevel: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="assist">Assist — confirm most actions</SelectItem>
                <SelectItem value="balanced">Balanced (default)</SelectItem>
                <SelectItem value="autopilot">Autopilot — minimal prompts</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3 border rounded-lg p-3">
            <p className="text-xs font-medium text-slate-600">Per-action overrides</p>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Auto-run quote drafts</Label>
              <Switch checked={config.autoRunQuoteDrafts} onCheckedChange={(v) => update({ autoRunQuoteDrafts: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Auto-run navigation</Label>
              <Switch checked={config.autoRunNavigation} onCheckedChange={(v) => update({ autoRunNavigation: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Require confirm for customer messages</Label>
              <Switch
                checked={config.requireConfirmCustomerMessages}
                onCheckedChange={(v) => update({ requireConfirmCustomerMessages: v })}
              />
            </div>
          </div>
          <div>
            <Label>Estimate buffer %</Label>
            <Input
              type="number"
              value={config.estimateBufferPercent}
              onChange={(e) => update({ estimateBufferPercent: Number(e.target.value) || 12 })}
            />
          </div>
          <div>
            <Label>Disclaimer template</Label>
            <Textarea
              value={config.disclaimerTemplate}
              onChange={(e) => update({ disclaimerTemplate: e.target.value })}
              rows={3}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Default panel open</Label>
            <Switch checked={config.defaultPanelOpen} onCheckedChange={(v) => update({ defaultPanelOpen: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Dock panel to sidebar (desktop)</Label>
            <Switch checked={config.panelDocked} onCheckedChange={(v) => update({ panelDocked: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Starter question chips</Label>
            <Switch
              checked={config.starterQuestionsEnabled}
              onCheckedChange={(v) => update({ starterQuestionsEnabled: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Conversation audit</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Log conversations server-side</Label>
            <Switch
              checked={config.conversationLoggingEnabled}
              onCheckedChange={(v) => update({ conversationLoggingEnabled: v })}
            />
          </div>
          <div>
            <Label>Retention period (days)</Label>
            <Input
              type="number"
              value={config.conversationRetentionDays}
              onChange={(e) => update({ conversationRetentionDays: Number(e.target.value) || 365 })}
            />
          </div>
          <div>
            <Label>Roles allowed to view audit</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {ROLES.filter((r) => r !== 'customer' && r !== 'builder').map((role) => (
                <label key={role} className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={config.auditRoles.includes(role)}
                    onChange={(e) => {
                      const auditRoles = e.target.checked
                        ? [...config.auditRoles, role]
                        : config.auditRoles.filter((r) => r !== role);
                      update({ auditRoles });
                    }}
                  />
                  {role}
                </label>
              ))}
            </div>
          </div>
          <Link to="/ai-audit" className="text-sm text-amber-700 hover:underline">
            Open Conversation Audit
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
