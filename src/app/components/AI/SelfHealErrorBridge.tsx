import { useContext, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { AppContext } from '../../App';
import { useAIAssistant } from '../../context/AIAssistantContext';
import {
  emitSelfHealError,
  installSelfHealFetchHook,
  isAuthSelfHealError,
  isOpsSelfHealError,
  SELF_HEAL_ERROR_EVENT,
  type SelfHealErrorDetail,
} from '../../engine/ai/selfHealEvents';
import { enqueueCodeFix, offerCodeFix } from '../../engine/ai/codeFixService';
import { getActiveOrgId } from '../../engine/platform/orgContext';
import { useAIStudioConfig } from '../../hooks/useAIStudioConfig';

const ELIGIBLE = new Set(['super_admin', 'manager', 'staff', 'builder', 'platform_owner']);

/** Throttle toasts when the offer API itself is down (502 etc.). */
let lastOfferFailAt = 0;
const OFFER_FAIL_COOLDOWN_MS = 5 * 60_000;
let lastAuthToastAt = 0;
const AUTH_TOAST_COOLDOWN_MS = 2 * 60_000;
let lastOfferToastAt = 0;
const OFFER_TOAST_COOLDOWN_MS = 15_000;

const AUDIT_OFFERS_HREF = '/ai-audit?tab=code_fixes&focus=offers';

/**
 * Listens for app errors and logs code-fix offers to AI Audit (not Cynthia chat).
 * Surgical fixes auto-start when selfHealAutoStart is enabled.
 * Auth + ops/infra (502/503/quota) never open Trae offers.
 */
export function SelfHealErrorBridge() {
  const app = useContext(AppContext);
  const { pageContext } = useAIAssistant();
  const studio = useAIStudioConfig();
  const busyRef = useRef(false);

  useEffect(() => {
    const uninstallFetch = installSelfHealFetchHook();

    const onWindowError = (event: ErrorEvent) => {
      emitSelfHealError({
        errorCode: event.error?.name || 'WINDOW_ERROR',
        description: event.message || String(event.error || 'Unknown error'),
        route: window.location.pathname,
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
            ? reason
            : 'Unhandled promise rejection';
      const schemaMatch = message.match(/Invalid schema for function ['"]([^'"]+)['"]/i);
      emitSelfHealError({
        errorCode: schemaMatch
          ? `OPENAI_TOOL_SCHEMA:${schemaMatch[1]}`
          : reason instanceof Error
            ? reason.name || 'UNHANDLED_REJECTION'
            : 'UNHANDLED_REJECTION',
        description: message,
        route: window.location.pathname,
        functionName: schemaMatch?.[1],
        schemaError: Boolean(schemaMatch),
      });
    };

    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onRejection);

    return () => {
      uninstallFetch();
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  useEffect(() => {
    const role = app?.user.role ?? '';
    if (!ELIGIBLE.has(role)) return;

    const onOffer = (event: Event) => {
      const detail = (event as CustomEvent<SelfHealErrorDetail>).detail;
      if (!detail || busyRef.current) return;

      if (isOpsSelfHealError(detail)) {
        if (import.meta.env.DEV) {
          console.info('[self-heal] suppressed ops error', detail.errorCode, detail.description.slice(0, 120));
        }
        return;
      }

      busyRef.current = true;

      void (async () => {
        try {
          if (isAuthSelfHealError(detail)) {
            const now = Date.now();
            if (now - lastAuthToastAt >= AUTH_TOAST_COOLDOWN_MS) {
              lastAuthToastAt = now;
              toast.error('Session unauthorized — sign out and sign back in. Not a code bug.', {
                duration: 8000,
              });
            }
            return;
          }

          const route = detail.route || String(pageContext.route || window.location.pathname);
          const requesterRole = role === 'platform_owner' ? 'super_admin' : role;
          const requesterName = app?.user.name || 'Staff';
          const requesterUserId = app?.user.id;
          const orgId = getActiveOrgId() || undefined;

          const offer = await offerCodeFix({
            errorCode: detail.errorCode,
            description: detail.description,
            route,
            requesterRole,
            requesterName,
            requesterUserId,
            orgId,
          });

          if (offer.skipped || !offer.job) {
            return;
          }

          const { job, dedupe, message } = offer;
          const shouldAutoStart = studio.selfHealAutoStart === true && job.scope === 'surgical';

          if (shouldAutoStart && (!dedupe || job.status === 'offered')) {
            await enqueueCodeFix({
              jobId: job.id,
              errorCode: job.errorCode,
              description: job.description,
              route: job.route,
              requesterRole,
              requesterName,
              requesterUserId,
              orgId,
            });
            toast.success('Queued surgical fix for Trae — open AI Audit → Code fixes', {
              action: {
                label: 'Open',
                onClick: () => {
                  window.location.assign('/ai-audit?tab=code_fixes');
                },
              },
              duration: 10_000,
            });
            return;
          }

          if (dedupe && job.status !== 'offered') {
            const now = Date.now();
            if (now - lastOfferToastAt < OFFER_TOAST_COOLDOWN_MS) return;
            lastOfferToastAt = now;
            toast.message(message || `Already tracking ${job.errorCode || 'this error'} in AI Audit`, {
              action: {
                label: 'Open',
                onClick: () => {
                  window.location.assign('/ai-audit?tab=code_fixes');
                },
              },
              duration: 6000,
            });
            return;
          }

          const now = Date.now();
          if (now - lastOfferToastAt >= OFFER_TOAST_COOLDOWN_MS) {
            lastOfferToastAt = now;
            toast.message(
              `Logged ${job.errorCode || 'error'} in AI Audit → Pending offers. Queue or dismiss there.`,
              {
                action: {
                  label: 'Open',
                  onClick: () => {
                    window.location.assign(AUDIT_OFFERS_HREF);
                  },
                },
                duration: 10_000,
              },
            );
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (isOpsSelfHealError({ errorCode: 'OFFER_FAILED', description: msg })) {
            if (import.meta.env.DEV) {
              console.info('[self-heal] offer API ops failure suppressed', msg);
            }
            return;
          }
          const now = Date.now();
          if (now - lastOfferFailAt < OFFER_FAIL_COOLDOWN_MS) return;
          lastOfferFailAt = now;
          toast.error('Couldn’t log that error for self-heal. Try AI Audit → Code fixes later.', {
            duration: 8000,
          });
        } finally {
          busyRef.current = false;
        }
      })();
    };

    window.addEventListener(SELF_HEAL_ERROR_EVENT, onOffer);
    return () => window.removeEventListener(SELF_HEAL_ERROR_EVENT, onOffer);
  }, [app?.user, pageContext.route, studio.selfHealAutoStart]);

  return null;
}
