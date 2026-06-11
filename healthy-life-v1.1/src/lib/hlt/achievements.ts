// Sistema de conquistas — regras avaliadas sobre os dados existentes.
import { KEYS, writeStore } from "./storage";
import { kvGetRow } from "./db";
import type { WeightLog, WorkoutSession } from "./types";

export interface UnlockedAchievement { code: string; date: string }

export const ACHIEVEMENTS = [
  { code: "primeiro_treino", name: "Primeiro treino",   icon: "🏁", desc: "Registrou a primeira sessão" },
  { code: "streak_7",        name: "7 dias seguidos",   icon: "🔥", desc: "Atividade em 7 dias consecutivos" },
  { code: "streak_30",       name: "30 dias seguidos",  icon: "🌋", desc: "Atividade em 30 dias consecutivos" },
  { code: "treinos_25",      name: "25 treinos",        icon: "💪", desc: "Completou 25 sessões" },
  { code: "treinos_100",     name: "100 treinos",       icon: "💯", desc: "Completou 100 sessões" },
  { code: "primeiro_pr",     name: "Primeiro recorde",  icon: "🏆", desc: "Bateu o primeiro PR" },
  { code: "meta_62",         name: "Meta: 62 kg",       icon: "🎯", desc: "Alcançou o peso-alvo do clean bulk" },
  { code: "supino_100",      name: "Clube dos 100 kg",  icon: "🦍", desc: "100 kg no supino" },
] as const;

async function read<T>(key: string, fallback: T): Promise<T> {
  const row = await kvGetRow(key);
  return row === undefined ? fallback : (row.value as T);
}

/** Avalia as regras e persiste novas conquistas. Retorna apenas as novas. */
export async function checkAchievements(): Promise<typeof ACHIEVEMENTS[number][]> {
  if (typeof window === "undefined") return [];
  const sessions = await read<WorkoutSession[]>(KEYS.sessions, []);
  const weights  = await read<WeightLog[]>(KEYS.weights, []);
  const unlocked = await read<UnlockedAchievement[]>(KEYS.achievements, []);
  const have = new Set(unlocked.map((u) => u.code));
  const fresh: typeof ACHIEVEMENTS[number][] = [];
  const unlock = (code: string) => {
    if (have.has(code)) return;
    have.add(code);
    const def = ACHIEVEMENTS.find((a) => a.code === code);
    if (def) fresh.push(def);
  };

  if (sessions.length >= 1)   unlock("primeiro_treino");
  if (sessions.length >= 25)  unlock("treinos_25");
  if (sessions.length >= 100) unlock("treinos_100");
  if (sessions.some((s) => (s.prs?.length ?? 0) > 0)) unlock("primeiro_pr");

  // streak por dias com treino
  const days = new Set(sessions.map((s) => s.date.slice(0, 10)));
  let streak = 0;
  const d = new Date();
  if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  while (days.has(d.toISOString().slice(0, 10))) { streak++; d.setDate(d.getDate() - 1); }
  if (streak >= 7)  unlock("streak_7");
  if (streak >= 30) unlock("streak_30");

  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length && sorted[sorted.length - 1].weight_kg >= 62) unlock("meta_62");

  const supino100 = sessions.some((s) =>
    s.exercises.some((e) => /supino/i.test(e.name) && e.sets.some((st) => st.weight_kg >= 100)));
  if (supino100) unlock("supino_100");

  if (fresh.length) {
    const now = new Date().toISOString();
    writeStore<UnlockedAchievement[]>(
      KEYS.achievements,
      (prev) => [...prev, ...fresh.map((f) => ({ code: f.code, date: now }))],
      [],
    );
  }
  return fresh;
}
