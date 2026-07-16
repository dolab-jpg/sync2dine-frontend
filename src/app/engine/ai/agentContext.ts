export type AgentRole =
  | 'platform_owner'
  | 'super_admin'
  | 'manager'
  | 'staff'
  | 'builder'
  | 'recruitment'
  | 'customer'
  | 'agent'
  | 'unknown';

export interface AgentContext {
  role: AgentRole;
  route: string;
  tradeId: string | null;
  customerId: string | null;
  projectId: string | null;
  quoteId: string | null;
  builderId: string | null;
  bcSessionId: string | null;
  bcInquiryId: string | null;
  planningApplicationId: string | null;
}

const EMPTY_CONTEXT: AgentContext = {
  role: 'unknown',
  route: '/',
  tradeId: null,
  customerId: null,
  projectId: null,
  quoteId: null,
  builderId: null,
  bcSessionId: null,
  bcInquiryId: null,
  planningApplicationId: null,
};

function readOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildAgentContext(pageContext: Record<string, unknown>): AgentContext {
  const roleValue = readOptionalString(pageContext.userRole) ?? 'unknown';
  // platform_owner has the same CRM/ops tool surface as super_admin when acting in an org
  const normalizedRole = roleValue === 'platform_owner' ? 'platform_owner' : roleValue;
  const role = ([
    'platform_owner',
    'super_admin',
    'manager',
    'staff',
    'builder',
    'recruitment',
    'customer',
    'agent',
    'unknown',
  ] as const).includes(normalizedRole as AgentRole)
    ? (normalizedRole as AgentRole)
    : 'unknown';

  return {
    role,
    route: readOptionalString(pageContext.route) ?? EMPTY_CONTEXT.route,
    tradeId: readOptionalString(pageContext.tradeId),
    customerId: readOptionalString(pageContext.customerId),
    projectId: readOptionalString(pageContext.projectId),
    quoteId: readOptionalString(pageContext.quoteId),
    builderId: readOptionalString(pageContext.builderId),
    bcSessionId: readOptionalString(pageContext.bcSessionId),
    bcInquiryId: readOptionalString(pageContext.bcInquiryId),
    planningApplicationId: readOptionalString(pageContext.planningApplicationId),
  };
}

export function getAgentScope(context: AgentContext): string {
  if (context.bcSessionId) return `bc:${context.bcSessionId}`;
  if (context.planningApplicationId) return `planning:${context.planningApplicationId}`;
  if (context.projectId) return `project:${context.projectId}`;
  if (context.quoteId) return `quote:${context.quoteId}`;
  if (context.customerId) return `customer:${context.customerId}`;
  if (context.builderId) return `builder:${context.builderId}`;
  if (context.tradeId) return `trade:${context.tradeId}`;
  const route = context.route.replace(/\W+/g, '_').replace(/^_+|_+$/g, '');
  return route ? `route:${route}` : 'global';
}

export function resolveAgentScope(context: AgentContext): string {
  return getAgentScope(context);
}
