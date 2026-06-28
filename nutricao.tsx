// Cálculos de consistência conscientes do cronograma:
// - streak real = dias de treino CONSECUTIVOS no calendário (sem buracos)
// - "dia esperado" = dia que o cronograma marca como treino mas ficou sem
//   sessão registrada (folga não conta como falha).
import type { WorkoutSession, WeekSchedule } from "./types";
import { dayGroups } from "./defaults";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Maior sequência de dias de treino CONSECUTIVOS terminando hoje/ontem. */
export function consecutiveTrainingStreak(sessions: WorkoutSession[]): number {
  const days = new Set(sessions.map((s) => s.date.slice(0, 10)));
  if (days.size === 0) return 0;
  let streak = 0;
  const d = new Date();
  if (!days.has(iso(d))) d.setDate(d.getDate() - 1); // tolera hoje sem treino ainda
  while (days.has(iso(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/** Quantos dias seguidos (calendário) houve treino, olhando para trás a partir
 *  de hoje — usado para o alerta de "sem descanso". Para de contar no 1º buraco. */
export function daysWithoutRest(sessions: WorkoutSession[]): number {
  return consecutiveTrainingStreak(sessions);
}

export interface ScheduleStatus {
  expectedToday: boolean; // o cronograma manda treinar hoje?
  trainedToday: boolean; // registrou sessão hoje?
  missedToday: boolean; // era pra treinar e não treinou
  missedThisWeek: string[]; // ISOs de dias de treino passados sem sessão (semana atual)
}

/** Cruza o cronograma com as sessões para saber o que foi cumprido/faltou. */
export function scheduleStatus(sessions: WorkoutSession[], schedule: WeekSchedule): ScheduleStatus {
  const trained = new Set(sessions.map((s) => s.date.slice(0, 10)));
  const today = new Date();
  const todayIso = iso(today);
  const expectedToday = dayGroups(schedule[today.getDay()]).length > 0;
  const trainedToday = trained.has(todayIso);

  // varre a semana atual (domingo até hoje) procurando dias de treino vazios
  const missedThisWeek: string[] = [];
  const start = new Date(today);
  start.setDate(start.getDate() - today.getDay()); // domingo
  for (let d = new Date(start); d < today; d.setDate(d.getDate() + 1)) {
    if (dayGroups(schedule[d.getDay()]).length > 0 && !trained.has(iso(d))) {
      missedThisWeek.push(iso(d));
    }
  }
  return {
    expectedToday,
    trainedToday,
    missedToday: expectedToday && !trainedToday,
    missedThisWeek,
  };
}
