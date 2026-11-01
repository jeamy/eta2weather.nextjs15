import { ParsedXmlData } from '@/reader/functions/types-constants/EtaConstants';

export type TimeWindowEdit = {
  uri: string;
  current?: ParsedXmlData;
  start: string;
  end: string;
};

export async function commitTimeWindowEdits(
  edits: TimeWindowEdit[],
  save: (edit: TimeWindowEdit) => Promise<void>,
  refresh: (uris: string[]) => Promise<boolean>,
) {
  const outcomes = await Promise.allSettled(edits.map(save));
  const saved = edits.filter((_, index) => outcomes[index].status === 'fulfilled');
  const failed = outcomes.flatMap((outcome, index) =>
    outcome.status === 'rejected' ? [{ uri: edits[index].uri, error: outcome.reason as unknown }] : [],
  );
  let readbackFailed = false;
  if (saved.length) {
    try {
      readbackFailed = !await refresh(saved.map(edit => edit.uri));
    } catch {
      readbackFailed = true;
    }
  }
  return { confirmed: readbackFailed ? [] : saved, savedCount: saved.length, failed, readbackFailed };
}

export function removeConfirmedWindowEdits(
  edits: Record<string, { start: string; end: string }>,
  confirmed: TimeWindowEdit[],
) {
  const remaining = { ...edits };
  for (const { uri, start, end } of confirmed) {
    if (remaining[uri]?.start === start && remaining[uri]?.end === end) {
      delete remaining[uri];
    }
  }
  return remaining;
}
