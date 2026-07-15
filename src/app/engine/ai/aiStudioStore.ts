import {
  DEFAULT_AI_STUDIO,
  type AIStudioCommand,
  type AIStudioConfig,
  type CommandCategory,
} from '../../config/ai/types';
import type { AgentRole } from './agentContext';
import { getActiveOrgId } from '../platform/orgContext';
import { BDIDDIES_HOME_ORG_ID } from '../platform/homeOrg';

function storageKey(): string {
  const orgId = getActiveOrgId() || BDIDDIES_HOME_ORG_ID;
  return `aiStudio:${orgId}`;
}

export const AI_STUDIO_PANEL_PREFS_EVENT = 'ai-studio-panel-prefs';
export const AI_STUDIO_CONFIG_EVENT = 'ai-studio-config-changed';

export interface PanelPrefs {
  defaultPanelOpen: boolean;
  panelDocked: boolean;
}

export function getPanelPrefs(): PanelPrefs {
  const config = loadAIStudioConfig();
  return {
    defaultPanelOpen: config.defaultPanelOpen,
    panelDocked: config.panelDocked ?? true,
  };
}

export function patchPanelPrefs(prefs: Partial<PanelPrefs>): PanelPrefs {
  const config = loadAIStudioConfig();
  const next = {
    ...config,
    defaultPanelOpen: prefs.defaultPanelOpen ?? config.defaultPanelOpen,
    panelDocked: prefs.panelDocked ?? config.panelDocked ?? true,
  };
  saveAIStudioConfig(next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AI_STUDIO_PANEL_PREFS_EVENT, { detail: next }));
  }
  return { defaultPanelOpen: next.defaultPanelOpen, panelDocked: next.panelDocked };
}

function readAiSettingsPanelPrefs(): Partial<PanelPrefs> {
  try {
    const raw = localStorage.getItem('aiSettings');
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<PanelPrefs>;
    return {
      defaultPanelOpen: parsed.defaultPanelOpen,
      panelDocked: parsed.panelDocked,
    };
  } catch {
    return {};
  }
}

function defaultCommands(): AIStudioCommand[] {
  return [
    {
      id: 'staff-quote',
      label: 'Knock up a quote',
      prompt: 'I need a quote for a job — help me gather details and give a ballpark figure. Draft it in chat first; only make a PDF when I confirm.',
      roles: ['staff', 'manager', 'super_admin'],
      category: 'sales_quoting',
      enabled: true,
    },
    {
      id: 'staff-find-customer',
      label: 'Find a customer',
      prompt: 'Search for a customer by name or phone.',
      roles: ['staff', 'manager', 'super_admin'],
      category: 'sales_quoting',
      enabled: true,
    },
    {
      id: 'customer-status',
      label: "When's my job starting?",
      prompt: "What's the status of my project and when is work likely to start?",
      roles: ['customer'],
      category: 'customer_self_service',
      enabled: true,
    },
    {
      id: 'customer-quote',
      label: 'Can I see my quote?',
      prompt: 'Can I see my latest quote and what it includes?',
      roles: ['customer'],
      category: 'customer_self_service',
      enabled: true,
    },
    {
      id: 'customer-estimate',
      label: 'Rough price for my job',
      prompt: 'I need a rough price for some work — can you ask me a few questions?',
      roles: ['customer'],
      category: 'customer_self_service',
      enabled: true,
    },
    {
      id: 'builder-tasks',
      label: "What's on today?",
      prompt: 'What tasks and milestones are due on site today?',
      roles: ['builder'],
      category: 'foreman',
      enabled: true,
    },
  ];
}

