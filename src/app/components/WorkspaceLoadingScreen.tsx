import { BrandLogo } from './BrandLogo';

export function WorkspaceLoadingScreen({ onSignOut }: { onSignOut?: () => void }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-s2d-cream px-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <BrandLogo size="lg" variant="light" />
        <div
          className="h-10 w-10 rounded-full border-2 border-s2d-gold/30 border-t-s2d-gold animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        <p className="text-lg font-semibold text-s2d-teal">Loading your workspace…</p>
        {onSignOut ? (
          <button
            type="button"
            className="text-sm font-medium text-amber-800 underline underline-offset-2 hover:text-amber-950"
            onClick={onSignOut}
          >
            Sign out
          </button>
        ) : null}
      </div>
    </div>
  );
}
