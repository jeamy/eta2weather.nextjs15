import { useState, useCallback, useRef, useEffect } from 'react';
import { ParsedXmlData } from '@/reader/functions/types-constants/EtaConstants';
import { batchFetchEtaData, EtaDataState, EtaFetchHookResult } from '@/utils/etaUtils';

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

  const fetchValues = useCallback(async (uris: string[]) => {
    if (!uris.length) return;

    // Cleanup any existing fetch
    cleanupAbortController();

    // Create new AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Set loading state for all URIs
    setLoading(prev => {
      const newLoading = { ...prev };
      uris.forEach(uri => {
        newLoading[uri] = true;
      });
      return newLoading;
    });

    // Clear errors for all URIs
    setError(prev => {
      const newError = { ...prev };
      uris.forEach(uri => {
        delete newError[uri];
      });
      return newError;
    });

    try {
      const result = await batchFetchEtaData(uris, abortController.signal);
      
      if (!abortController.signal.aborted) {
        // console.log('Fetched values:', result);
        setValues(prev => ({ ...prev, ...result }));
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        const errorMessage = error instanceof Error ? error.message : 'An error occurred';
        setError(prev => {
          const newError = { ...prev };
          uris.forEach(uri => {
            newError[uri] = errorMessage;
          });
          return newError;
        });
      }
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(prev => {
          const newLoading = { ...prev };
          uris.forEach(uri => {
            newLoading[uri] = false;
          });
          return newLoading;
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
