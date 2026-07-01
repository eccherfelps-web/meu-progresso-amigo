// Análise de progressão por exercício: histórico de 1RM, comparação entre
// sessões, detecção de estagnação e sugestão de carga (dupla progressão).
// Base para as features de comparação treino-a-treino, alerta de estagnação
// e sugestão de progressão.
import type { WorkoutSession, Exercise } from "./types";
import { oneRepMax } from "./onerm";

export interface ExerciseSessionSummary {
  date: string; // ISO
  best1rm: number;
  topWeight: number;
  topReps: number;
  totalReps: number;
  avgRpe: number | null;
}

/** Resumo por sessão de um exercício, da mais antiga para a mais recente. */
export function exerciseHistory(
  sessions: WorkoutSession[],
  exerciseId: string,
): ExerciseSessionSummary[] {
  const out: ExerciseSessionSummary[] = [];
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    const ex = s.exercises.find((e) => e.exercise_id === exerciseId);
    if (!ex || ex.sets.length === 0) continue;
    const rms = ex.sets.map((st) =>
      oneRepMax(st.weight_kg, st.reps, {
        bodyweight: ex.bodyweight,
        bodyweightKg: ex.bodyweight_kg,
        exerciseName: ex.name,
      }),
    );
    const rpes = ex.sets.map((st) => st.rpe).filter((r): r is number => r != null);
    const topSet = ex.sets.reduce((a, b) => (b.weight_kg > a.weight_kg ? b : a));
    out.push({
      date: s.date,
      best1rm: Math.max(...rms),
      topWeight: topSet.weight_kg,
      topReps: topSet.reps,
      totalReps: ex.sets.reduce((a, st) => a + st.reps, 0),
      avgRpe: rpes.length ? +(rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1) : null,
    });
  }
  return out;
}

export interface ProgressComparison {
  hasPrev: boolean;
  prev1rm: number;
  delta: number; // variação de 1RM vs sessão anterior
  daysAgo: number;
  prevTopWeight: number;
  prevTopReps: number;
  prevDate: string;
}

/** Compara o desempenho atual (parcial) com a última sessão desse exercício. */
export function compareToLast(
  sessions: WorkoutSession[],
  exerciseId: string,
  currentBest1rm?: number,
): ProgressComparison | null {
  const hist = exerciseHistory(sessions, exerciseId);
  if (hist.length === 0) return null;
  const last = hist[hist.length - 1];
  const daysAgo = Math.round((Date.now() - new Date(last.date).getTime()) / 86400000);
  return {
    hasPrev: true,
    prev1rm: last.best1rm,
    delta: currentBest1rm != null ? +(currentBest1rm - last.best1rm).toFixed(1) : 0,
    daysAgo,
    prevTopWeight: last.topWeight,
    prevTopReps: last.topReps,
    prevDate: last.date,
  };
}

export interface StagnationInfo {
  stagnant: boolean;
  sessionsSincePr: number;
  recentWeights: number[];
  best1rmEver: number;
}

/** Detecta estagnação: nº de sessões desde o último recorde de 1RM. */
export function detectStagnation(
  sessions: WorkoutSession[],
  exerciseId: string,
  threshold = 4,
): StagnationInfo {
  const hist = exerciseHistory(sessions, exerciseId);
  if (hist.length < 2)
    return {
      stagnant: false,
      sessionsSincePr: 0,
      recentWeights: [],
      best1rmEver: hist[0]?.best1rm ?? 0,
    };
  let best = 0;
  let sincePr = 0;
  for (const h of hist) {
    if (h.best1rm > best + 0.01) {
      best = h.best1rm;
      sincePr = 0;
    } else {
      sincePr++;
    }
  }
  return {
    stagnant: sincePr >= threshold,
    sessionsSincePr: sincePr,
    recentWeights: hist.slice(-5).map((h) => h.topWeight),
    best1rmEver: best,
  };
}

export interface LoadSuggestion {
  suggestedWeight: number | null;
  reason: string;
  action: "subir" | "manter" | "reduzir" | "primeira";
}

// Extrai o topo da faixa de reps de uma string como "8-12" ou "10".
function repRange(reps: string): { min: number; max: number } {
  const nums = (reps.match(/\d+/g) || []).map(Number);
  if (nums.length >= 2) return { min: nums[0], max: nums[1] };
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  return { min: 8, max: 12 };
}

/** Sugestão de carga por dupla progressão, a partir da última sessão. */
export function suggestLoad(sessions: WorkoutSession[], exercise: Exercise): LoadSuggestion {
  const hist = exerciseHistory(sessions, exercise.id);
  const { min, max } = repRange(exercise.reps);
  if (hist.length === 0) {
    return {
      suggestedWeight: exercise.load_kg ?? null,
      reason: "Primeira vez — comece com uma carga confortável e ajuste.",
      action: "primeira",
    };
  }
  const last = hist[hist.length - 1];
  // heurística de incremento: ~5% arredondado a 0,5kg (mín. 1kg)
  const inc = Math.max(1, Math.round(last.topWeight * 0.05 * 2) / 2);
  if (last.topReps >= max) {
    return {
      suggestedWeight: +(last.topWeight + inc).toFixed(1),
      reason: `Você bateu ${last.topReps} reps (topo da faixa ${min}-${max}) com ${last.topWeight}kg — hora de subir.`,
      action: "subir",
    };
  }
  if (last.topReps < min) {
    return {
      suggestedWeight: last.topWeight,
      reason: `Última vez ficou em ${last.topReps} reps (abaixo de ${min}). Mantenha a carga e busque mais reps.`,
      action: "manter",
    };
  }
  return {
    suggestedWeight: last.topWeight,
    reason: `Mantenha ${last.topWeight}kg e tente passar de ${last.topReps} para ${max} reps.`,
    action: "manter",
  };
}
