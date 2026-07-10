import { useState, useCallback } from 'react';

/**
 * Custom hook to prevent double-tap/double-click on buttons and actions
 * @param delay - Delay in milliseconds before allowing next action (default: 300ms)
 * @returns Object containing isLoading state and withLoading wrapper function
 */
export function usePreventDoubleTap(delay: number = 300) {
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Wraps an async or sync function to prevent double execution
   * @param fn - Function to execute
   * @returns Promise that resolves when function completes
   */
  const withLoading = useCallback(
    async <T,>(fn: () => T | Promise<T>): Promise<T | undefined> => {
      if (isLoading) {
        return undefined;
      }

      setIsLoading(true);

      try {
        const result = await Promise.resolve(fn());

        // Add minimum delay to prevent rapid re-clicks
        await new Promise(resolve => setTimeout(resolve, delay));

        return result;
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, delay]
  );

  return { isLoading, withLoading };
}