export function loadAIStudioConfig(): AIStudioConfig {
  try {
    const key = storageKey();
    let raw = localStorage.getItem(key);
    if (!raw) {
      const legacy = localStorage.getItem('aiStudio');
      if (legacy) {
        raw = legacy;
        localStorage.setItem(key, legacy);
      }
    }
    const legacyPrefs = readAiSettingsPanelPrefs();
    if (!raw) {
      return {
        ...DEFAULT_AI_STUDIO,
        ...legacyPrefs,
        panelDocked: legacyPrefs.panelDocked ?? DEFAULT_AI_STUDIO.panelDocked,
        commands: defaultCommands(),
      };
    }
    const parsed = JSON.parse(raw) as Partial<AIStudioConfig>;
    const commands = parsed.commands?.length ? parsed.commands : defaultCommands();
    return {
      ...DEFAULT_AI_STUDIO,
      ...legacyPrefs,
      ...parsed,
      panelDocked: parsed.panelDocked ?? legacyPrefs.panelDocked ?? DEFAULT_AI_STUDIO.panelDocked,
      commands,
    };
  } catch {
    return { ...DEFAULT_AI_STUDIO, commands: defaultCommands() };
  }
}

export function saveAIStudioConfig(config: AIStudioConfig): void {
  localStorage.setItem(storageKey(), JSON.stringify(config));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AI_STUDIO_CONFIG_EVENT));
  }
  void syncAIStudioToServer(config);
}

export async function fetchAIStudioFromServer(): Promise<AIStudioConfig | null> {
  try {
    const res = await fetch('/api/ai/studio');
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.config) return null;
    return { ...DEFAULT_AI_STUDIO, ...data.config, commands: data.config.commands?.length ? data.config.commands : defaultCommands() };
  } catch {
    return null;
  }
}

async function syncAIStudioToServer(config: AIStudioConfig): Promise<void> {
  try {
    const mongo = readMongoSyncPayload();
    await fetch('/api/ai/studio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, mongodb: mongo }),
    });
  } catch {
    // Server may be offline in dev
  }
}

function readMongoSyncPayload(): { connectionString?: string; databaseName?: string } | undefined {
  try {
    const orgId = getActiveOrgId() || BDIDDIES_HOME_ORG_ID;
    const raw = localStorage.getItem(`integrations:${orgId}`) || localStorage.getItem('integrations');
    if (!raw) return undefined;
    const store = JSON.parse(raw);
    const mongo = store?.integrations?.mongodb;
    if (!mongo?.enabled || mongo?.mockMode) return undefined;
    const connectionString = mongo?.values?.connectionString;
    if (!connectionString?.trim()) return undefined;
    return {
      connectionString: connectionString.trim(),
      databaseName: mongo?.values?.databaseName,
    };
  } catch {
    return undefined;
  }
}

export async function hydrateAIStudioFromServer(): Promise<void> {
  const remote = await fetchAIStudioFromServer();
  if (!remote) return;
  const local = loadAIStudioConfig();
  const merged = { ...local, ...remote, commands: remote.commands?.length ? remote.commands : local.commands };
  localStorage.setItem(storageKey(), JSON.stringify(merged));
}

export function getCommandsForRole(role: AgentRole): AIStudioCommand[] {
  const config = loadAIStudioConfig();
  if (!config.starterQuestionsEnabled) return [];
  return config.commands.filter(
    (cmd) => cmd.enabled && cmd.roles.includes(role)
  );
}

const FINANCIAL_CATEGORIES: CommandCategory[] = ['financial', 'admin'];

export function validateCommandRoles(
  category: CommandCategory,
  roles: AgentRole[]
): string | null {
  if (category === 'financial' && roles.includes('customer')) {
    return 'Financial commands cannot be assigned to customers.';
  }
  if (category === 'admin' && !roles.some((r) => r === 'super_admin' || r === 'manager')) {
    return 'Admin commands require super_admin or manager role.';
  }
  if (FINANCIAL_CATEGORIES.includes(category) && roles.includes('customer')) {
    return 'This category is not available to customers.';
  }
  return null;
}

export function matchKnowledgeChunks(query: string, limit = 3): string[] {
  const { knowledgeChunks } = loadAIStudioConfig();
  const lower = query.toLowerCase();
  const tokens = lower.split(/\W+/).filter((t) => t.length > 2);
  const scored = knowledgeChunks
    .map((chunk) => {
      const hay = `${chunk.title} ${chunk.tags.join(' ')} ${chunk.body}`.toLowerCase();
      const score = tokens.reduce((s, t) => (hay.includes(t) ? s + 1 : s), 0);
      return { chunk, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map((item) => `### ${item.chunk.title}\n${item.chunk.body}`);
}
