import { ParsedXmlData } from '@/reader/functions/types-constants/EtaConstants';
import { MenuNode } from '@/types/menu';
import { API } from '@/constants/apiPaths';

export interface EtaDataState {
  values: Record<string, ParsedXmlData>;
  loading: Record<string, boolean>;
  error: Record<string, string>;
}

export type EtaFetchOptions = { chunkSize?: number; concurrency?: number };

export interface EtaFetchHookResult extends EtaDataState {
  fetchValues: (uris: string[], options?: EtaFetchOptions) => Promise<void>;
  cleanupAllAbortControllers: () => void;
}

/**
 * Checks if a URI is a valid endpoint URI for ETA API requests.
 * Valid URIs have at least 5 parts (e.g., /120/10101/0/0/12111).
 * Category URIs (e.g., /120/10101) are not valid for direct data retrieval.
 */
export const isValidEndpointUri = (uri: string): boolean => {
  const parts = uri.split('/').filter(Boolean);
  return parts.length >= 5; // Endpoint URIs have at least 5 parts
};

export const getAllUris = (nodes: MenuNode[]): string[] => {
  const uris = new Set<string>();

  const addNodeUris = (node: MenuNode) => {
    if (node.uri) {
      // Only add URIs that are endpoints (have at least 5 parts or are leaf nodes)
      if (isValidEndpointUri(node.uri) || !node.children || node.children.length === 0) {
        uris.add(node.uri);
      }
    }
    node.children?.forEach(addNodeUris);
  };

  nodes.forEach(addNodeUris);
  return Array.from(uris);
};

export const getUrisForNode = (node: MenuNode | undefined): string[] => {
  if (!node) return [];
  const uris = new Set<string>();
  const walk = (n: MenuNode) => {
    if (n.uri) uris.add(n.uri);
    n.children?.forEach(walk);
  };
  walk(node);
  return Array.from(uris);
};

export const batchFetchEtaData = async (
  uris: string[],
  abortSignal?: AbortSignal
): Promise<Record<string, ParsedXmlData>> => {
  try {
    // Create a batch request payload
    const response = await fetch(API.ETA_READ_BATCH_MENU_DATA, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris }),
      signal: abortSignal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch data');
    }

    return result.data || {};
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {};
    }
    throw error;
  }
};

export const batchFetchEtaDataInChunks = async (
  uris: string[],
  options: { chunkSize?: number; concurrency?: number } = {},
  abortSignal?: AbortSignal
): Promise<Record<string, ParsedXmlData>> => {
  const { chunkSize = 100, concurrency = 3 } = options;
  if (!uris.length) return {};

  // Build chunks
  const chunks: string[][] = [];
  for (let i = 0; i < uris.length; i += chunkSize) {
    chunks.push(uris.slice(i, i + chunkSize));
  }

  const results: Record<string, ParsedXmlData> = {};
  let index = 0;

  const worker = async () => {
    while (index < chunks.length) {
      const myIndex = index++;
      const chunk = chunks[myIndex];
      if (!chunk) break;
      try {
        const data = await batchFetchEtaData(chunk, abortSignal);
        // Merge
        Object.assign(results, data);
      } catch (err) {
        // Continue on error of a single chunk unless aborted
        if (abortSignal && (abortSignal as any).aborted) break;
        // Swallow to allow other chunks to continue
        // Missing URIs will be detected by caller if needed
      }
    }
  };

  // Start limited number of workers
  const workers = Array.from({ length: Math.min(concurrency, chunks.length) }, () => worker());
  await Promise.all(workers);

  return results;
};
