import { useSyncExternalStore } from 'react';

import { EXAMS, type ExamSlug } from './exams';
import { getItem, setItem } from './storage';

// Which exam to practice. Kept on this device.
const KEY = 'daily-drip:settings:v1';

export type Settings = { exam: ExamSlug };

const DEFAULTS: Settings = { exam: 'praxis-slp' };

function clean(value: Partial<Settings>): Settings {
  const exam = EXAMS.some((e) => e.slug === value.exam) ? (value.exam as ExamSlug) : DEFAULTS.exam;
  return { exam };
}

function load(): Settings {
  try {
    return clean(JSON.parse(getItem(KEY) ?? '{}'));
  } catch {
    return DEFAULTS;
  }
}

let current = load();
const listeners = new Set<() => void>();

export function updateSettings(change: Partial<Settings>): void {
  current = clean({ ...current, ...change });
  setItem(KEY, JSON.stringify(current));
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => current);
}
