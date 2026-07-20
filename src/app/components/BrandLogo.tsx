import { cn } from './ui/utils';

type BrandLogoSize = 'sm' | 'md' | 'lg';

interface BrandLogoProps {
  size?: BrandLogoSize;
  showWordmark?: boolean;
  className?: string;
  subtitle?: string;
  /** Prefer dark gold wordmark on teal headers */
  variant?: 'light' | 'dark';
}

const iconDimensions: Record<BrandLogoSize, { width: number; height: number }> = {
  sm: { width: 28, height: 28 },
  md: { width: 36, height: 36 },
  lg: { width: 52, height: 52 },
};

const wordmarkClasses: Record<BrandLogoSize, string> = {
  sm: 'text-sm',
  md: 'text-sm',
  lg: 'text-2xl sm:text-3xl',
};

const ICON_SRC = '/brand/brand-icon.svg';

export function BrandLogo({
  size = 'md',
  showWordmark = true,
  className,
  subtitle,
  variant = 'dark',
}: BrandLogoProps) {
  const { width, height } = iconDimensions[size];
  const wordmarkTone =
    variant === 'light'
      ? 'text-[#0f3d3e]'
      : 'bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent';

  return (
    <div className={cn('flex items-center gap-2.5 min-w-0', className)}>
      <img
        src={ICON_SRC}
        alt=""
        width={width}
        height={height}
        className="flex-shrink-0"
        aria-hidden="true"
        decoding="async"
      />
      {(showWordmark || subtitle) && (
        <div className="min-w-0">
          {showWordmark && (
            <p className={cn('font-bold truncate', wordmarkTone, wordmarkClasses[size])}>
              Sync2Dine
            </p>
          )}
          {subtitle && (
            <p
              className={cn(
                'text-[10px] truncate',
                variant === 'light' ? 'text-[#0f3d3e]/70' : 'text-amber-300/80',
              )}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
