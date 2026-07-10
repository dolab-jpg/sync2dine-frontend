/** Subtle edge affordance — hints swipe / double-tap without a solid button */
export function GestureEdgeHint({ side = 'right' }: { side?: 'left' | 'right' }) {
  return (
    <div
      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-30 ${
        side === 'right' ? 'right-1' : 'left-1'
      }`}
      aria-hidden
    >
      <span className="w-1 h-1 rounded-full bg-amber-300/80" />
      <span className="w-1 h-1 rounded-full bg-amber-300/60" />
      <span className="w-1 h-1 rounded-full bg-amber-300/40" />
    </div>
  );
}
