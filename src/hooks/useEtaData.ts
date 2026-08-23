import { useState, useCallback, useRef, useEffect } from 'react';
import { ParsedXmlData } from '@/reader/functions/types-constants/EtaConstants';
import { batchFetchEtaDataInChunks, EtaFetchHookResult, EtaFetchOptions } from '@/utils/etaUtils';

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
    if (!uris.length) return true;

    // Cleanup any existing fetch
    cleanupAbortController();

    // Create new AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // A hook instance owns one active request. Replacing the loading map keeps
    // an aborted, superseded request from leaving unrelated stale flags behind.
    setLoading(Object.fromEntries(uris.map(uri => [uri, true])));
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
        return true;
      }
      return false;
    } catch (error) {
      if (!abortController.signal.aborted) {
        const errorMessage = error instanceof Error ? error.message : 'An error occurred';
        setError(prev => {
          const next = { ...prev };
          uris.forEach(uri => { next[uri] = errorMessage; });
          return next;
        });
      }
      return false;
    } finally {
      if (abortControllerRef.current === abortController) {
        setLoading(prev => {
          const next = { ...prev };
          uris.forEach(uri => { next[uri] = false; });
          return next;
        });
        abortControllerRef.current = null;
      }
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
