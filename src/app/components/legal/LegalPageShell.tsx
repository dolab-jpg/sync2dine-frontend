import { Link } from 'react-router';
import type { ReactNode } from 'react';
import PublicMarketingLayout from '../PublicMarketingLayout';
import { FARE_SCHEDULE_VERSION } from '../../engine/saas/saasPackages';

interface LegalPageShellProps {
  title: string;
  children: ReactNode;
  updated?: string;
}

export default function LegalPageShell({ title, children, updated = '19 July 2026' }: LegalPageShellProps) {
  return (
    <PublicMarketingLayout>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-wider text-s2d-teal">
          Legal · fare schedule {FARE_SCHEDULE_VERSION}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-s2d-teal-deep sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">Last updated {updated}. Version {FARE_SCHEDULE_VERSION}.</p>
        <div className="prose prose-slate mt-8 max-w-none text-sm leading-relaxed text-slate-700 [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-slate-900 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
        <p className="mt-10 text-sm">
          <Link to="/pricing" className="font-semibold text-s2d-teal-deep underline-offset-2 hover:underline">
            ← Back to pricing
          </Link>
        </p>
      </div>
    </PublicMarketingLayout>
  );
}
