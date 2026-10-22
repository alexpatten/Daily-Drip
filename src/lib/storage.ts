// Web: the browser's localStorage. Native uses storage.native.ts.
// Storage can be unavailable (private mode, blocked site data), so fail soft.

export function getItem(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function setItem(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Answers just won't be remembered across reloads.
  }
}
