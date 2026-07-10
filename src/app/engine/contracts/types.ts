export interface PaymentStage {
  label: string;
  description: string;
  percent: number;
  amount: number;
  dueTrigger: string;
  status?: 'pending' | 'due' | 'paid';
}

export interface ContractTemplateStage {
  label: string;
  percent: number;
  dueTrigger: string;
}

export interface ContractTemplate {
  id: string;
  name: string;
  bodyMarkdown: string;
  defaultDepositPct: number;
  defaultStages: ContractTemplateStage[];
  createdAt: string;
}

export type ContractStatus = 'draft' | 'sent' | 'signed';

export interface ContractSignEvent {
  at: string;
  action: 'sent' | 'signed' | 'viewed';
  note?: string;
}

export interface Contract {
  id: string;
  customerId: string;
  customerName: string;
  quoteId?: string;
  templateId?: string;
  tradeName?: string;
  total: number;
  depositAmount: number;
  stages: PaymentStage[];
  bodyRendered: string;
  status: ContractStatus;
  createdAt: string;
  sentAt?: string;
  signToken?: string;
  signTokenExpiresAt?: string;
  signedAt?: string;
  signedByName?: string;
  signatureDataUrl?: string;
  contentHashAtSigning?: string;
  depositDue?: boolean;
  events?: ContractSignEvent[];
}

/** Public-safe view returned from GET /api/contract/:token */
export interface ContractPublicView {
  customerName: string;
  tradeName?: string;
  total: number;
  depositAmount: number;
  stages: PaymentStage[];
  bodyRendered: string;
  status: ContractStatus;
  signTokenExpiresAt?: string;
  signedAt?: string;
}
