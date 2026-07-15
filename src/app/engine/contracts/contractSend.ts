import type { Contract } from './types';
import {
  generateSignToken,
  signTokenExpiry,
  updateContract,
  getContract,
} from './contractStore';
import { buildContractSignUrl, syncContractToServer } from './contractApi';
import { renderTemplate } from '../messaging/templateRenderer';
import { messagingHub } from '../messaging/messagingHub';
import { integrationService } from '../integrations/integrationService';

export interface ContractCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
}

const SEND_EMAIL_TEMPLATE = `Dear {CUSTOMER_NAME},

Your contract is ready to review and sign online.

Contract total: £{CONTRACT_TOTAL}
Deposit: £{DEPOSIT_AMOUNT}

Please use the secure link below to read the full agreement and sign:

{CONTRACT_SIGN_LINK}

If you have any questions, reply to this email.

Kind regards,
{USER_NAME}
{COMPANY_NAME}
{COMPANY_PHONE}`;

export interface SendContractResult {
  success: boolean;
  error?: string;
  mock?: boolean;
  signUrl?: string;
}

export async function sendContractEmail(
  contract: Contract,
  customer: ContractCustomer,
  userName: string
): Promise<SendContractResult> {
  if (contract.status === 'signed') {
    return { success: false, error: 'Contract is already signed' };
  }

  const signToken = contract.signToken ?? generateSignToken();
  const signTokenExpiresAt = contract.signTokenExpiresAt ?? signTokenExpiry(30);
  const signUrl = buildContractSignUrl(signToken);
  const sentAt = new Date().toISOString();

  updateContract(contract.id, {
    signToken,
    signTokenExpiresAt,
    status: 'sent',
    sentAt,
  });

  const synced = getContract(contract.id);
  if (!synced) {
    return { success: false, error: 'Contract not found after update' };
  }

  const syncResult = await syncContractToServer(synced);
  if (!syncResult.success) {
    return { success: false, error: syncResult.error ?? 'Could not prepare signing link' };
  }

  const company = integrationService.getConfig('company');
  const body = renderTemplate(SEND_EMAIL_TEMPLATE, {
    CUSTOMER_NAME: customer.name,
    USER_NAME: userName,
    CONTRACT_TOTAL: contract.total.toLocaleString('en-GB', { maximumFractionDigits: 0 }),
    DEPOSIT_AMOUNT: contract.depositAmount.toLocaleString('en-GB', { maximumFractionDigits: 0 }),
    CONTRACT_SIGN_LINK: signUrl,
    COMPANY_NAME: company.companyName || 'Builder Diddies',
    COMPANY_PHONE: company.phone || '',
  });

  const result = await messagingHub.send(
    {
      channels: ['email'],
      to: {
        email: customer.email,
        phone: customer.phone,
        customerId: customer.id,
        customerName: customer.name,
      },
      subject: `Review and sign your contract — ${company.companyName || 'Builder Diddies'}`,
      body,
      eventType: 'custom',
    },
    customer
  );

  if (!result.success) {
    return { success: false, error: result.errors[0] ?? 'Failed to send email' };
  }

  return {
    success: true,
    mock: result.logs.some((l) => l.status === 'mock'),
    signUrl,
  };
}
