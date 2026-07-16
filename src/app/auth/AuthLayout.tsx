import type { ReactNode } from 'react';
import { BrandLogo } from '../components/BrandLogo';

interface AuthLayoutProps {
  children: ReactNode;
  /** Narrow card column (default) vs wider layout for demo role grid */
  wide?: boolean;
}

export function AuthLayout({ children, wide = false }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 sm:p-6">
      <div className={`w-full ${wide ? 'max-w-6xl' : 'max-w-md'}`}>
        <div className="text-center mb-6 sm:mb-8">
          <BrandLogo size="lg" showWordmark className="justify-center mb-3" />
          <p className="text-amber-100">AI Phone & Ordering Platform</p>
        </div>
        {children}
      </div>
    </div>
  );
}
