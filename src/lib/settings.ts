import { useSyncExternalStore } from 'react';

import { EXAMS, MAX_PER_DAY, MIN_PER_DAY, type ExamSlug } from './exams';
import { getItem, setItem } from './storage';

// Which exam to practice and how many questions a day. Kept on this device.
const KEY = 'daily-drip:settings:v1';

export type Settings = { exam: ExamSlug; perDay: number };

const DEFAULTS: Settings = { exam: 'praxis-slp', perDay: 1 };

function clean(value: Partial<Settings>): Settings {
  const exam = EXAMS.some((e) => e.slug === value.exam) ? (value.exam as ExamSlug) : DEFAULTS.exam;
  const perDay = Number.isInteger(value.perDay)
    ? Math.min(Math.max(value.perDay as number, MIN_PER_DAY), MAX_PER_DAY)
    : DEFAULTS.perDay;
  return { exam, perDay };
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
