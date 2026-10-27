const key = 'lothuus-updates-viewed-v1';
const maximum = 200;

export function readViewed(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length <= 120))].slice(-maximum) : [];
  } catch { return []; }
}

export function saveViewed(ids: string[]): string[] {
  const viewed = [...new Set([...readViewed(), ...ids])].slice(-maximum);
  try { localStorage.setItem(key, JSON.stringify(viewed)); } catch { /* Reading updates also works without browser storage. */ }
  return viewed;
}
