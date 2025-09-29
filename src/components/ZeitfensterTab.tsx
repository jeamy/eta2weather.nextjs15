import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MenuNode } from '@/types/menu';
import { useEtaData } from '@/hooks/useEtaData';
// No formatted value display here
import { API } from '@/constants/apiPaths';
import { ParsedXmlData } from '@/reader/functions/types-constants/EtaConstants';
import { useToast } from '@/components/ToastProvider';

interface ZeitfensterTabProps {
  menuItems: MenuNode[];
}

// Utility: walk tree
const walk = (node: MenuNode, fn: (n: MenuNode, parent?: MenuNode) => void, parent?: MenuNode) => {
  fn(node, parent);
  node.children?.forEach(child => walk(child, fn, node));
};

function findHeizzeitenNode(menu: MenuNode[]): MenuNode | undefined {
  let found: MenuNode | undefined;
  for (const root of menu) {
    walk(root, (n) => {
      if (n.name === 'Heizzeiten' || n.uri?.endsWith('/12113/0/0')) {
        found = found || n;
      }
    });
    if (found) break;
  }
  return found;
}

function isDayNode(n: MenuNode): boolean {
  return ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'].includes(n.name);
}

function isZeitfensterNode(n: MenuNode): boolean {
  return /^Zeitfenster\s+[1-3]$/.test(n.name);
}

const parseRange = (raw?: string) => {
  const m = raw?.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (m) {
    const [, h1, m1, h2, m2] = m;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return { start: `${pad(parseInt(h1, 10))}:${m1}`, end: `${pad(parseInt(h2, 10))}:${m2}` };
  }
  return { start: '06:00', end: '08:00' };
};

const timeToIndex = (t: string) => {
  const [hh, mm] = t.split(':').map(Number);
  const total = hh * 60 + mm;
  return Math.max(0, Math.min(96, Math.round(total / 15)));
};

