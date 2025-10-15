/**
 * Robust parser for numeric values that handles German decimal comma.
 * Extracts first decimal number from strings like "22,5 °C" or "14.5°C"
 * 
 * @param raw - Value to parse (string, number, null, undefined)
 * @returns Parsed number or null if invalid
 * 
 * @example
 * parseNum("10,9") // 10.9
 * parseNum("10.9") // 10.9
 * parseNum("22,5 °C") // 22.5
 * parseNum(null) // null
 */
export function parseNum(raw: any): number | null {
  if (raw == null) return null;
  const s = String(raw).replace(',', '.'); // Replace German decimal comma
  const m = s.match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

/**
 * Same as parseNum but returns 0 instead of null for invalid values.
 * Useful when a numeric fallback is required.
 * 
 * @param raw - Value to parse
 * @returns Parsed number or 0 if invalid
 */
export function parseNumOrZero(raw: any): number {
  return parseNum(raw) ?? 0;
}
