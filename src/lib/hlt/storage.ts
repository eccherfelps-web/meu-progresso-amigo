import { useEffect, useState, useCallback } from "react";

export const KEYS = {
  profile: "hlt_profile",
  exercises: "hlt_exercises",
  sessions: "hlt_workout_sessions",
  weights: "hlt_weight_logs",
  foods: "hlt_food_logs",
  hydration: "hlt_hydration_logs",
  assessment: "hlt_assessment",
  measures: "hlt_body_measures",
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setValue(read<T>(key, initial));
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
        write(key, next);
        return next;
      });
    },
    [key],
  );

  return [value, update, hydrated] as const;
}

export function exportAll(): string {
  const out: Record<string, unknown> = {};
  for (const k of Object.values(KEYS)) {
    const raw = window.localStorage.getItem(k);
    if (raw) out[k] = JSON.parse(raw);
  }
  return JSON.stringify(out, null, 2);
}

export function importAll(json: string) {
  const data = JSON.parse(json) as Record<string, unknown>;
  for (const [k, v] of Object.entries(data)) {
    window.localStorage.setItem(k, JSON.stringify(v));
  }
}

export function resetAll() {
  for (const k of Object.values(KEYS)) window.localStorage.removeItem(k);
}