const indexToTime = (idx: number) => {
  const clamped = Math.max(0, Math.min(96, Math.round(idx)));
  const total = clamped * 15;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hh)}:${pad(mm)}`;
};

async function saveZeitfenster(uri: string, current: ParsedXmlData | undefined, start: string, end: string) {
  const begin = timeToIndex(start);
  const endIdx = timeToIndex(end);
  const isDisabled = begin === 0 && endIdx === 0; // 00:00–00:00 => inaktiv
  if (!isDisabled && endIdx <= begin) throw new Error('Ende muss nach Beginn liegen');
  const res = await fetch(API.ETA_UPDATE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: uri, value: current?.value ?? '0', begin: String(begin), end: String(endIdx) })
  });
  const json = await res.json();
  if (!res.ok || json?.error) {
    throw new Error(json?.error || `Fehler ${res.status}`);
  }
}

// Timeline (0–24h) for a day's windows
const DayTimeline: React.FC<{
  windows: MenuNode[];
  values: Record<string, ParsedXmlData | undefined>;
  edited: Record<string, { start: string; end: string }>;
  onChange: (uri: string, start: string, end: string) => void;
}> = ({ windows, values, edited, onChange }) => {
  const barRef = useRef<HTMLDivElement>(null);
  const segments = useMemo(() => {
    return windows
      .map((w) => {
        const data = values[w.uri];
        const base = parseRange(data?.strValue || data?.value);
        const start = edited[w.uri]?.start ?? base.start;
        const end = edited[w.uri]?.end ?? base.end;
        const b = timeToIndex(start);
        const e = timeToIndex(end);
        if (e <= b) return null;
        const left = (b / 96) * 100;
        const width = ((e - b) / 96) * 100;
        return { left, width, start, end, uri: w.uri, b, e };
      })
      .filter(Boolean) as { left: number; width: number; start: string; end: string; uri: string; b: number; e: number }[];
  }, [windows, values, edited]);

  type DragType = 'left' | 'right' | 'move';
  const [drag, setDrag] = useState<null | {
    uri: string;
    type: DragType;
    startIdx: number;
    endIdx: number;
    grabOffset?: number;
    leftLimit?: number;
    rightLimit?: number;
  }>(null);
  const [bump, setBump] = useState<Record<string, boolean>>({});
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const downRef = useRef<{ uri: string; idx: number; time: number } | null>(null);

  const triggerBump = useCallback((uri: string) => {
    setBump(prev => {
      if (prev[uri]) return prev;
      const next = { ...prev, [uri]: true };
      setTimeout(() => {
        setBump(p => {
          const { [uri]: _removed, ...rest } = p;
          return rest;
        });
      }, 160);
      return next;
    });
  }, []);

  const pxToIndex = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const rel = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const ratio = rect.width === 0 ? 0 : rel / rect.width;
    return Math.round(ratio * 96);
  };

  useEffect(() => {
    if (!drag) return;
    const handleMove = (e: PointerEvent) => {
      if (e.cancelable) e.preventDefault();
      const idx = pxToIndex(e.clientX);
      if (drag.type === 'left') {
        const leftLimit = drag.leftLimit ?? 0;
        const unclamped = idx;
        const newStart = Math.min(Math.max(leftLimit, idx), drag.endIdx - 1);
        if (unclamped < leftLimit || unclamped > drag.endIdx - 1) triggerBump(drag.uri);
        onChange(drag.uri, indexToTime(newStart), indexToTime(drag.endIdx));
      } else if (drag.type === 'right') {
        const rightLimit = drag.rightLimit ?? 96;
        const unclamped = idx;
        const newEnd = Math.max(Math.min(rightLimit, idx), drag.startIdx + 1);
        if (unclamped > rightLimit || unclamped < drag.startIdx + 1) triggerBump(drag.uri);
        onChange(drag.uri, indexToTime(drag.startIdx), indexToTime(newEnd));
      } else if (drag.type === 'move') {
        const span = drag.endIdx - drag.startIdx;
        let newStart = idx - (drag.grabOffset ?? 0);
        const leftLimit = drag.leftLimit ?? 0;
        const rightLimit = (drag.rightLimit ?? 96) - span;
        const unclamped = newStart;
        newStart = Math.min(Math.max(leftLimit, newStart), rightLimit);
        if (unclamped < leftLimit || unclamped > rightLimit) triggerBump(drag.uri);
        const newEnd = newStart + span;
        onChange(drag.uri, indexToTime(newStart), indexToTime(newEnd));
      }
    };
    const handleUp = (e: PointerEvent) => {
      // Tap-to-toggle bubble if it was a quick, small move
      const d = downRef.current;
      if (d) {
        const upIdx = pxToIndex(e.clientX);
        const moved = Math.abs(upIdx - d.idx);
        const dt = performance.now() - d.time;
        if (moved <= 1 && dt < 300) {
          setActiveTooltip(prev => (prev === d.uri ? null : d.uri));
        }
      }
      downRef.current = null;
      setDrag(null);
    };
    const handleCancel = () => {
      downRef.current = null;
      setDrag(null);
    };
    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp, { once: true });
    window.addEventListener('pointercancel', handleCancel, { once: true });
    return () => {
      window.removeEventListener('pointermove', handleMove as any);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
    };
  }, [drag, onChange, triggerBump]);

  const ticks = Array.from({ length: 13 }, (_, i) => i * 2);
  const labelTicks = [0, 6, 12, 18, 24];

  return (
    <div className="w-full">
      <div ref={barRef} className="relative h-3 sm:h-3 w-full rounded bg-gray-200 overflow-visible touch-none select-none">
        {ticks.map((t) => {
          const isMajor = t === 0 || t === 12 || t === 24;
          return (
            <div
              key={`tick-${t}`}
              className={`absolute top-0 bottom-0 ${isMajor ? 'bg-gray-700' : 'bg-gray-500'}`}
              style={{ left: `${(t / 24) * 100}%`, width: isMajor ? '1px' : '1px' }}
            />
          );
        })}
        {segments.map((s, i) => (
          <div
            key={`seg-${i}`}
            className={`group absolute top-0 bottom-0 bg-green-500/90 cursor-grab ${bump[s.uri] ? 'ring-2 ring-red-500 shake' : ''}`}
            style={{ left: `${s.left}%`, width: `${s.width}%` }}
            tabIndex={0}
            aria-label={`${s.start} – ${s.end}`}
            onPointerDown={(e) => {
              if (e.cancelable) e.preventDefault();
              const idx = pxToIndex(e.clientX);
              const grabOffset = idx - s.b; // distance from start edge in indices
              const others = segments.filter(o => o.uri !== s.uri);
              const leftLimit = Math.max(0, ...[0, ...others.filter(o => o.e <= s.b).map(o => o.e)]);
              const rightLimit = Math.min(96, ...[96, ...others.filter(o => o.b >= s.e).map(o => o.b)]);
              downRef.current = { uri: s.uri, idx, time: performance.now() };
              setDrag({ uri: s.uri, type: 'move', startIdx: s.b, endIdx: s.e, grabOffset, leftLimit, rightLimit });
            }}
          >
            <div
              className="absolute inset-y-0 left-0 w-2 cursor-ew-resize"
              onPointerDown={(e) => {
                e.stopPropagation();
                if (e.cancelable) e.preventDefault();
                const others = segments.filter(o => o.uri !== s.uri);
                const leftLimit = Math.max(0, ...[0, ...others.filter(o => o.e <= s.e).map(o => o.e)]);
                setDrag({ uri: s.uri, type: 'left', startIdx: s.b, endIdx: s.e, leftLimit });
              }}
              aria-label="Start verschieben"
            >
              <span className="absolute top-1/2 -translate-y-1/2 -left-0.5 h-4 w-1.5 rounded bg-white ring-1 ring-gray-600 shadow pointer-events-none"></span>
            </div>
            <div
              className="absolute inset-y-0 right-0 w-2 cursor-ew-resize"
              onPointerDown={(e) => {
                e.stopPropagation();
                if (e.cancelable) e.preventDefault();
                const others = segments.filter(o => o.uri !== s.uri);
                const rightLimit = Math.min(96, ...[96, ...others.filter(o => o.b >= s.b).map(o => o.b)]);
                setDrag({ uri: s.uri, type: 'right', startIdx: s.b, endIdx: s.e, rightLimit });
              }}
              aria-label="Ende verschieben"
            >
              <span className="absolute top-1/2 -translate-y-1/2 -right-0.5 h-4 w-1.5 rounded bg-white ring-1 ring-gray-600 shadow pointer-events-none"></span>
            </div>
            <div className={`absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 text-white text-[10px] px-2 py-1 shadow ${activeTooltip === s.uri ? 'block' : 'hidden'} group-hover:block group-focus:block pointer-events-none z-10`}>
              {s.start} – {s.end}
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></span>
            </div>
          </div>
        ))}
      </div>
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }
        .shake { animation: shake 150ms ease-in-out; }
      `}</style>
      <div className="mt-1 flex justify-between text-[10px] sm:text-xs text-gray-500">
        {labelTicks.map((t) => (
          <span key={`label-${t}`}>{t}</span>
        ))}
      </div>
    </div>
  );
};

