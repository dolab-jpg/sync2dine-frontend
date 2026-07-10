import type { ContractTemplate } from './types';

const STORAGE_KEY = 'contractTemplates';

const DEFAULT_TEMPLATES: ContractTemplate[] = [
  {
    id: 'standard-fitout',
    name: 'Standard Fit-out Contract',
    defaultDepositPct: 25,
    defaultStages: [
      { label: 'Deposit', percent: 25, dueTrigger: 'On signing, to secure start date' },
      { label: 'First Fix', percent: 50, dueTrigger: 'When work begins on site' },
      { label: 'Completion', percent: 25, dueTrigger: 'On completion and sign-off' },
    ],
    bodyMarkdown: `Dear {CUSTOMER_NAME},

Thank you for choosing {COMPANY_NAME}. This contract confirms the agreed works at {CUSTOMER_ADDRESS}.

WORKS SUMMARY
{JOB_LINE_ITEMS}

CONTRACT TOTAL: £{CONTRACT_TOTAL}

PAYMENT SCHEDULE
{PAYMENT_SCHEDULE}

All work is guaranteed and carried out to building regulations where applicable. Materials and labour are included as listed above.

To accept, please use the secure signing link we will send you: {CONTRACT_SIGN_LINK}

Kind regards,
{USER_NAME}
{COMPANY_NAME}
{COMPANY_PHONE}`,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'small-jobs-5050',
    name: 'Small Jobs (50/50)',
    defaultDepositPct: 50,
    defaultStages: [
      { label: 'Booking', percent: 50, dueTrigger: 'On booking to confirm the visit' },
      { label: 'Completion', percent: 50, dueTrigger: 'On the day, once work is finished' },
    ],
    bodyMarkdown: `Hi {CUSTOMER_NAME},

Here's the agreement for the work at {CUSTOMER_ADDRESS}.

TASKS
{JOB_LINE_ITEMS}

TOTAL: £{CONTRACT_TOTAL}

PAYMENT
{PAYMENT_SCHEDULE}

Just use the secure signing link we send you to confirm: {CONTRACT_SIGN_LINK}

Cheers,
{USER_NAME}
{COMPANY_NAME}`,
    createdAt: new Date().toISOString(),
  },
];

export function loadContractTemplates(): ContractTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TEMPLATES));
      return DEFAULT_TEMPLATES;
    }
    const parsed = JSON.parse(raw) as ContractTemplate[];
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_TEMPLATES;
  } catch {
    return DEFAULT_TEMPLATES;
  }
}

function saveAll(templates: ContractTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function saveContractTemplate(template: Omit<ContractTemplate, 'id' | 'createdAt'> & { id?: string }): ContractTemplate {
  const templates = loadContractTemplates();
  if (template.id) {
    const existing = templates.find((t) => t.id === template.id);
    const updated: ContractTemplate = {
      ...(existing ?? { createdAt: new Date().toISOString() }),
      ...template,
      id: template.id,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    } as ContractTemplate;
    saveAll(templates.map((t) => (t.id === template.id ? updated : t)));
    return updated;
  }
  const created: ContractTemplate = {
    ...template,
    id: `tpl-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  saveAll([...templates, created]);
  return created;
}

export function deleteContractTemplate(id: string): void {
  saveAll(loadContractTemplates().filter((t) => t.id !== id));
}

export function getContractTemplate(id: string): ContractTemplate | undefined {
  return loadContractTemplates().find((t) => t.id === id);
}
