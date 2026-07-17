import { Link } from 'react-router';
import IntegrationsLogoStrip, { INTEGRATION_MARKS } from './IntegrationsLogoStrip';
import { BrandLogo } from '../BrandLogo';

/** Public integrations explainer — truthful status, no partnership claims. */
export default function IntegrationsPublicPage() {
  return (
    <div className="min-h-dvh bg-s2d-cream" data-testid="integrations-public-page">
      <header className="border-b border-s2d-teal/10 bg-s2d-teal-deep px-4 py-4 text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <BrandLogo size="md" showWordmark />
          <Link to="/login" className="min-h-11 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-s2d-teal">Integrations</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-s2d-teal-deep sm:text-4xl">
            Works with the tools kitchens already use
          </h1>
          <p className="mt-3 max-w-2xl text-base text-s2d-teal-deep/80">
            Sync2Dine is voice-first ordering for phone and kiosk. Marketplace channels connect through delivery hubs —
            we do not claim certified partnerships with Deliveroo, Just Eat, or Uber Eats.
          </p>
        </div>

        <IntegrationsLogoStrip showLink={false} />

        <ul className="space-y-4">
          {INTEGRATION_MARKS.map((mark) => (
            <li key={mark.id} className="rounded-2xl border border-s2d-teal/15 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-extrabold text-s2d-teal-deep">{mark.name}</h2>
              <p className="text-sm font-bold text-slate-700">{mark.statusLabel}</p>
              {mark.blurb ? <p className="mt-1 text-sm text-slate-600">{mark.blurb}</p> : null}
            </li>
          ))}
        </ul>

        <p className="text-sm text-slate-600">
          Restaurant staff configure receive/send directions under Settings → Connected systems after sign-in.
        </p>
      </main>
    </div>
  );
}
