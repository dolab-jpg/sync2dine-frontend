import { cn } from './utils';

interface AddressMapLinkProps {
  address?: string | null;
  className?: string;
}

export function AddressMapLink({ address, className }: AddressMapLinkProps) {
  const trimmed = address?.trim();

  if (!trimmed) {
    return <span className={className}>—</span>;
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn('hover:text-blue-600 hover:underline', className)}
      title="Open in Google Maps"
    >
      {trimmed}
    </a>
  );
}
