import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

type GestureMode = 'rail-expand' | 'panel-dismiss';

interface UseGestureToggleOptions {
  defaultOpen?: boolean;
  storageKey?: string;
  swipeThreshold?: number;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('a, button, input, textarea, select, [role="button"]');
}

function readStored(key: string | undefined, fallback: boolean): boolean {
  if (!key) return fallback;
  try {
    const v = localStorage.getItem(key);
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
  } catch {
    // ignore
  }
  return fallback;
}

export function useGestureToggle({
  defaultOpen = false,
  storageKey,
  swipeThreshold = 48,
}: UseGestureToggleOptions = {}) {
  const [isOpen, setIsOpen] = useState(() => readStored(storageKey, defaultOpen));
  const pointer = useRef({ x: 0, y: 0, t: 0 });
  const lastTap = useRef(0);

  useEffect(() => {
    if (storageKey) localStorage.setItem(storageKey, String(isOpen));
  }, [isOpen, storageKey]);

  const toggle = useCallback(() => setIsOpen(v => !v), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    pointer.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  }, []);

  const makePointerUp = useCallback(
    (mode: GestureMode) => (e: ReactPointerEvent) => {
      if (isInteractiveTarget(e.target)) return;

      const { x, y, t } = pointer.current;
      const dx = e.clientX - x;
      const dy = e.clientY - y;
      const dt = Date.now() - t;

      if (dt < 450 && Math.abs(dx) > swipeThreshold && Math.abs(dx) > Math.abs(dy) * 1.2) {
        if (mode === 'rail-expand') {
          if (dx > 0) open();
          else close();
        } else {
          if (dx > 0) close();
          else open();
        }
        lastTap.current = 0;
        return;
      }

      if (mode === 'panel-dismiss' && dt < 450 && dy > swipeThreshold && Math.abs(dy) > Math.abs(dx)) {
        close();
        lastTap.current = 0;
        return;
      }

      if (dt < 320 && Math.abs(dx) < 14 && Math.abs(dy) < 14) {
        const now = Date.now();
        if (now - lastTap.current < 380) {
          toggle();
          lastTap.current = 0;
        } else {
          lastTap.current = now;
        }
      }
    },
    [close, open, swipeThreshold, toggle]
  );

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isInteractiveTarget(e.target)) return;
      e.preventDefault();
      toggle();
    },
    [toggle]
  );

  return {
    isOpen,
    setIsOpen,
    toggle,
    open,
    close,
    onPointerDown,
    onDoubleClick,
    railGestureProps: {
      onPointerDown,
      onPointerUp: makePointerUp('rail-expand'),
      onDoubleClick,
    },
    panelGestureProps: {
      onPointerDown,
      onPointerUp: makePointerUp('panel-dismiss'),
      onDoubleClick,
    },
  };
}

/** Double-tap, swipe sideways, or swipe down to dismiss a floating panel */
export function useDismissGesture(onDismiss: () => void, swipeThreshold = 48) {
  const pointer = useRef({ x: 0, y: 0, t: 0 });
  const lastTap = useRef(0);

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    pointer.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  }, []);

  const onPointerUp = useCallback(
    (e: ReactPointerEvent) => {
      if (isInteractiveTarget(e.target)) return;

      const { x, y, t } = pointer.current;
      const dx = e.clientX - x;
      const dy = e.clientY - y;
      const dt = Date.now() - t;

      if (dt < 450 && Math.abs(dx) > swipeThreshold && Math.abs(dx) > Math.abs(dy) * 1.2) {
        onDismiss();
        lastTap.current = 0;
        return;
      }

      if (dt < 450 && dy > swipeThreshold && Math.abs(dy) > Math.abs(dx)) {
        onDismiss();
        lastTap.current = 0;
        return;
      }

      if (dt < 320 && Math.abs(dx) < 14 && Math.abs(dy) < 14) {
        const now = Date.now();
        if (now - lastTap.current < 380) {
          onDismiss();
          lastTap.current = 0;
        } else {
          lastTap.current = now;
        }
      }
    },
    [onDismiss, swipeThreshold]
  );

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isInteractiveTarget(e.target)) return;
      e.preventDefault();
      onDismiss();
    },
    [onDismiss]
  );

  return { onPointerDown, onPointerUp, onDoubleClick };
}
