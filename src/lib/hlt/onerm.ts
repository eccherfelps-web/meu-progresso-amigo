// Estimativa de 1RM (uma repetição máxima).
// Epley: 20 kg × 10 reps → 20 × (1 + 10/30) = 26,7 kg
export function epley(weightKg: number, reps: number): number {
  if (weightKg <= 0) return 0;
  if (reps <= 1) return weightKg;
  return +(weightKg * (1 + reps / 30)).toFixed(1);
}
export function brzycki(weightKg: number, reps: number): number {
  if (weightKg <= 0) return 0;
  if (reps <= 1) return weightKg;
  return +((weightKg * 36) / (37 - Math.min(reps, 36))).toFixed(1);
}

// Fração do peso corporal efetivamente movida em cada exercício de peso
// corporal. Paralela/barra usam ~100%; flexão e tríceps no banco, menos.
export function bodyweightFactor(name: string): number {
  const n = name.toLowerCase();
  if (/flex(ã|a)o|push.?up/.test(n)) return 0.66; // flexão de braço
  if (/tr(í|i)ceps.*banco|bench dip/.test(n)) return 0.4;
  return 1.0; // paralela, barra fixa, mergulho, etc.
}

// Carga total de uma série: para exercício de peso corporal soma a fração do
// peso do corpo (da época) ao peso adicional digitado.
export function effectiveLoad(
  weightKg: number,
  opts?: { bodyweight?: boolean; bodyweightKg?: number; exerciseName?: string },
): number {
  if (!opts?.bodyweight || !opts.bodyweightKg) return weightKg;
  const factor = bodyweightFactor(opts.exerciseName ?? "");
  return +(opts.bodyweightKg * factor + weightKg).toFixed(1);
}

// 1RM já considerando peso corporal quando aplicável.
export function oneRepMax(
  weightKg: number,
  reps: number,
  opts?: { bodyweight?: boolean; bodyweightKg?: number; exerciseName?: string },
): number {
  return epley(effectiveLoad(weightKg, opts), reps);
}
