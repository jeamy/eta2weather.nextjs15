import { useState, useCallback, useRef, useEffect } from 'react';
import { ParsedXmlData } from '@/reader/functions/types-constants/EtaConstants';
import { batchFetchEtaDataInChunks, EtaDataState, EtaFetchHookResult, EtaFetchOptions } from '@/utils/etaUtils';

export const useEtaData = (): EtaFetchHookResult => {
  const [values, setValues] = useState<Record<string, ParsedXmlData>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<Record<string, string>>({});
  const abortControllerRef = useRef<AbortController | null>(null);

  const cleanupAbortController = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const cleanupAllAbortControllers = useCallback(() => {
    cleanupAbortController();
  }, [cleanupAbortController]);

  useEffect(() => {
    return () => {
      cleanupAllAbortControllers();
    };
  }, [cleanupAllAbortControllers]);

  const fetchValues = useCallback(async (uris: string[], options?: EtaFetchOptions) => {
    if (!uris.length) return;

    // Cleanup any existing fetch
    cleanupAbortController();

    // Create new AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Set loading true and clear previous errors for these URIs in a single pass
    setLoading(prev => {
      const next = { ...prev };
      uris.forEach(uri => { next[uri] = true; });
      return next;
    });
    setError(prev => {
      const next = { ...prev };
      uris.forEach(uri => { delete next[uri]; });
      return next;
    });

    try {
      const result = await batchFetchEtaDataInChunks(uris, {
        chunkSize: options?.chunkSize ?? 100,
        concurrency: options?.concurrency ?? 3,
      }, abortController.signal);

      if (!abortController.signal.aborted) {
        setValues(prev => ({ ...prev, ...result }));
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        const errorMessage = error instanceof Error ? error.message : 'An error occurred';
        setError(prev => {
          const next = { ...prev };
          uris.forEach(uri => { next[uri] = errorMessage; });
          return next;
        });
      }
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(prev => {
          const next = { ...prev };
          uris.forEach(uri => { next[uri] = false; });
          return next;
        });
      }
      cleanupAbortController();
    }
  }, [cleanupAbortController]);

  return {
    values,
    loading,
    error,
    fetchValues,
    cleanupAllAbortControllers,
  };
};
