// Estatísticas por semana de calendário (domingo a sábado) para o resumo
// "esta semana vs semana passada" do Dashboard.
import type { WorkoutSession } from "./types";

export interface WeekSummary {
  sessions: number;
  volume: number;
  durationMin: number;
  prs: number;
}
export interface WeekComparison {
  current: WeekSummary;
  previous: WeekSummary;
  volumeDelta: number | null; // % vs semana passada
  sessionsDelta: number;
  daysElapsed: number; // dias já decorridos na semana atual (1–7)
  projectedVolume: number; // projeção linear do volume ao fim da semana
}

function weekStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay()); // domingo
  return x;
}

function summarize(sessions: WorkoutSession[], from: Date, to: Date): WeekSummary {
  let volume = 0,
    durationMin = 0,
    prs = 0,
    count = 0;
  for (const s of sessions) {
    const t = new Date(s.date);
    if (t >= from && t < to) {
      count++;
      durationMin += s.duration_min || 0;
      prs += s.prs?.length ?? 0;
      volume += s.exercises.reduce(
        (a, e) => a + e.sets.reduce((b, st) => b + st.weight_kg * st.reps, 0),
        0,
      );
    }
  }
  return { sessions: count, volume: Math.round(volume), durationMin, prs };
}

export function weekComparison(sessions: WorkoutSession[]): WeekComparison {
  const now = new Date();
  const curStart = weekStart(now);
  const nextStart = new Date(curStart);
  nextStart.setDate(nextStart.getDate() + 7);
  const prevStart = new Date(curStart);
  prevStart.setDate(prevStart.getDate() - 7);

  const current = summarize(sessions, curStart, nextStart);
  const previous = summarize(sessions, prevStart, curStart);
  const daysElapsed = Math.min(
    7,
    Math.max(1, Math.floor((now.getTime() - curStart.getTime()) / 86400000) + 1),
  );

  return {
    current,
    previous,
    volumeDelta:
      previous.volume > 0
        ? Math.round(((current.volume - previous.volume) / previous.volume) * 100)
        : null,
    sessionsDelta: current.sessions - previous.sessions,
    daysElapsed,
    projectedVolume: Math.round((current.volume / daysElapsed) * 7),
  };
}
