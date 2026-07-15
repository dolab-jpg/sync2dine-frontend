import type { AgentRole } from '../../engine/ai/agentContext';

export type CommandCategory =
  | 'customer_self_service'
  | 'sales_quoting'
  | 'project_pm'
  | 'financial'
  | 'foreman'
  | 'admin';

export type HumourLevel = 'straight' | 'dry' | 'cheeky' | 'del_boy';
export type AutonomyLevel = 'assist' | 'balanced' | 'autopilot';
export type AfterConsentAction = 'stay' | 'open_quote' | 'both';

export interface AIStudioCommand {
  id: string;
  label: string;
  prompt: string;
  roles: AgentRole[];
  category: CommandCategory;
  enabled: boolean;
}

export interface AIKnowledgeChunk {
  id: string;
  title: string;
  tags: string[];
  body: string;
}

export interface AIStudioConfig {
  companyInstructions: string;
  humourLevel: HumourLevel;
  britishEnglish: boolean;
  autonomyLevel: AutonomyLevel;
  autoRunQuoteDrafts: boolean;
  autoRunNavigation: boolean;
  requireConfirmCustomerMessages: boolean;
  estimateBufferPercent: number;
  estimateRoundUp: 0 | 250 | 500;
  disclaimerTemplate: string;
  afterConsent: AfterConsentAction;
  defaultPanelOpen: boolean;
  panelDocked: boolean;
  starterQuestionsEnabled: boolean;
  conversationLoggingEnabled: boolean;
  conversationRetentionDays: number;
  /** When true, surgical self-heal jobs auto-enqueue without chat Yes/No */
  selfHealAutoStart: boolean;
  auditRoles: AgentRole[];
  commands: AIStudioCommand[];
  knowledgeChunks: AIKnowledgeChunk[];
}

export const DEFAULT_AI_STUDIO: AIStudioConfig = {
  companyInstructions: '',
  humourLevel: 'dry',
  britishEnglish: true,
  autonomyLevel: 'autopilot',
  autoRunQuoteDrafts: true,
  autoRunNavigation: true,
  requireConfirmCustomerMessages: true,
  estimateBufferPercent: 12,
  estimateRoundUp: 250,
  disclaimerTemplate:
    "Ballpark **{{low}}–{{high}}** — we've erred on the cautious side. Someone from the team will go through this properly; it might land a touch higher or lower. Not a final quote until we've confirmed on site.",
  afterConsent: 'both',
  defaultPanelOpen: true,
  panelDocked: true,
  starterQuestionsEnabled: false,
  conversationLoggingEnabled: true,
  conversationRetentionDays: 365,
  selfHealAutoStart: true,
  auditRoles: ['super_admin', 'manager'],
  commands: [],
  knowledgeChunks: [],
};
