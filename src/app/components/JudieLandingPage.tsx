import { Link } from 'react-router';
import { ArrowRight, Phone } from 'lucide-react';
import PublicMarketingLayout from './PublicMarketingLayout';
import { Button } from './ui/button';
import { getPackage } from '../engine/saas/saasPackages';

export default function JudieLandingPage() {
  const pkg = getPackage('judie_starter');

  return (
    <PublicMarketingLayout>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-s2d-teal">Judie</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-s2d-teal-deep sm:text-4xl">
          Answer every call — orders and bookings into the app
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Judie is your AI receptionist for UK restaurants. She takes orders, books tables, answers FAQs, and transfers
          to staff when needed — so your team stays on the floor.
        </p>
        <ul className="mt-8 space-y-3 text-sm text-slate-700">
          <li className="flex gap-3">
            <Phone className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" aria-hidden />
            <span>
              <strong>{pkg.weeklyAiMinutes} AI minutes/week</strong> included on Starter · overage £
              {pkg.aiOverageGbpPerMinute.toFixed(2)}/min
            </span>
          </li>
          <li className="flex gap-3">
            <Phone className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" aria-hidden />
            <span>Launch from £{pkg.launchWeeklyGbp}/week — normally £{pkg.standardWeeklyGbp}/week</span>
          </li>
        </ul>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="min-h-11 bg-teal-700 hover:bg-teal-800">
            <Link to="/start?package=judie_starter">
              Start with Judie Starter
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
