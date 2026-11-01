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
  fetchValues: (uris: string[], options?: EtaFetchOptions) => Promise<boolean>;
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
  let failedChunks = 0;

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
        failedChunks += 1;
      }
    }
  };

  // Start limited number of workers
  const workers = Array.from({ length: Math.min(concurrency, chunks.length) }, () => worker());
  await Promise.all(workers);

  if (failedChunks === chunks.length && !abortSignal?.aborted) {
    throw new Error('All ETA batch requests failed');
  }

  return results;
};

export function parseTimeWindow(raw: string): { start: string; end: string; startMinutes: number; endMinutes: number } | null {
  const match = raw.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, h1, m1, h2, m2] = match;
  const startHour = Number(h1);
  const endHour = Number(h2);
  const startMinute = Number(m1);
  const endMinute = Number(m2);
  if (startHour > 24 || endHour > 24 || startMinute >= 60 || endMinute >= 60 ||
      (startHour === 24 && startMinute !== 0) || (endHour === 24 && endMinute !== 0)) return null;
  return {
    start: `${h1}:${m1}`,
    end: `${h2}:${m2}`,
    startMinutes: startHour * 60 + startMinute,
    endMinutes: endHour * 60 + endMinute,
  };
}

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
    return false;
  }

  let inWindow: boolean;

  // Handle overnight windows (e.g. 22:00 - 06:00)
  if (endMinutes < startMinutes) {
    inWindow = currentMinutes >= startMinutes || currentMinutes < endMinutes;
  } else {
    inWindow = currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return inWindow;
};

export function findHeatingTimeNode(nodes: MenuNode[]): MenuNode | undefined {
  for (const node of nodes) {
    if (node.name === 'Heizzeiten' || node.uri?.endsWith('/12113/0/0')) return node;
    const found = findHeatingTimeNode(node.children || []);
    if (found) return found;
  }
  return undefined;
}

export const checkHeatingTime = (menuNodes: MenuNode[], values: Record<string, ParsedXmlData>, now: Date = new Date()): boolean => {
  const heizzeitenNode = findHeatingTimeNode(menuNodes);
  if (!heizzeitenNode) {
    return true;
  }

  if (!heizzeitenNode.children || heizzeitenNode.children.length === 0) {
    return true;
  }

  // Get current day in Europe/Vienna
  const dayFormatter = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Vienna',
    weekday: 'long'
  });
  const currentDayName = dayFormatter.format(now);

  const dayNames = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  const allDayNodes: MenuNode[] = [];
  const collectDayNodes = (node: MenuNode) => {
    if (dayNames.includes(node.name)) {
      allDayNodes.push(node);
    }
    node.children?.forEach(collectDayNodes);
  };
  collectDayNodes(heizzeitenNode);

  const currentIndex = dayNames.indexOf(currentDayName);
  if (currentIndex < 0) return false;
  const previousDayName = dayNames[(currentIndex + dayNames.length - 1) % dayNames.length];

  const hasActiveWindow = (dayName: string, previousDay: boolean): boolean => {
    const dayNode = allDayNodes.find(node => node.name === dayName);
    if (!dayNode) return false;
    const visit = (node: MenuNode): boolean => {
      if (/Zeitfenster\s+\d+/.test(node.name) && node.uri) {
        const raw = values[node.uri]?.strValue || values[node.uri]?.value || '';
        const window = parseTimeWindow(raw);
        if (window) {
          const { start, end, startMinutes, endMinutes } = window;
          if (endMinutes < startMinutes) {
            return previousDay
              ? isTimeInWindow('00:00', end, now)
              : isTimeInWindow(start, '24:00', now);
          }
          if (!previousDay && isTimeInWindow(start, end, now)) return true;
        }
      }
      return (node.children || []).some(visit);
    };
    return visit(dayNode);
  };

  return hasActiveWindow(currentDayName, false) || hasActiveWindow(previousDayName, true);
};
