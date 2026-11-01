export function normalizeEtaVariableId(input: string): string | null {
  let path = input.trim();
  try {
    if (/^https?:\/\//i.test(path)) path = new URL(path).pathname;
    path = decodeURIComponent(path).replace(/^\/+/, '').replace(/^user\/var\/+/, '');
  } catch {
    return null;
  }
  return /^\d+(?:\/\d+){4,}$/.test(path) ? path : null;
}
