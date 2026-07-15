import { useContext, useEffect, useRef } from 'react';
import { AppContext } from '../../App';
import { useAIAssistant } from '../../context/AIAssistantContext';
import {
  emitSelfHealError,
  installSelfHealFetchHook,
  isAuthSelfHealError,
  SELF_HEAL_ERROR_EVENT,
  type SelfHealErrorDetail,
} from '../../engine/ai/selfHealEvents';
import { enqueueCodeFix, listCodeFixJobs, offerCodeFix } from '../../engine/ai/codeFixService';
import { getActiveOrgId } from '../../engine/platform/orgContext';
import { useAIStudioConfig } from '../../hooks/useAIStudioConfig';

const ELIGIBLE = new Set(['super_admin', 'manager', 'staff', 'builder', 'platform_owner']);

/**
 * Listens for app errors and offers Yes/No fix in the existing CRM AI chat.
 * Surgical fixes auto-start when selfHealAutoStart is enabled.
 */
export function SelfHealErrorBridge() {
  const app = useContext(AppContext);
  const { setIsOpen, addMessage, pageContext, trackFixJob } = useAIAssistant();
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
      busyRef.current = true;
      setIsOpen(true);

      void (async () => {
        try {
          if (isAuthSelfHealError(detail)) {
            addMessage({
              role: 'assistant',
              content:
                '**Session unauthorized** — your sign-in may have expired or is no longer valid.\n\n' +
                '**Sign out and sign back in** to restore access. This is an authentication issue, not an application bug — I will not attempt a code fix.',
            });
            return;
          }

          const route = detail.route || String(pageContext.route || window.location.pathname);
          const functionName = detail.functionName;
          const requesterRole = role === 'platform_owner' ? 'super_admin' : role;
          const requesterName = app?.user.name || 'Staff';
          const requesterUserId = app?.user.id;
          const orgId = getActiveOrgId() || undefined;

          const { job, dedupe, message } = await offerCodeFix({
            errorCode: detail.errorCode,
            description: detail.description,
            route,
            requesterRole,
            requesterName,
            requesterUserId,
            orgId,
          });

          setIsOpen(true);

          if (dedupe && job.status !== 'offered') {
            addMessage({
              role: 'assistant',
              content:
                message ||
                `I'm already working on **${job.errorCode || 'this error'}** (status: ${job.status}). I'll keep you updated here.`,
              fixJobId: job.id,
            });
            if (['queued', 'running', 'pr_open'].includes(job.status)) {
              trackFixJob(job.id);
            }
            return;
          }

          let cursorNote = '';
          try {
            const status = await listCodeFixJobs();
            if (status.health && !status.health.live) {
              cursorNote = `\n\n⚠️ Self-heal is **not LIVE**: ${status.health.reason}`;
            } else if (!status.cursorConfigured) {
              cursorNote =
                '\n\n⚠️ **CURSOR_API_KEY** is not configured yet — jobs are logged in **AI Audit → Code fixes**, but Cursor cannot open a PR until the key is added.';
            }
          } catch {
            // ignore
          }

          const shouldAutoStart = studio.selfHealAutoStart !== false && job.scope === 'surgical';

          if (shouldAutoStart) {
            const result = await enqueueCodeFix({
              jobId: job.id,
              errorCode: job.errorCode,
              description: job.description,
              route: job.route,
              requesterRole,
              requesterName,
              requesterUserId,
              orgId,
            });
            trackFixJob(result.job.id);
            const schemaIntro = detail.schemaError || functionName
              ? `OpenAI rejected the tool schema for **\`${functionName || 'unknown'}\`**. `
              : '';
            addMessage({
              role: 'assistant',
              content:
                `${schemaIntro}**Auto-fixing** \`${result.job.errorCode || 'error'}\` on **${result.job.route || 'this page'}**.\n\n` +
                `${result.job.description}\n\n` +
                (result.message || 'Logged — in the fix queue.') +
                '\n\nI\'ll update you when the Cursor agent finishes. Use **Open Code fixes** below to track progress — an **Approve & merge** button will appear here only after a real GitHub PR URL is ready.' +
                cursorNote,
              fixJobId: result.job.id,
              statusAction: {
                label: 'Open Code fixes',
                href: '/ai-audit?tab=code_fixes',
              },
            });
            return;
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
                ? 'This may need a wider change — if you say **Yes**, I\'ll prepare it for **your approval in Cursor** before any redesign.\n\n'
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
            content: `I noticed an error but couldn't open a fix offer: ${
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
  }, [app?.user, pageContext.route, setIsOpen, addMessage, studio.selfHealAutoStart, trackFixJob]);

  return null;
}
