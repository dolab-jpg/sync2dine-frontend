export type ProjectStatus = 'planning' | 'in_progress' | 'snagging' | 'handover' | 'completed' | 'on_hold' | 'archived';
export type TaskStatus = 'todo' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';
export type PaymentStageStatus = 'pending' | 'due' | 'paid';
export type InvoiceStatus = 'draft' | 'sent' | 'paid';
export type ContractStatus = 'draft' | 'sent' | 'signed';
export type FileSource = 'job_site' | 'whatsapp' | 'message' | 'survey' | 'ai' | 'document' | 'building_control';
export type MessageChannel = 'app' | 'whatsapp' | 'portal' | 'email';
export type WhatsAppMode = 'individual' | 'group' | 'portal_only';
export type ContactRole = 'primary' | 'partner' | 'site_contact' | 'other';
export type AIActionStatus = 'proposed' | 'approved' | 'rejected';

export interface Milestone {
  id: string;
  title: string;
  targetDate: string;
  completed: boolean;
}

export interface ProjectTask {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  status: TaskStatus;
  linkedStageId?: string;
  targetDate?: string;
  createdAt: string;
  completedAt?: string;
  priority: TaskPriority;
  photos: string[];
  createdBy: string;
  source: 'manual' | 'ai';
}

export interface PaymentStage {
  id: string;
  name: string;
  percentage: number;
  amount: number;
  status: PaymentStageStatus;
  dueDate?: string;
  paidDate?: string;
  notes?: string;
  linkedTaskIds?: string[];
}

export interface Invoice {
  id: string;
  stageId?: string;
  lineItems: Array<{ description: string; amount: number }>;
  total: number;
  status: InvoiceStatus;
  pdfPath?: string;
  createdAt: string;
  sentAt?: string;
}

export interface Contract {
  id: string;
  terms: string;
  status: ContractStatus;
  pdfPath?: string;
  createdAt: string;
  signedAt?: string;
}

export interface ProjectFile {
  id: string;
  storagePath: string;
  filename: string;
  mimeType: string;
  source: FileSource;
  uploadedBy: string;
  caption?: string;
  takenAt: string;
  messageId?: string;
  taskId?: string;
  dataUrl?: string;
}

export interface ProjectMessage {
  id: string;
  from: string;
  fromRole: 'customer' | 'builder' | 'office' | 'admin';
  body: string;
  timestamp: string;
  channel: MessageChannel;
  attachments?: string[];
  senderPhone?: string;
  senderContactId?: string;
  senderContactName?: string;
  senderContactRole?: ContactRole;
  emailSent?: boolean;
}

export interface ContractorComm {
  id: string;
  builderId: string;
  builderName: string;
  subject: string;
  body: string;
  contractorId?: string;
  contractorTradeId?: string;
  contractorTradeName?: string;
  priceQuoted?: number;
  status: 'draft' | 'sent' | 'replied';
  channel: 'app' | 'whatsapp' | 'email';
  createdAt: string;
}

export interface AIActionLog {
  id: string;
  action: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: AIActionStatus;
  createdAt: string;
  approvedBy?: string;
}

export interface WhatsAppGroup {
  metaGroupId?: string;
  inviteLink?: string;
  subject: string;
  status: 'created' | 'active' | 'closed';
  participantCount: number;
  createdAt: string;
}

export interface BuilderPayment {
  id: string;
  description: string;
  amount: number;
  status: 'pending' | 'approved' | 'paid';
  date: string;
}

export interface DesignItem {
  id: string;
  category: string;
  product: string;
  supplier?: string;
  cost?: number;
  status: 'ordered' | 'delivered' | 'installed';
}

export interface CustomerAutoUpdate {
  id: string;
  channel: MessageChannel;
  cadence: 'daily' | 'weekly' | 'milestone';
  template: string;
  enabled: boolean;
}

export interface ProjectPlan {
  id: string;
  title: string;
  status: 'draft' | 'active' | 'archived';
  cadence: 'daily' | 'weekly' | 'monthly' | 'milestone' | 'ad_hoc';
  notes?: string;
}

