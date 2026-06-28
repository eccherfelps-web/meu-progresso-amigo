// Camada de armazenamento reativa.
// A API é a mesma da versão anterior (useLocalStorage / exportAll / importAll /
// resetAll), então as páginas não mudam — mas por baixo os dados agora vivem
// no IndexedDB (permanente, sem limite de 5 MB) com flag de sincronização.
// Dados antigos do localStorage são migrados automaticamente na primeira carga.
import { useCallback, useEffect, useState } from "react";
import { kvGetRow, kvWrite, kvAllData, kvReset } from "./db";

export const KEYS = {
  profile: "hlt_profile",
  exercises: "hlt_exercises",
  sessions: "hlt_workout_sessions",
  weights: "hlt_weight_logs",
  foods: "hlt_food_logs",
  hydration: "hlt_hydration_logs",
  assessment: "hlt_assessment",
  measures: "hlt_body_measures",
  achievements: "hlt_achievements",
  schedule: "hlt_week_schedule",
} as const;

// cache compartilhado: componentes diferentes lendo a mesma chave
// permanecem em sincronia (melhoria sobre a versão anterior)
const cache = new Map<string, unknown>();
const subs = new Map<string, Set<() => void>>();
function notify(key: string) {
  subs.get(key)?.forEach((fn) => fn());
}
function subscribe(key: string, fn: () => void) {
  if (!subs.has(key)) subs.set(key, new Set());
  subs.get(key)!.add(fn);
  return () => {
    subs.get(key)!.delete(fn);
  };
}

async function ensureLoaded<T>(key: string, fallback: T): Promise<void> {
  if (cache.has(key)) return;
  const row = await kvGetRow(key);
  if (!cache.has(key)) cache.set(key, row === undefined ? fallback : (row.value as T));
}

/** Escrita programática (fora de componentes) — marca dirty e agenda sync. */
export function writeStore<T>(key: string, v: T | ((prev: T) => T), fallback: T): T {
  const prev = (cache.has(key) ? cache.get(key) : fallback) as T;
  const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
  cache.set(key, next);
  notify(key);
  void kvWrite(key, next);
  void import("./sync").then((m) => m.scheduleSync());
  return next;
}

/** Aplicação de valor vindo do servidor (não marca dirty). */
export async function applyRemote(key: string, value: unknown, updated_at: string) {
  await kvWrite(key, value, { clean: true, updated_at });
  cache.set(key, value);
  notify(key);
}

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    const pull = () => {
      if (alive && cache.has(key)) setValue(cache.get(key) as T);
    };
    const unsub = subscribe(key, pull);
    void ensureLoaded(key, initial).then(() => {
      if (alive) {
        pull();
        setHydrated(true);
      }
    });
    return () => {
      alive = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (v: T | ((prev: T) => T)) => {
      writeStore<T>(key, v, initial);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  return [value, update, hydrated] as const;
}

// ── backup ──
export async function exportAll(): Promise<string> {
  return JSON.stringify(await kvAllData(), null, 2);
}
export async function importAll(json: string) {
  const data = JSON.parse(json) as Record<string, unknown>;
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith("hlt_")) continue;
    if (k === "hlt_food_cache") continue; // cache local não vai para a nuvem
    await kvWrite(k, v); // dirty=1 → sobe para a nuvem também
    cache.set(k, v);
    notify(k);
  }
  void import("./sync").then((m) => m.scheduleSync());
}
export async function resetAll() {
  await kvReset();
  cache.clear();
}
