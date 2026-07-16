import { cn } from './ui/utils';

type BrandLogoSize = 'sm' | 'md' | 'lg';

interface BrandLogoProps {
  size?: BrandLogoSize;
  showWordmark?: boolean;
  className?: string;
  subtitle?: string;
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

function Sync2DineMark({ width, height }: { width: number; height: number }) {
  return (
    <svg
      viewBox="0 0 52 52"
      width={width}
      height={height}
      className="flex-shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="44" height="44" rx="14" fill="#0f3d3e" />
      <path
        d="M14 29c6.5-8.5 17.5-8.5 24 0"
        stroke="#e8c26a"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M17 22c4.8-4.8 13.2-4.8 18 0"
        stroke="#fff7df"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.95"
      />
      <circle cx="26" cy="31" r="3.6" fill="#e8c26a" />
    </svg>
  );
}

export function BrandLogo({
  size = 'md',
  showWordmark = true,
  className,
  subtitle,
}: BrandLogoProps) {
  const { width, height } = iconDimensions[size];

  return (
    <div className={cn('flex items-center gap-2.5 min-w-0', className)}>
      <Sync2DineMark width={width} height={height} />
      {(showWordmark || subtitle) && (
        <div className="min-w-0">
          {showWordmark && (
            <p
              className={cn(
                'font-bold truncate bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent',
                wordmarkClasses[size],
              )}
            >
              Sync2Dine
            </p>
          )}
          {subtitle && (
            <p className="text-[10px] text-amber-300/80 truncate">{subtitle}</p>
          )}
        </div>
      )}
    </div>
  );
}
