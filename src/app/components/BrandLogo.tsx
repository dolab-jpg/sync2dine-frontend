import { cn } from './ui/utils';

type BrandLogoSize = 'sm' | 'md' | 'lg';

interface BrandLogoProps {
  size?: BrandLogoSize;
  showWordmark?: boolean;
  className?: string;
  subtitle?: string;
}

const iconDimensions: Record<BrandLogoSize, { width: number; height: number }> = {
  sm: { width: 28, height: 20 },
  md: { width: 36, height: 25 },
  lg: { width: 52, height: 36 },
};

const wordmarkClasses: Record<BrandLogoSize, string> = {
  sm: 'text-sm',
  md: 'text-sm',
  lg: 'text-2xl sm:text-3xl',
};

function TwinEyeIcon({ width, height }: { width: number; height: number }) {
  return (
    <svg
      viewBox="0 0 52 36"
      width={width}
      height={height}
      className="flex-shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="13" cy="18" r="11" fill="#4a044e" stroke="#f5d0a8" strokeWidth="1.5" />
      <circle cx="13" cy="18" r="6" fill="#f59e0b" />
      <circle cx="13" cy="18" r="3" fill="#0a0a0a" />
      <circle cx="39" cy="18" r="11" fill="#4a044e" stroke="#f5d0a8" strokeWidth="1.5" />
      <circle cx="39" cy="18" r="6" fill="#f59e0b" />
      <circle cx="39" cy="18" r="3" fill="#0a0a0a" />
      <circle cx="11" cy="15" r="1.2" fill="#ffffff" opacity="0.6" />
      <circle cx="37" cy="15" r="1.2" fill="#ffffff" opacity="0.6" />
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
      <TwinEyeIcon width={width} height={height} />
      {(showWordmark || subtitle) && (
        <div className="min-w-0">
          {showWordmark && (
            <p
              className={cn(
                'font-bold truncate bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent',
                wordmarkClasses[size],
              )}
            >
              Builder Diddies
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
