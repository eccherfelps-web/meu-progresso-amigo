// Estimativa de 1RM (uma repetição máxima).
// Epley: 20 kg × 10 reps → 20 × (1 + 10/30) = 26,7 kg
export function epley(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return +(weightKg * (1 + reps / 30)).toFixed(1);
}
export function brzycki(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return +((weightKg * 36) / (37 - Math.min(reps, 36))).toFixed(1);
}
