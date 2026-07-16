/** Structured call dispositions for scraped/CRM lead dial tracking. */

export const LEAD_CALL_DISPOSITIONS = [
  'no_answer',
  'busy',
  'voicemail',
  'answered_interested',
  'answered_not_interested',
  'callback_requested',
  'wrong_number',
  'do_not_call',
  'transferred',
  'quote_requested',
  'appointment_booked',
  'failed',
  'other',
] as const;

export type LeadCallDisposition = (typeof LEAD_CALL_DISPOSITIONS)[number];

export const DISPOSITION_LABELS: Record<LeadCallDisposition, string> = {
  no_answer: 'No answer',
  busy: 'Busy',
  voicemail: 'Voicemail',
  answered_interested: 'Interested',
  answered_not_interested: 'Not interested',
  callback_requested: 'Callback requested',
  wrong_number: 'Wrong number',
  do_not_call: 'Do not call',
  transferred: 'Transferred',
  quote_requested: 'Quote requested',
  appointment_booked: 'Appointment booked',
  failed: 'Failed',
  other: 'Other',
};

export const CALL_QUEUE_STATUSES = [
  'not_called',
  'queued',
  'dialling',
  'called',
  'needs_retry',
  'do_not_call',
] as const;

export type CallQueueStatus = (typeof CALL_QUEUE_STATUSES)[number];

export const CALL_QUEUE_STATUS_LABELS: Record<CallQueueStatus, string> = {
  not_called: 'Not called',
  queued: 'Queued',
  dialling: 'Dialling…',
  called: 'Called',
  needs_retry: 'Needs retry',
  do_not_call: 'Do not call',
};

const RETRY_DISPOSITIONS = new Set<LeadCallDisposition>([
  'no_answer',
  'busy',
  'voicemail',
  'failed',
]);

const TERMINAL_NO_RETRY = new Set<LeadCallDisposition>([
  'do_not_call',
  'wrong_number',
  'answered_not_interested',
]);

/** Map free-text Vapi endedReason / tool outcome → closed disposition. */
export function mapEndedReasonToDisposition(
  endedReason: string | undefined | null,
  hints?: { transferred?: boolean; toolOutcome?: string },
): LeadCallDisposition {
  if (hints?.transferred) return 'transferred';
  const tool = String(hints?.toolOutcome ?? '').toLowerCase();
  if (tool.includes('interview') || tool.includes('appointment')) return 'appointment_booked';
  if (tool.includes('quote')) return 'quote_requested';
  if (tool.includes('lead_captured') || tool.includes('interested')) return 'answered_interested';
  if (tool.includes('transferred') || tool.includes('transfer')) return 'transferred';
  if (tool.includes('message_taken') || tool.includes('callback')) return 'callback_requested';
  if (tool.includes('do_not_call') || tool.includes('dnc')) return 'do_not_call';
  if (tool.includes('wrong')) return 'wrong_number';
  if (tool.includes('not_interested')) return 'answered_not_interested';

  const r = String(endedReason ?? '').toLowerCase();
  if (!r) return 'other';
  if (r.includes('no-answer') || r.includes('no_answer') || r.includes('customer-did-not-answer')) return 'no_answer';
  if (r.includes('busy')) return 'busy';
  if (r.includes('voicemail') || r.includes('machine')) return 'voicemail';
  if (r.includes('wrong')) return 'wrong_number';
  if (r.includes('transfer')) return 'transferred';
  if (r.includes('fail') || r.includes('error') || r.includes('sip-error') || r.includes('dial')) return 'failed';
  if (r.includes('hangup') || r.includes('customer-ended') || r.includes('assistant-ended') || r.includes('completed')) {
    return 'other';
  }
  return 'other';
}

export function isLeadCallDisposition(value: unknown): value is LeadCallDisposition {
  return typeof value === 'string' && (LEAD_CALL_DISPOSITIONS as readonly string[]).includes(value);
}

export function queueStatusAfterDisposition(
  disposition: LeadCallDisposition,
  attemptCount: number,
  maxAttempts = 3,
): CallQueueStatus {
  if (disposition === 'do_not_call' || TERMINAL_NO_RETRY.has(disposition)) {
    return disposition === 'do_not_call' ? 'do_not_call' : 'called';
  }
  if (RETRY_DISPOSITIONS.has(disposition) && attemptCount < maxAttempts) {
    return 'needs_retry';
  }
  return 'called';
}