const SectionHeader: React.FC<{ title: string, action?: React.ReactNode }>= ({ title, action }) => (
  <div className="flex justify-between items-center h-12 mb-2">
    <h2 className="text-lg font-semibold">{title}</h2>
    {action ?? null}
  </div>
);

export const ZeitfensterTab: React.FC<ZeitfensterTabProps> = ({ menuItems }) => {
  const { showToast } = useToast();
  const heizzeiten = useMemo(() => findHeizzeitenNode(menuItems), [menuItems]);

  const tagFenster = useMemo(() => {
    if (!heizzeiten) return [] as { day: string; windows: MenuNode[] }[];
    return (heizzeiten.children || [])
      .filter(isDayNode)
      .map(day => ({
        day: day.name,
        windows: (day.children || []).filter(isZeitfensterNode)
      }));
  }, [heizzeiten]);

  const allUris = useMemo(() => tagFenster.flatMap(d => d.windows.map(w => w.uri)), [tagFenster]);
  const { values, fetchValues } = useEtaData();
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [edited, setEdited] = useState<Record<string, { start: string; end: string }>>({});
  const [syncedWindows, setSyncedWindows] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (allUris.length) fetchValues(allUris, { chunkSize: 50, concurrency: 3 });
  }, [allUris, fetchValues]);

  const handleSave = useCallback(async (uri: string, current: ParsedXmlData | undefined, start: string, end: string) => {
    setSaving(prev => ({ ...prev, [uri]: true }));
    try {
      await saveZeitfenster(uri, current, start, end);
      await fetchValues([uri]);
      showToast('Zeitfenster gespeichert', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Speichern fehlgeschlagen', 'error');
    } finally {
      setSaving(prev => ({ ...prev, [uri]: false }));
    }
  }, [fetchValues]);

  const handleTimeChange = useCallback((uri: string, field: 'start' | 'end', value: string) => {
    const window = tagFenster.flatMap(d => d.windows).find(w => w.uri === uri);
    if (!window) return;
    
    const zeitfensterNum = window.name.match(/(\d+)/)?.[1] ?? '1';
    const isSynced = syncedWindows[uri] || false;
    
    if (isSynced) {
      // Update all synced windows of the same Zeitfenster number
      const relatedWindows = tagFenster.flatMap(d => d.windows).filter(w => {
        const num = w.name.match(/(\d+)/)?.[1] ?? '1';
        return num === zeitfensterNum && (syncedWindows[w.uri] || false);
      });
      
      setEdited(prev => {
        const newEdited = { ...prev };
        relatedWindows.forEach(w => {
          const data = values[w.uri];
          const initial = parseRange(data?.strValue || data?.value);
          const currentStart = prev[w.uri]?.start ?? initial.start;
          const currentEnd = prev[w.uri]?.end ?? initial.end;
          
          newEdited[w.uri] = {
            start: field === 'start' ? value : currentStart,
            end: field === 'end' ? value : currentEnd
          };
        });
        return newEdited;
      });
    } else {
      // Update only this window
      const data = values[uri];
      const initial = parseRange(data?.strValue || data?.value);
      setEdited(prev => ({
        ...prev,
        [uri]: {
          start: field === 'start' ? value : (prev[uri]?.start ?? initial.start),
          end: field === 'end' ? value : (prev[uri]?.end ?? initial.end)
        }
      }));
    }
  }, [tagFenster, syncedWindows, values]);

  const handleSaveAll = useCallback(async (zeitfensterNum: string) => {
    // Find all synced windows of the same Zeitfenster number
    const syncedRelatedWindows = tagFenster.flatMap(d => d.windows).filter(w => {
      const num = w.name.match(/(\d+)/)?.[1] ?? '1';
      return num === zeitfensterNum && (syncedWindows[w.uri] || false);
    });
    
    const urisToSave = syncedRelatedWindows.map(w => w.uri).filter(uri => {
      const data = values[uri];
      const initial = parseRange(data?.strValue || data?.value);
      const currentStart = edited[uri]?.start ?? initial.start;
      const currentEnd = edited[uri]?.end ?? initial.end;
      return currentStart !== initial.start || currentEnd !== initial.end;
    });
    
    if (urisToSave.length === 0) return;
    
    setSaving(prev => {
      const newState = { ...prev };
      urisToSave.forEach(uri => { newState[uri] = true; });
      return newState;
    });

    try {
      const promises = urisToSave.map(async (uri) => {
        const data = values[uri];
        const initial = parseRange(data?.strValue || data?.value);
        const start = edited[uri]?.start ?? initial.start;
        const end = edited[uri]?.end ?? initial.end;
        await saveZeitfenster(uri, data, start, end);
      });
      
      await Promise.all(promises);
      await fetchValues(urisToSave);
      
      const syncedDays = syncedRelatedWindows.length;
      showToast(`Zeitfenster ${zeitfensterNum} für ${syncedDays} synchronisierte Tage gespeichert`, 'success');
      
      // Clear edited state for saved URIs
      setEdited(prev => {
        const newEdited = { ...prev };
        urisToSave.forEach(uri => {
          delete newEdited[uri];
        });
        return newEdited;
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Speichern fehlgeschlagen', 'error');
    } finally {
      setSaving(prev => {
        const newState = { ...prev };
        urisToSave.forEach(uri => { newState[uri] = false; });
        return newState;
      });
    }
  }, [tagFenster, syncedWindows, values, edited, fetchValues, showToast]);

  const handleTimelineChange = useCallback((uri: string, start: string, end: string) => {
    // Use handleTimeChange to ensure sync functionality works
    const currentData = values[uri];
    const currentInitial = parseRange(currentData?.strValue || currentData?.value);
    const currentStart = edited[uri]?.start ?? currentInitial.start;
    const currentEnd = edited[uri]?.end ?? currentInitial.end;
    
    // Determine which field changed and call handleTimeChange accordingly
    if (start !== currentStart) {
      handleTimeChange(uri, 'start', start);
    }
    if (end !== currentEnd) {
      handleTimeChange(uri, 'end', end);
    }
  }, [values, edited, handleTimeChange]);

  if (!heizzeiten) {
    return (
      <div className="card">
        <SectionHeader title="Zeitfenster" />
        <div className="alert alert--warning">Keine Heizzeiten gefunden.</div>
      </div>
    );
  }

  return (
    <div className="card">
      <SectionHeader title="Zeitfenster" />
      <div className="space-y-4">
        {tagFenster.map(({ day, windows }) => (
          <div key={day} className="border rounded-md">
            <div className="px-3 py-2 bg-gray-50 text-sm font-medium text-gray-700">{day}</div>
            <div className="px-3 py-3">
              <DayTimeline
                windows={windows}
                values={values}
                edited={edited}
                onChange={handleTimelineChange}
              />
            </div>
            <div className="divide-y">
              {windows.map(w => {
                const uri = w.uri;
                const data = values[uri];
                const initial = parseRange(data?.strValue || data?.value);
                const remountKey = `${uri}:${data?.strValue || data?.value || ''}`;
                const num = w.name.match(/(\d+)/)?.[1] ?? '';
                const currentStart = edited[uri]?.start ?? initial.start;
                const currentEnd = edited[uri]?.end ?? initial.end;
                const isDirty = currentStart !== initial.start || currentEnd !== initial.end;
                const isSynced = syncedWindows[uri] || false;
                
                // Check if any synced related window has changes
                const hasSyncedRelatedChanges = isSynced && tagFenster.some(({ windows: dayWindows }) => 
                  dayWindows.some(relatedW => {
                    const relatedNum = relatedW.name.match(/(\d+)/)?.[1] ?? '';
                    if (relatedNum !== num || !(syncedWindows[relatedW.uri] || false)) return false;
                    const relatedData = values[relatedW.uri];
                    const relatedInitial = parseRange(relatedData?.strValue || relatedData?.value);
                    const relatedCurrentStart = edited[relatedW.uri]?.start ?? relatedInitial.start;
                    const relatedCurrentEnd = edited[relatedW.uri]?.end ?? relatedInitial.end;
                    return relatedCurrentStart !== relatedInitial.start || relatedCurrentEnd !== relatedInitial.end;
                  })
                );
                
                // Count how many windows of this type are synced
                const syncedCount = tagFenster.flatMap(d => d.windows).filter(w => {
                  const relatedNum = w.name.match(/(\d+)/)?.[1] ?? '';
                  return relatedNum === num && (syncedWindows[w.uri] || false);
                }).length;

                return (
                  <div key={uri} className="px-3 py-3 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 sm:w-7 sm:h-7 rounded-full bg-green-600 text-white text-base sm:text-sm font-semibold">{num}</span>
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="time"
                          step={900}
                          value={currentStart}
                          onChange={(e) => handleTimeChange(uri, 'start', e.target.value)}
                          className="input min-h-[44px] text-base sm:text-sm flex-1 sm:w-28"
                        />
                        <span className="text-gray-500">-</span>
                        <input
                          type="time"
                          step={900}
                          value={currentEnd}
                          onChange={(e) => handleTimeChange(uri, 'end', e.target.value)}
                          className="input min-h-[44px] text-base sm:text-sm flex-1 sm:w-28"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3" key={remountKey}>
                      <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={isSynced || false}
                          onChange={(e) => {
                            setSyncedWindows(prev => ({
                              ...prev,
                              [uri]: e.target.checked
                            }));
                          }}
                          className="rounded"
                        />
                        <span className="text-xs text-gray-600">Sync</span>
                      </label>
                      <div className="flex items-center gap-2">
                        {isSynced && hasSyncedRelatedChanges && syncedCount > 1 ? (
                          <button
                            className={`btn btn--secondary min-w-[44px] min-h-[44px] disabled:opacity-50`}
                            aria-label="Alle speichern"
                            title={`${syncedCount} synchronisierte Zeitfenster speichern`}
                            disabled={!!Object.keys(saving).some(k => saving[k])}
                            onClick={() => handleSaveAll(num)}
                          >
                            ✓✓
                          </button>
                        ) : (
                          <button
                            className={`btn btn--primary min-w-[44px] min-h-[44px] disabled:opacity-50`}
                            aria-label="Speichern"
                            title="Speichern"
                            disabled={!isDirty || !!saving[uri]}
                            onClick={async () => {
                              const start = currentStart;
                              const end = currentEnd;
                              await handleSave(uri, data, start, end);
                              // Clear edited state after successful save
                              setEdited(prev => {
                                const { [uri]: _removed, ...rest } = prev;
                                return rest;
                              });
                            }}
                          >
                            ✓
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ZeitfensterTab;
