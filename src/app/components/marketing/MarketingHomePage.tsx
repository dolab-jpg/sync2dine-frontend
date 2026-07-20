import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import PublicMarketingLayout from '../PublicMarketingLayout';
import AskSync2DineHero from './AskSync2DineHero';
import { Button } from '../ui/button';

/** Public marketing homepage — Ask Sync2Dine hero first, then light product CTAs. */
export default function MarketingHomePage() {
  return (
    <PublicMarketingLayout>
      <AskSync2DineHero />

      <section className="border-t border-s2d-teal/10 bg-white/50 px-4 py-14">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-black tracking-tight text-s2d-teal-deep sm:text-3xl">
            Judie answers. Atmosphere runs the floor.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">
            See packages and weekly fares, or jump straight into setup when you are ready.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild className="min-h-11 bg-teal-700 hover:bg-teal-800">
              <Link to="/pricing">
                View pricing
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/judie">Meet Judie</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/atmosphere">Meet Atmosphere</Link>
            </Button>
          </div>
        </div>
      </section>
    </PublicMarketingLayout>
  );
}
