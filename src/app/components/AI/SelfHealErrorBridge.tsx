import { useContext, useEffect, useRef } from 'react';
import { AppContext } from '../../App';
import { useAIAssistant } from '../../context/AIAssistantContext';
import {
  emitSelfHealError,
  installSelfHealFetchHook,
  SELF_HEAL_ERROR_EVENT,
  type SelfHealErrorDetail,
} from '../../engine/ai/selfHealEvents';
import { listCodeFixJobs, offerCodeFix } from '../../engine/ai/codeFixService';
import { getActiveOrgId } from '../../engine/platform/orgContext';

const ELIGIBLE = new Set(['super_admin', 'manager', 'staff', 'builder', 'platform_owner']);

/**
 * Listens for app errors and offers Yes/No fix in the existing CRM AI chat.
 * OpenAI tool-schema 400s get a clear offer naming the broken function.
 */
export function SelfHealErrorBridge() {
  const app = useContext(AppContext);
  const { setIsOpen, addMessage, pageContext } = useAIAssistant();
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
      busyRef.current = true;
      // Force-open panel immediately so Yes/No is visible
      setIsOpen(true);

      void (async () => {
        try {
          const route = detail.route || String(pageContext.route || window.location.pathname);
          const functionName = detail.functionName;
          const { job, dedupe, message } = await offerCodeFix({
            errorCode: detail.errorCode,
            description: detail.description,
            route,
            requesterRole: role === 'platform_owner' ? 'super_admin' : role,
            requesterName: app?.user.name || 'Staff',
            requesterUserId: app?.user.id,
            orgId: getActiveOrgId() || undefined,
          });

          setIsOpen(true);

          if (dedupe && job.status !== 'offered') {
            addMessage({
              role: 'assistant',
              content:
                message ||
                `I’m already working on **${job.errorCode || 'this error'}** (status: ${job.status}). I’ll keep you updated here.`,
              fixJobId: job.id,
            });
            return;
          }

          let cursorNote = '';
          try {
            const status = await listCodeFixJobs();
            if (!status.cursorConfigured) {
              cursorNote =
                '\n\n⚠️ **CURSOR_API_KEY** is not configured yet — if you say Yes, the job will be logged and alert in **AI Audit → Code fixes**, but Cursor cannot open a PR until the key is added.';
            }
          } catch {
            // ignore
          }

          const schemaIntro = detail.schemaError || functionName
            ? `OpenAI rejected the tool schema for **\`${functionName || 'unknown'}\`** (invalid function parameters).\n\n` +
              `This is a surgical code fix in \`orchestrator-handler.ts\` — not a product redesign.\n\n` +
              `${job.description}\n\n`
            : `I see error \`${job.errorCode || 'UNKNOWN'}\` on **${job.route || 'this page'}**.\n\n` +
              `${job.description}\n\n`;

          addMessage({
            role: 'assistant',
            content:
              schemaIntro +
              (job.scope === 'needs_cursor_approval'
                ? 'This may need a wider change — if you say **Yes**, I’ll prepare it for **your approval in Cursor** before any redesign.\n\n'
                : 'I can attempt a **surgical fix** (smallest patch — not a full redesign).\n\n') +
              '**Would you like me to fix this?**' +
              cursorNote,
            fixOffer: {
              jobId: job.id,
              errorCode: job.errorCode,
              description: job.description,
              route: job.route,
              scope: job.scope,
            },
          });
        } catch (err) {
          setIsOpen(true);
          addMessage({
            role: 'assistant',
            content: `I noticed an error but couldn’t open a fix offer: ${
              err instanceof Error ? err.message : String(err)
            }`,
          });
        } finally {
          busyRef.current = false;
        }
      })();
    };

    window.addEventListener(SELF_HEAL_ERROR_EVENT, onOffer);
    return () => window.removeEventListener(SELF_HEAL_ERROR_EVENT, onOffer);
  }, [app?.user, pageContext.route, setIsOpen, addMessage]);

  return null;
}
