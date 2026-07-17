/**
 * Honest "works with" logo strip — text/SVG marks only (no unofficial trademark downloads).
 */

export type IntegrationMark = {
  id: string;
  name: string;
  /** Live | Integration ready | Via hub | Built in */
  status: 'live' | 'ready' | 'via_hub' | 'built_in';
  statusLabel: string;
  blurb?: string;
};

export const INTEGRATION_MARKS: IntegrationMark[] = [
  { id: 'stripe', name: 'Stripe', status: 'live', statusLabel: 'Live today', blurb: 'Card payments where configured for your org.' },
  { id: 'whatsapp', name: 'WhatsApp', status: 'live', statusLabel: 'Live today', blurb: 'Staff messaging when WhatsApp is connected.' },
  { id: 'deliverect', name: 'Deliverect', status: 'ready', statusLabel: 'Integration ready', blurb: 'Connector-ready hub for marketplace orders.' },
  { id: 'otter', name: 'Otter', status: 'ready', statusLabel: 'Integration ready', blurb: 'Connector-ready hub for marketplace orders.' },
  { id: 'deliveroo', name: 'Deliveroo', status: 'via_hub', statusLabel: 'Via your delivery hub', blurb: 'Orders arrive via Deliverect/Otter — not a direct partnership claim.' },
  { id: 'justeat', name: 'Just Eat', status: 'via_hub', statusLabel: 'Via your delivery hub', blurb: 'Orders arrive via Deliverect/Otter — not a direct partnership claim.' },
  { id: 'ubereats', name: 'Uber Eats', status: 'via_hub', statusLabel: 'Via your delivery hub', blurb: 'Orders arrive via Deliverect/Otter — not a direct partnership claim.' },
  { id: 'voice', name: 'AI phone', status: 'built_in', statusLabel: 'Built in', blurb: 'Lizzie voice ordering and table booking on your number.' },
];

/** Alias for public integrations page */
export const SYNC2DINE_INTEGRATION_MARKS = INTEGRATION_MARKS;

function MarkGlyph({ id }: { id: string }) {
  const letter = id.slice(0, 2).toUpperCase();
  const colors: Record<string, string> = {
    stripe: '#635BFF',
    whatsapp: '#25D366',
    deliverect: '#00A3A1',
    otter: '#FF6B35',
    deliveroo: '#00CCBC',
    justeat: '#FF8000',
    ubereats: '#06C167',
    voice: '#0f3d3e',
  };
  const fill = colors[id] ?? '#0f3d3e';
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10 grayscale" aria-hidden>
      <rect width="48" height="48" rx="10" fill={fill} opacity="0.85" />
      <text x="24" y="30" textAnchor="middle" fill="white" fontSize="14" fontWeight="700" fontFamily="system-ui,sans-serif">
        {letter}
      </text>
    </svg>
  );
}

const STATUS_CLASS: Record<IntegrationMark['status'], string> = {
  live: 'bg-emerald-100 text-emerald-900',
  ready: 'bg-sky-100 text-sky-900',
  via_hub: 'bg-slate-200 text-slate-800',
  built_in: 'bg-s2d-gold/40 text-s2d-teal-deep',
};

type Props = {
  compact?: boolean;
  showIntro?: boolean;
  showLink?: boolean;
  className?: string;
};

export default function IntegrationsLogoStrip({
  compact = false,
  showIntro = true,
  showLink = true,
  className = '',
}: Props) {
  const marks = compact
    ? INTEGRATION_MARKS.filter((m) => m.status === 'live' || m.status === 'ready' || m.status === 'built_in' || m.status === 'via_hub').slice(0, 7)
    : INTEGRATION_MARKS;

  return (
    <section className={`${className}`} data-testid="integrations-logo-strip" aria-label="Works with">
      {showIntro && (
        <div className={compact ? 'mb-3' : 'mb-5'}>
          <h2 className={`font-extrabold text-s2d-teal-deep ${compact ? 'text-base' : 'text-2xl'}`}>
            Works with the tools you already use
          </h2>
          <p className={`mt-1 text-slate-600 ${compact ? 'text-xs' : 'text-sm'}`}>
            One board for phone, kiosk and delivery orders — Sync2Dine plugs into the delivery hub your restaurant already uses.
            We do not claim certified partnerships with marketplace brands.
          </p>
          {showLink ? (
            <a href="/integrations" className="mt-2 inline-block text-sm font-bold text-s2d-teal-deep underline">
              Full integrations list
            </a>
          ) : null}
        </div>
      )}
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {marks.map((mark) => (
          <li key={mark.id} className="flex flex-col items-center gap-1.5 text-center">
            <MarkGlyph id={mark.id} />
            <span className="text-xs font-bold text-s2d-teal-deep">{mark.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold leading-tight ${STATUS_CLASS[mark.status]}`}>
              {mark.statusLabel}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
