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

export const isTimeInWindow = (startStr: string, endStr: string, now: Date = new Date()): boolean => {
  const [startH, startM] = startStr.split(':').map(Number);
  const [endH, endM] = endStr.split(':').map(Number);

  // Get current time in Europe/Vienna
  const timeFormatter = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Vienna',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  });

  const parts = timeFormatter.formatToParts(now);
  const currentH = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const currentM = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);

  const currentMinutes = currentH * 60 + currentM;
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // Handle 00:00 - 00:00 as inactive
  if (startMinutes === 0 && endMinutes === 0) {
    console.log('[checkHeatingTime] isTimeInWindow: window disabled (00:00 - 00:00)', { startStr, endStr });
    return false;
  }

  let inWindow: boolean;

  // Handle overnight windows (e.g. 22:00 - 06:00)
  if (endMinutes < startMinutes) {
    inWindow = currentMinutes >= startMinutes || currentMinutes < endMinutes;
  } else {
    inWindow = currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  console.log('[checkHeatingTime] isTimeInWindow result', {
    startStr,
    endStr,
    currentH,
    currentM,
    currentMinutes,
    startMinutes,
    endMinutes,
    inWindow,
  });

  return inWindow;
};

export const checkHeatingTime = (menuNodes: MenuNode[], values: Record<string, ParsedXmlData>): boolean => {
  console.log('[checkHeatingTime] --- start ---');

  // Find Heizzeiten node
  let heizzeitenNode: MenuNode | undefined;
  const findNode = (nodes: MenuNode[]) => {
    for (const node of nodes) {
      if (node.name === 'Heizzeiten' || node.uri?.endsWith('/12113/0/0')) {
        heizzeitenNode = node;
        return;
      }
      if (node.children) findNode(node.children);
      if (heizzeitenNode) return;
    }
  };
  findNode(menuNodes);

  if (!heizzeitenNode) {
    console.log('[checkHeatingTime] Heizzeiten node not found in menu tree. Allowing heating by default.');
    return true;
  }

  if (!heizzeitenNode.children || heizzeitenNode.children.length === 0) {
    console.log('[checkHeatingTime] Heizzeiten node has no children. Allowing heating by default.', {
      uri: heizzeitenNode.uri,
    });
    return true;
  }

  // Get current day in Europe/Vienna
  const dayFormatter = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Vienna',
    weekday: 'long'
  });
  const currentDayName = dayFormatter.format(new Date());

  const availableDays = heizzeitenNode.children.map(n => n.name);
  console.log('[checkHeatingTime] Current day and available day nodes', {
    currentDayName,
    availableDays,
  });

  const dayNode = heizzeitenNode.children.find(n => n.name === currentDayName);
  if (!dayNode) {
    console.log('[checkHeatingTime] No day node found for current day. Blocking heating.', {
      currentDayName,
    });
    return false;
  }

  if (!dayNode.children || dayNode.children.length === 0) {
    console.log('[checkHeatingTime] Day node has no children (no Zeitfenster). Blocking heating.', {
      dayName: dayNode.name,
    });
    return false;
  }

  // Check all Zeitfenster
  let isActive = false;
  let hasWindows = false;

  for (const windowNode of dayNode.children) {
    // Relaxed regex: check if name contains "Zeitfenster" followed by a number
    if (/Zeitfenster\s+\d+/.test(windowNode.name) && windowNode.uri) {
      hasWindows = true;
      const data = values[windowNode.uri];
      if (!data) {
        console.log('[checkHeatingTime] No data found for Zeitfenster URI', {
          uri: windowNode.uri,
          name: windowNode.name,
        });
        continue;
      }

      const raw = (data.strValue || data.value || '').toString();
      if (!raw) {
        console.log('[checkHeatingTime] Zeitfenster has empty value/strValue', {
          uri: windowNode.uri,
          name: windowNode.name,
        });
        continue;
      }

      const match = raw.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
      if (!match) {
        console.log('[checkHeatingTime] Zeitfenster value does not match expected pattern HH:MM - HH:MM', {
          uri: windowNode.uri,
          name: windowNode.name,
          raw,
        });
        continue;
      }

      const [, h1, m1, h2, m2] = match;
      const start = `${h1}:${m1}`;
      const end = `${h2}:${m2}`;

      const inWindow = isTimeInWindow(start, end);
      console.log('[checkHeatingTime] Evaluated Zeitfenster', {
        uri: windowNode.uri,
        name: windowNode.name,
        raw,
        start,
        end,
        inWindow,
      });

      if (inWindow) {
        isActive = true;
        // We found an active window, so heating is ON.
        // We can break here because if ANY window is active, the result is true.
        break;
      }
    }
  }

  const result = hasWindows ? isActive : false;
  console.log('[checkHeatingTime] Result', {
    hasWindows,
    isActive,
    currentDayName,
    finalResult: result,
  });

  // If we found windows, return the result. If no windows found (e.g. empty day), return false (no heating).
  return result;
};
