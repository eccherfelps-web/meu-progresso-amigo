import type { Profile } from "./types";

export interface Macros {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export function bmr(p: Profile): number {
  return 10 * p.weight_current_kg + 6.25 * p.height_cm - 5 * p.age + 5;
}

export function activityFactor(level: Profile["activity_level"]): number {
  switch (level) {
    case "sedentary":
      return 1.2;
    case "light":
      return 1.375;
    case "moderate":
      return 1.55;
    case "active":
      return 1.725;
    case "very_active":
      return 1.725;
  }
}

export function tdee(p: Profile): number {
  return Math.round(bmr(p) * activityFactor(p.activity_level));
}

export function dailyMacros(p: Profile, isRestDay = false): Macros {
  const base = tdee(p);
  const surplus =
    p.goal_type === "clean_bulk" ? (isRestDay ? 0 : 300) : p.goal_type === "cut" ? -400 : 0;
  const kcal = base + surplus;
  const protein_g = Math.round(2.2 * p.weight_current_kg);
  const fat_g = p.fat_daily_limit_g;
  const remaining = kcal - protein_g * 4 - fat_g * 9;
  const carbs_g = Math.max(0, Math.round(remaining / 4));
  return { kcal, protein_g, carbs_g, fat_g };
}

/** Converte uma data para "YYYY-MM-DD" no fuso LOCAL do usuário.
 *  Usar isto em vez de toISOString() (que é UTC e adianta/atrasa o dia para
 *  quem não está em UTC — ex.: Brasil UTC-3, um treino às 21h virava o dia
 *  seguinte). */
export function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO(): string {
  return toLocalISO(new Date());
}

/** Extrai "YYYY-MM-DD" LOCAL de um timestamp ISO salvo (ex.: data de sessão).
 *  Se a string já for só data (10 chars), retorna como está. */
export function localDayOf(isoTimestamp: string): string {
  if (isoTimestamp.length <= 10) return isoTimestamp;
  return toLocalISO(new Date(isoTimestamp));
}

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}
