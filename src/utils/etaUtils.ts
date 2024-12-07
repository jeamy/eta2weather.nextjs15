import { ParsedXmlData } from '@/reader/functions/types-constants/EtaConstants';
import { MenuNode } from '@/types/menu';

export interface EtaDataState {
  values: Record<string, ParsedXmlData>;
  loading: Record<string, boolean>;
  error: Record<string, string>;
}

export interface EtaFetchHookResult extends EtaDataState {
  fetchValues: (uris: string[]) => Promise<void>;
  cleanupAllAbortControllers: () => void;
}

export const getAllUris = (nodes: MenuNode[]): string[] => {
  const uris = new Set<string>();

  const addNodeUris = (node: MenuNode) => {
    if (node.uri) {
      uris.add(node.uri);
    }
    node.children?.forEach(addNodeUris);
  };

  nodes.forEach(addNodeUris);
  return Array.from(uris);
};

export const batchFetchEtaData = async (
  uris: string[],
  abortSignal?: AbortSignal
): Promise<Record<string, ParsedXmlData>> => {
  try {
    // Create a batch request payload
    const response = await fetch('/api/eta/readBatchMenuData', {
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
