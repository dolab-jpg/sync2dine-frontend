import { Link } from 'react-router';
import type { ReactNode } from 'react';
import { Phone } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { SYNC2DINE_CONTACT } from '../engine/messaging/saasQuoteContent';

const LEGAL_LINKS = [
  { to: '/legal/terms', label: 'Terms' },
  { to: '/legal/fair-use-and-fares', label: 'Fair use & fares' },
  { to: '/legal/privacy', label: 'Privacy' },
  { to: '/legal/acceptable-use', label: 'Acceptable use' },
  { to: '/legal/cookies', label: 'Cookies' },
  { to: '/legal/cancellation-refunds', label: 'Cancellation & refunds' },
] as const;

const TEL_HREF = 'tel:+442037453233';

interface PublicMarketingLayoutProps {
  children: ReactNode;
  /** Hide footer on focused checkout steps if needed */
  showFooter?: boolean;
}

export default function PublicMarketingLayout({ children, showFooter = true }: PublicMarketingLayoutProps) {
  return (
    <div className="min-h-dvh bg-s2d-cream" data-testid="public-marketing-layout">
      <header className="border-b border-s2d-teal/10 bg-s2d-teal-deep px-4 py-4 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link to="/" className="min-h-11 flex items-center rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60">
            <BrandLogo size="md" showWordmark className="text-white" />
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-1 sm:gap-3">
            <Link
              to="/pricing"
              className="min-h-11 rounded-xl px-2 py-2 text-sm font-semibold hover:bg-white/10 sm:px-4"
            >
              Pricing
            </Link>
            <a
              href={TEL_HREF}
              className="min-h-11 inline-flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-semibold hover:bg-white/10 sm:px-4"
              title="Call Sync2Dine 24/7"
            >
              <Phone className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">{SYNC2DINE_CONTACT.phone}</span>
              <span className="sm:hidden">Call</span>
              <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">24/7</span>
            </a>
            <Link
              to="/login"
              className="min-h-11 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20 sm:px-4"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      {showFooter ? (
        <footer className="border-t border-s2d-teal/10 bg-white/60 px-4 py-8">
          <div className="mx-auto flex max-w-5xl flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <BrandLogo size="sm" showWordmark />
              <p className="mt-2 max-w-sm text-sm text-slate-600">
                Voice-first ordering and venue growth for UK restaurants. Judie answers the phone; Atmosphere runs the floor.
              </p>
              <a
                href={TEL_HREF}
                className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-s2d-teal-deep underline-offset-2 hover:underline"
              >
                <Phone className="h-4 w-4" aria-hidden />
                {SYNC2DINE_CONTACT.phone} · 24/7
              </a>
              <p className="mt-1 text-xs text-slate-500">{SYNC2DINE_CONTACT.email}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-s2d-teal">Legal</p>
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {LEGAL_LINKS.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="text-sm text-slate-600 underline-offset-2 hover:text-s2d-teal-deep hover:underline">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mx-auto mt-6 max-w-5xl text-xs text-slate-500">
            © {new Date().getFullYear()} Sync2Dine. Prices shown are launch offers unless stated otherwise.
          </p>
        </footer>
      ) : null}
    </div>
  );
}

export { LEGAL_LINKS };
