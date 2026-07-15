import { describe, expect, it } from 'vitest';
import {
  FACADE_OPERATION_MAP,
  FACADE_TOOL_NAMES,
  expandFacadeArgs,
  expandFacadeCopilotAction,
  isFacadeToolName,
} from '../../src/app/engine/ai/toolFacadeClient';
import { resolveLegacyTool } from '../../src/app/engine/ai/toolAliases';
import { canExecuteAction } from '../../src/app/engine/ai/rolePermissions';
import { requiresSafetyConfirm } from '../../src/app/engine/ai/actionPolicy';
import { PLANNING_ACTION_NAMES } from '../../src/app/engine/planning/planningActionNames';
import type { AgentRole } from '../../src/app/engine/ai/agentContext';

const ALL_ROLES: AgentRole[] = ['customer', 'agent', 'staff', 'manager', 'super_admin', 'builder', 'recruitment', 'unknown'];

describe('facade tool registry', () => {
  it('exposes exactly the 12 facade tool names', () => {
    expect(FACADE_TOOL_NAMES).toEqual([
      'searchRecords', 'manageCustomer', 'manageQuote', 'managePricing',
      'manageContract', 'manageProject', 'siteOperations', 'manageInvoices',
      'managePayments', 'sendMessage', 'managePlanning', 'appControl',
    ]);
    for (const name of FACADE_TOOL_NAMES) {
      expect(isFacadeToolName(name)).toBe(true);
    }
    expect(isFacadeToolName('saveQuote')).toBe(false);
  });

  it('managePlanning keeps the 17 planning operations verbatim, 1:1', () => {
    expect(Object.keys(FACADE_OPERATION_MAP.managePlanning)).toEqual([...PLANNING_ACTION_NAMES]);
    for (const name of PLANNING_ACTION_NAMES) {
      expect(FACADE_OPERATION_MAP.managePlanning[name]).toBe(name);
    }
  });

  it('no canonical target is itself a facade name (no chaining)', () => {
    for (const ops of Object.values(FACADE_OPERATION_MAP)) {
      for (const canonical of Object.values(ops)) {
        expect(isFacadeToolName(canonical)).toBe(false);
      }
    }
  });
});

describe('expandFacadeArgs', () => {
  it('maps operations to canonical names and flattens payload', () => {
    const expanded = expandFacadeArgs('manageQuote', {
      operation: 'save',
      quoteId: 'Q1',
      payload: { customerId: 'C1', total: 500 },
    });
    expect(expanded).toEqual({
      action: 'saveQuote',
      args: { customerId: 'C1', total: 500, quoteId: 'Q1' },
    });
  });

  it('top-level ids override payload only when non-empty', () => {
    expect(
      expandFacadeArgs('managePricing', {
        operation: 'approve',
        quoteId: 'top',
        payload: { quoteId: 'payload' },
      })?.args.quoteId
    ).toBe('top');
    expect(
      expandFacadeArgs('managePricing', {
        operation: 'approve',
        quoteId: '',
        payload: { quoteId: 'payload' },
      })?.args.quoteId
    ).toBe('payload');
  });

  it('preserves an inner writeData operation inside payload', () => {
    const expanded = expandFacadeArgs('appControl', {
      operation: 'writeData',
      payload: { collection: 'customers', operation: 'delete', id: 'C9' },
    });
    expect(expanded?.action).toBe('writeData');
    expect(expanded?.args).toEqual({ collection: 'customers', operation: 'delete', id: 'C9' });
  });

  it('returns null for unknown operations and non-facade names', () => {
    expect(expandFacadeArgs('manageQuote', { operation: 'nope' })).toBeNull();
    expect(expandFacadeArgs('manageQuote', {})).toBeNull();
    expect(expandFacadeArgs('saveQuote', { operation: 'save' })).toBeNull();
  });
});

describe('expandFacadeCopilotAction', () => {
  it('expands a leaked facade action and records requestedAs', () => {
    const expanded = expandFacadeCopilotAction({
      action: 'manageCustomer',
      input: {},
      output: { operation: 'updateLead', payload: { customerId: 'C1', status: 'won' } },
    });
    expect(expanded.action).toBe('updateLeadStatus');
    expect(expanded.output).toEqual({ customerId: 'C1', status: 'won', requestedAs: 'manageCustomer' });
    expect(expanded.input).toEqual({ customerId: 'C1', status: 'won' });
  });

  it('falls back to input when output is empty', () => {
    const expanded = expandFacadeCopilotAction({
      action: 'searchRecords',
      input: { operation: 'customers', query: 'olivia' },
      output: {},
    });
    expect(expanded.action).toBe('searchCustomers');
    expect(expanded.output).toEqual({ query: 'olivia', requestedAs: 'searchRecords' });
  });

  it('passes through canonical actions and unresolvable facade calls unchanged', () => {
    const canonical = { action: 'saveQuote', input: {}, output: { customerId: 'C1' } };
    expect(expandFacadeCopilotAction(canonical)).toBe(canonical);
    const broken = { action: 'manageQuote', input: {}, output: { operation: 'nope' } };
    expect(expandFacadeCopilotAction(broken)).toBe(broken);
  });
});

describe('gate integrity — facade expansion cannot bypass client gates', () => {
  it('managePricing.approve expands to approveQuote and keeps the manager-only gate', () => {
    const expanded = expandFacadeCopilotAction({
      action: 'managePricing',
      input: {},
      output: { operation: 'approve', payload: { quoteId: 'Q1' } },
    });
    expect(expanded.action).toBe('approveQuote');
    expect(canExecuteAction('staff', expanded.action)).toBe(false);
    expect(canExecuteAction('builder', expanded.action)).toBe(false);
    expect(canExecuteAction('manager', expanded.action)).toBe(true);
    expect(canExecuteAction('super_admin', expanded.action)).toBe(true);
    expect(requiresSafetyConfirm(expanded.action)).toBe(true);
  });

  it('manageContract.send expands to sendContract and still requires confirmation', () => {
    const expanded = expandFacadeCopilotAction({
      action: 'manageContract',
      input: {},
      output: { operation: 'send', contractId: 'CT1' },
    });
    expect(expanded.action).toBe('sendContract');
    expect(requiresSafetyConfirm(expanded.action)).toBe(true);
  });

  it('writeData deletes routed via appControl still require confirmation', () => {
    const expanded = expandFacadeCopilotAction({
      action: 'appControl',
      input: {},
      output: { operation: 'writeData', payload: { collection: 'customers', operation: 'delete', id: 'C1' } },
    });
    expect(expanded.action).toBe('writeData');
    expect(requiresSafetyConfirm(expanded.action, undefined, expanded.output)).toBe(true);
  });

  it('facade → alias chains resolve to the canonical executor gate (receipt)', () => {
    const expanded = expandFacadeCopilotAction({
      action: 'manageProject',
      input: {},
      output: { operation: 'receipt', payload: { transactionId: 'T1', projectId: 'P1', customerId: 'C1' } },
    });
    expect(expanded.action).toBe('draftClientReceipt');
    expect(resolveLegacyTool(expanded.action)).toBe('sendClientReceipt');
    expect(canExecuteAction('staff', expanded.action)).toBe(canExecuteAction('staff', 'sendClientReceipt'));
  });

  it('unexpanded facade names carry no role permissions', () => {
    for (const facadeName of FACADE_TOOL_NAMES) {
      for (const role of ALL_ROLES) {
        expect(canExecuteAction(role, facadeName), `${facadeName} / ${role}`).toBe(false);
      }
    }
  });
});
