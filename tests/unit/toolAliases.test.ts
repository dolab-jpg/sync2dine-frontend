import { describe, expect, it } from 'vitest';
import { resolveLegacyTool, TOOL_NAME_ALIASES } from '../../src/app/engine/ai/toolAliases';
import { isWriteToolBlockedInClarify, requiresSafetyConfirm, getHumanActionLabel } from '../../src/app/engine/ai/actionPolicy';
import { canExecuteAction } from '../../src/app/engine/ai/rolePermissions';
import type { AgentRole } from '../../src/app/engine/ai/agentContext';

const ALIAS_PAIRS = Object.entries(TOOL_NAME_ALIASES);

describe('resolveLegacyTool', () => {
  it('maps each alias to its canonical tool name', () => {
    expect(resolveLegacyTool('saveCustomer')).toBe('linkCustomer');
    expect(resolveLegacyTool('savePaymentPlan')).toBe('proposePaymentPlan');
    expect(resolveLegacyTool('saveProjectSchedule')).toBe('proposeSchedule');
    expect(resolveLegacyTool('navigate')).toBe('navigateTo');
    expect(resolveLegacyTool('draftClientReceipt')).toBe('sendClientReceipt');
  });

  it('passes canonical and unknown names through unchanged', () => {
    expect(resolveLegacyTool('linkCustomer')).toBe('linkCustomer');
    expect(resolveLegacyTool('saveQuote')).toBe('saveQuote');
    expect(resolveLegacyTool('someMadeUpTool')).toBe('someMadeUpTool');
    expect(resolveLegacyTool('')).toBe('');
  });

  it('never chains: canonical targets are not themselves aliases', () => {
    for (const [, canonical] of ALIAS_PAIRS) {
      expect(resolveLegacyTool(canonical)).toBe(canonical);
    }
  });
});

describe('clarify-phase blocking treats alias and canonical identically', () => {
  it('matches for every alias pair', () => {
    for (const [alias, canonical] of ALIAS_PAIRS) {
      expect(isWriteToolBlockedInClarify(alias)).toBe(isWriteToolBlockedInClarify(canonical));
    }
  });

  it('blocks write aliases and allows read/navigation aliases', () => {
    expect(isWriteToolBlockedInClarify('saveCustomer')).toBe(true);
    expect(isWriteToolBlockedInClarify('savePaymentPlan')).toBe(true);
    expect(isWriteToolBlockedInClarify('saveProjectSchedule')).toBe(true);
    expect(isWriteToolBlockedInClarify('navigate')).toBe(false);
    expect(isWriteToolBlockedInClarify('draftClientReceipt')).toBe(false);
  });
});

describe('safety-confirm decisions treat alias and canonical identically', () => {
  it('matches for every alias pair, with and without customer-message confirm', () => {
    for (const [alias, canonical] of ALIAS_PAIRS) {
      expect(requiresSafetyConfirm(alias)).toBe(requiresSafetyConfirm(canonical));
      expect(requiresSafetyConfirm(alias, true)).toBe(requiresSafetyConfirm(canonical, true));
    }
  });

  it('still gates writeData deletes regardless of alias table', () => {
    expect(requiresSafetyConfirm('writeData', undefined, { operation: 'delete' })).toBe(true);
    expect(requiresSafetyConfirm('writeData', undefined, { operation: 'update' })).toBe(false);
  });
});

describe('role permissions treat alias and canonical identically', () => {
  const roles: AgentRole[] = ['customer', 'agent', 'staff', 'manager', 'super_admin', 'builder', 'unknown'];

  it('matches for every alias pair across all roles', () => {
    for (const [alias, canonical] of ALIAS_PAIRS) {
      for (const role of roles) {
        expect(canExecuteAction(role, alias)).toBe(canExecuteAction(role, canonical));
      }
    }
  });

  it('navigate no longer bypasses the role gate', () => {
    // Canonical navigateTo is granted to customers but not to unknown callers.
    expect(canExecuteAction('customer', 'navigate')).toBe(true);
    expect(canExecuteAction('unknown', 'navigate')).toBe(false);
  });
});

describe('human action labels resolve aliases to the canonical label', () => {
  it('gives alias and canonical the same label', () => {
    for (const [alias, canonical] of ALIAS_PAIRS) {
      expect(getHumanActionLabel(alias)).toBe(getHumanActionLabel(canonical));
    }
    expect(getHumanActionLabel('saveCustomer')).toBe('Customer ready to save.');
    expect(getHumanActionLabel('savePaymentPlan')).toBe('Payment plan ready.');
  });
});
