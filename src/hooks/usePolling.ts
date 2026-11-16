import { useEffect, useRef, useState, useCallback } from 'react';

export interface UsePollingOptions<T> {
  intervalMs?: number;
  enabled?: boolean;
  isTerminal?: (data: T) => boolean;
  onData?: (data: T) => void;
  onError?: (error: Error) => void;
}

export function usePolling<T>(
  pollFn: () => Promise<T>,
  {
    intervalMs = 1000,
    enabled = true,
    isTerminal = (data: any) => {
      const status = data?.status;
      return status === 'needs_review' || status === 'evaluated' || status === 'failed';
    },
    onData,
    onError,
  }: UsePollingOptions<T> = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [isPolling, setIsPolling] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  const isMountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const restart = useCallback(() => {
    setError(null);
    setIsPolling(true);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    setIsPolling(enabled);

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled]);

  useEffect(() => {
    if (!isPolling) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    let isCancelled = false;

    const executePoll = async () => {
      if (inFlightRef.current || isCancelled || !isMountedRef.current) return;
      inFlightRef.current = true;

      try {
        const result = await pollFn();
        if (!isMountedRef.current || isCancelled) return;

        setData(result);
        setError(null);
        onData?.(result);

        if (isTerminal?.(result)) {
          setIsPolling(false);
          return;
        }
      } catch (err) {
        if (!isMountedRef.current || isCancelled) return;
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        onError?.(e);
      } finally {
        inFlightRef.current = false;
        if (isMountedRef.current && !isCancelled && isPolling) {
          timerRef.current = window.setTimeout(executePoll, intervalMs);
        }
      }
    };

    // Trigger initial poll immediately
    executePoll();

    return () => {
      isCancelled = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPolling, pollFn, intervalMs, isTerminal, onData, onError]);

  return {
    data,
    isPolling,
    error,
    stop,
    restart,
  };
}
