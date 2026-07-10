/**
 * Planning & Consents domain model.
 *
 * Important: `stage` is a free-form display label for the pipeline, NOT an enforced
 * state machine. Staff or the AI agent can move an application to any stage in any
 * order. Nothing here gates the agent to a fixed sequence.
 */

export type PlanningStage =
  | 'pricing'
  | 'drawings'
  | 'customer_approval'
  | 'submitted'
  | 'validation'
  | 'changes_requested'
  | 'approved'
  | 'refused'
  | 'post_approval'
  | 'completed';

export const PLANNING_STAGES: Array<{ id: PlanningStage; label: string }> = [
  { id: 'pricing', label: 'Pricing sent' },
  { id: 'drawings', label: 'Drawings' },
  { id: 'customer_approval', label: 'Customer approval' },
  { id: 'submitted', label: 'Submitted to council' },
  { id: 'validation', label: 'Validation' },
  { id: 'changes_requested', label: 'Changes requested' },
  { id: 'approved', label: 'Approved' },
  { id: 'refused', label: 'Refused' },
  { id: 'post_approval', label: 'Post-approval' },
  { id: 'completed', label: 'Completed' },
];

export type PlanningApplicationType =
  | 'householder'
  | 'full'
  | 'outline'
  | 'lawful_development'
  | 'listed_building'
  | 'prior_approval';

export const PLANNING_APPLICATION_TYPES: Array<{ id: PlanningApplicationType; label: string }> = [
  { id: 'householder', label: 'Householder Planning Permission' },
  { id: 'full', label: 'Full Planning Permission' },
  { id: 'outline', label: 'Outline Planning Permission' },
  { id: 'lawful_development', label: 'Lawful Development Certificate' },
  { id: 'listed_building', label: 'Listed Building Consent' },
  { id: 'prior_approval', label: 'Prior Approval (Permitted Development)' },
];

export interface PlanningPricing {
  amount?: number;
  scope?: string;
  sentAt?: string;
  acceptedAt?: string;
  quoteId?: string;
}

export interface PlanningDrawing {
  id: string;
  filename: string;
  mimeType: string;
  dataUrl?: string;
  version: number;
  uploadedAt: string;
  uploadedBy: string;
  note?: string;
}

export interface PlanningCustomerApproval {
  token: string;
  status: 'pending' | 'approved' | 'changes';
  sentAt?: string;
  decisionAt?: string;
  note?: string;
}

export interface PlanningCouncil {
  name?: string;
  reference?: string;
  portalUrl?: string;
  submittedAt?: string;
  validationOfficer?: string;
  validationOfficerEmail?: string;
  targetDecisionDate?: string;
}

export interface PlanningChangeRequest {
  id: string;
  raisedAt: string;
  sourceEmail?: string;
  description: string;
  deadline?: string;
  status: 'open' | 'resolved';
  aiComment?: string;
  resolvedAt?: string;
}

export interface PlanningComment {
  id: string;
  author: string;
  body: string;
  source: 'staff' | 'ai' | 'customer';
  createdAt: string;
}

export type PostApprovalWorkstreamStatus = 'not_started' | 'in_progress' | 'done';

export interface PostApprovalTask {
  id: string;
  title: string;
  done: boolean;
}

export interface PostApprovalWorkstream {
  status: PostApprovalWorkstreamStatus;
  notes?: string;
  tasks: PostApprovalTask[];
}

export interface PlanningPostApproval {
  engineering: PostApprovalWorkstream;
  buildingRegs: PostApprovalWorkstream;
  buildOver: PostApprovalWorkstream;
}

export const POST_APPROVAL_WORKSTREAMS: Array<{
  id: keyof PlanningPostApproval;
  label: string;
  hint: string;
}> = [
  { id: 'engineering', label: 'Engineering', hint: 'Structural calculations and engineer sign-off' },
  { id: 'buildingRegs', label: 'Building Regulations', hint: 'Building Control approval (LABC / Approved Inspector)' },
  { id: 'buildOver', label: 'Build-Over Agreement', hint: 'Water authority consent to build over/near a public sewer' },
];

export type PlanningAiActionStatus = 'applied' | 'undone';

export interface PlanningAiAction {
  id: string;
  action: string;
  summary: string;
  input: Record<string, unknown>;
  /** Full snapshot of the application before this action ran (used for undo). */
  previous?: Record<string, unknown>;
  createdAt: string;
  createdBy: string;
  status: PlanningAiActionStatus;
}

export interface PlanningApplication {
  id: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  address: string;
  title: string;
  applicationType: PlanningApplicationType;
  /** Free-form display label - see note at top of file. */
  stage: PlanningStage;
  description?: string;
  pricing: PlanningPricing;
  drawings: PlanningDrawing[];
  customerApproval: PlanningCustomerApproval;
  council: PlanningCouncil;
  changeRequests: PlanningChangeRequest[];
  comments: PlanningComment[];
  courtesyEmailSentAt?: string;
  decision?: 'approved' | 'refused';
  decidedAt?: string;
  decisionNote?: string;
  postApproval: PlanningPostApproval;
  aiActions: PlanningAiAction[];
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export function emptyWorkstream(): PostApprovalWorkstream {
  return { status: 'not_started', tasks: [] };
}

export function emptyPostApproval(): PlanningPostApproval {
  return {
    engineering: emptyWorkstream(),
    buildingRegs: emptyWorkstream(),
    buildOver: emptyWorkstream(),
  };
}

export function stageLabel(stage: PlanningStage): string {
  return PLANNING_STAGES.find((s) => s.id === stage)?.label ?? stage;
}

export function applicationTypeLabel(type: PlanningApplicationType): string {
  return PLANNING_APPLICATION_TYPES.find((t) => t.id === type)?.label ?? type;
}