export interface AssignedContractor {
  id: string;
  name: string;
  trade?: string;
  contractorId?: string;
  tradeId?: string;
  role?: 'lead' | 'sub';
  phone?: string;
  email?: string;
}

export type CostEntryType = 'receipt' | 'manual' | 'ai';
export type CostEntryStatus = 'recorded' | 'flagged';

export interface CostEntryItem {
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
  category: string;
}

export interface CostEntry {
  id: string;
  projectId: string;
  builderId: string;
  type: CostEntryType;
  supplier: string;
  date: string;
  items: CostEntryItem[];
  subtotal: number;
  vat: number;
  total: number;
  receiptPhoto?: string;
  aiConfidence: number;
  aiSummary?: string;
  status: CostEntryStatus;
  createdAt: string;
}

export interface TimesheetEntry {
  id: string;
  projectId: string;
  builderId: string;
  clockIn: string;
  clockOut?: string;
  hours?: number;
  rate: number;
  labourCost?: number;
  notes?: string;
}

export interface ChangeOrder {
  id: string;
  title: string;
  amount: number;
  amountMin?: number;
  amountMax?: number;
  status: 'proposed' | 'pending_customer' | 'approved' | 'rejected';
  createdAt: string;
  description?: string;
  reason?: string;
  estimatedDays?: number;
  sourcePhotoIds?: string[];
  staffApprovedAt?: string;
  staffApprovedBy?: string;
  customerDecisionAt?: string;
  customerDecisionBy?: string;
  customerDecisionNote?: string;
}

export interface SnagItem {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'resolved';
  photoUrl?: string;
  resolvedAt?: string;
  source: 'checklist' | 'ai' | 'manual';
}

export interface HandoverRecord {
  signedAt?: string;
  signedBy?: string;
  customerNotes?: string;
  retentionReleased?: boolean;
}

export interface ProjectReview {
  rating: number;
  comment?: string;
  submittedAt: string;
}

export interface WarrantyRecord {
  durationMonths: number;
  startDate: string;
  notes?: string;
}

export interface PortfolioEntry {
  id: string;
  projectId: string;
  title: string;
  tradeName?: string;
  beforePhotos: string[];
  afterPhotos: string[];
  review?: ProjectReview;
  completedAt: string;
}

export interface UnifiedProject {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  quoteId?: string;
  projectName: string;
  tradeId?: string;
  tradeName?: string;
  address: string;
  startDate: string;
  finishDate: string;
  status: ProjectStatus;
  description: string;
  assignedBuilder: string;
  totalCustomerCost: number;
  workingDaysOff: string[];
  milestones: Milestone[];
  tasks: ProjectTask[];
  paymentStages: PaymentStage[];
  builderPayments: BuilderPayment[];
  invoices: Invoice[];
  contracts: Contract[];
  files: ProjectFile[];
  messages: ProjectMessage[];
  contractorComms: ContractorComm[];
  aiActions: AIActionLog[];
  photos: string[];
  designItems: DesignItem[];
  whatsappMode: WhatsAppMode;
  whatsappGroup?: WhatsAppGroup;
  portalToken?: string;
  escalated?: boolean;
  customerAutoUpdates?: boolean;
  plans?: ProjectPlan[];
  assignedContractors?: AssignedContractor[];
  changeOrders?: ChangeOrder[];
  costEntries?: CostEntry[];
  timesheets?: TimesheetEntry[];
  snags?: SnagItem[];
  handover?: HandoverRecord;
  review?: ProjectReview;
  warranty?: WarrantyRecord;
  archivedAt?: string;
}

export interface CustomerContact {
  id: string;
  customerId: string;
  name: string;
  phone: string;
  role: ContactRole;
  whatsappOptIn: boolean;
  isPrimary: boolean;
  notes?: string;
}

export interface PortalToken {
  token: string;
  projectId: string;
  customerId: string;
  expiresAt: string;
}

export interface WhatsAppSession {
  phone: string;
  lastInboundAt: string;
  channel: 'individual' | 'group';
  groupId?: string;
}
