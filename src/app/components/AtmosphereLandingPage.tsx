import { Link } from 'react-router';
import { ArrowRight, Music2 } from 'lucide-react';
import PublicMarketingLayout from './PublicMarketingLayout';
import { Button } from './ui/button';
import { getPackage } from '../engine/saas/saasPackages';

export default function AtmosphereLandingPage() {
  const pkg = getPackage('atmosphere');

  return (
    <PublicMarketingLayout>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-s2d-teal">Atmosphere</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-s2d-teal-deep sm:text-4xl">
          Make the venue work harder
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Atmosphere manages sustainable venue audio, promotional messaging, and staff training (Sync2Gear) — so the
          dining room feels intentional, not accidental.
        </p>
        <ul className="mt-8 space-y-3 text-sm text-slate-700">
          <li className="flex gap-3">
            <Music2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" aria-hidden />
            <span>Zone-based audio and messaging for lunch, dinner, and events</span>
          </li>
          <li className="flex gap-3">
            <Music2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" aria-hidden />
            <span>
              Launch from £{pkg.launchWeeklyGbp}/week — normally £{pkg.standardWeeklyGbp}/week
            </span>
          </li>
        </ul>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="min-h-11 bg-teal-700 hover:bg-teal-800">
            <Link to="/start?package=atmosphere">
              Start with Atmosphere
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link to="/#ask">Ask Sync2Dine</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link to="/pricing">Compare all packages</Link>
          </Button>
        </div>
      </div>
    </PublicMarketingLayout>
  );
}
