// Análise de progressão por exercício: histórico de 1RM, comparação entre
// sessões, detecção de estagnação e sugestão de carga (dupla progressão).
// Base para as features de comparação treino-a-treino, alerta de estagnação
// e sugestão de progressão.
import type { WorkoutSession, Exercise } from "./types";
import { oneRepMax } from "./onerm";

/** Normaliza o nome de um exercício para comparação (ignora acento/caixa/espaços). */
export function normExerciseName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Um exercício de sessão "casa" com o selecionado se o ID bate OU o nome bate.
 *  Isso garante que recriar um exercício com o mesmo nome mantenha o histórico. */
export function sessionExerciseMatches(
  se: { exercise_id: string; name: string },
  selected: { id: string; name: string },
): boolean {
  return (
    se.exercise_id === selected.id || normExerciseName(se.name) === normExerciseName(selected.name)
  );
}

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
  nameHint?: string,
): ExerciseSessionSummary[] {
  const out: ExerciseSessionSummary[] = [];
  const normHint = nameHint ? normExerciseName(nameHint) : null;
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    // casa por ID ou por nome normalizado — assim recriar o exercício com o
    // mesmo nome (novo ID) não perde o histórico antigo.
    const ex = s.exercises.find(
      (e) =>
        e.exercise_id === exerciseId || (normHint != null && normExerciseName(e.name) === normHint),
    );
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
  nameHint?: string,
): ProgressComparison | null {
  const hist = exerciseHistory(sessions, exerciseId, nameHint);
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
  nameHint?: string,
): StagnationInfo {
  const hist = exerciseHistory(sessions, exerciseId, nameHint);
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
  const hist = exerciseHistory(sessions, exercise.id, exercise.name);
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

export interface RpeVolumePoint {
  date: string; // ISO da sessão
  dateLabel: string; // MM-DD
  avgRpe: number | null; // RPE médio do exercício na sessão
  maxRpe: number | null; // maior RPE de uma série (para o alerta)
  volume: number; // volume total (carga × reps) do exercício no dia
  topWeight: number; // maior carga usada
  hasCritical: boolean; // alguma série com RPE >= 9.5
  criticalSets: { weight: number; reps: number; rpe: number }[];
}

/**
 * Série temporal de RPE × Volume de UM exercício, sessão a sessão.
 * Base para o gráfico de correlação carga × esforço e o alerta de série crítica.
 */
export function rpeVolumeByExercise(
  sessions: WorkoutSession[],
  exerciseId: string,
  nameHint?: string,
): RpeVolumePoint[] {
  const out: RpeVolumePoint[] = [];
  const normHint = nameHint ? normExerciseName(nameHint) : null;
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    const ex = s.exercises.find(
      (e) =>
        e.exercise_id === exerciseId || (normHint != null && normExerciseName(e.name) === normHint),
    );
    if (!ex || ex.sets.length === 0) continue;
    const rpes = ex.sets.map((st) => st.rpe).filter((r): r is number => r != null);
    const volume = ex.sets.reduce((a, st) => a + st.weight_kg * st.reps, 0);
    const criticalSets = ex.sets
      .filter((st) => st.rpe != null && st.rpe >= 9.5)
      .map((st) => ({ weight: st.weight_kg, reps: st.reps, rpe: st.rpe as number }));
    out.push({
      date: s.date,
      dateLabel: s.date.slice(5, 10),
      avgRpe: rpes.length ? +(rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1) : null,
      maxRpe: rpes.length ? Math.max(...rpes) : null,
      volume: Math.round(volume),
      topWeight: Math.max(...ex.sets.map((st) => st.weight_kg)),
      hasCritical: criticalSets.length > 0,
      criticalSets,
    });
  }
  return out;
}

/** Interpreta a última sessão vs a anterior: força ganhou, fadiga subiu, etc. */
export function rpeVolumeInsight(points: RpeVolumePoint[]): string | null {
  const withRpe = points.filter((p) => p.avgRpe != null);
  if (withRpe.length < 2) return null;
  const last = withRpe[withRpe.length - 1];
  const prev = withRpe[withRpe.length - 2];
  const dRpe = (last.avgRpe as number) - (prev.avgRpe as number);
  const dVol = last.volume - prev.volume;
  const volSame = Math.abs(dVol) / Math.max(1, prev.volume) < 0.05;
  if (volSame && dRpe <= -0.5)
    return "Mesmo volume com RPE menor — sinal de ganho de força/adaptação. 💪";
  if (volSame && dRpe >= 0.5)
    return "Mesmo volume com RPE maior — fadiga acumulando neste exercício. Atenção ao descanso.";
  if (dVol > 0 && dRpe <= 0.3)
    return "Volume subiu sem esforço percebido disparar — progressão saudável.";
  if (dVol < 0 && dRpe >= 0.5)
    return "Volume caiu e o esforço subiu — pode ser fadiga ou dia ruim. Observe a próxima sessão.";
  return null;
}
