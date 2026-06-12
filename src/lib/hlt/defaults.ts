import type { Exercise, FoodDb, Profile } from "./types";

export const DEFAULT_PROFILE: Profile = {
  name: "Felps",
  age: 19,
  height_cm: 171,
  weight_current_kg: 58,
  weight_goal_kg: 62,
  goal_type: "clean_bulk",
  fat_daily_limit_g: 50,
  training_days_per_week: 5,
  activity_level: "very_active",
  theme: "dark",
};

export const DEFAULT_EXERCISES: Exercise[] = [
  // PUSH
  {
    id: "p1",
    name: "Supino Inclinado com Halteres",
    group: "push",
    sets: 4,
    reps: "8-12",
    load_kg: 16,
  },
  {
    id: "p2",
    name: "Supino Reto com Halteres",
    group: "push",
    sets: 3,
    reps: "10-12",
    load_kg: null,
  },
  { id: "p3", name: "Crossover / Voador", group: "push", sets: 3, reps: "12-15", load_kg: null },
  {
    id: "p4",
    name: "Desenvolvimento com Halteres",
    group: "push",
    sets: 4,
    reps: "8-12",
    load_kg: null,
  },
  { id: "p5", name: "Elevação Lateral", group: "push", sets: 4, reps: "12-15", load_kg: null },
  {
    id: "p6",
    name: "Extensão de Tríceps com Halter (Testa)",
    group: "push",
    sets: 3,
    reps: "10-12",
    load_kg: null,
  },
  {
    id: "p7",
    name: "Pulley Tríceps (corda)",
    group: "push",
    sets: 3,
    reps: "12-15",
    load_kg: null,
  },
  // PULL
  {
    id: "pl1",
    name: "Puxada Frontal / Barra Fixa",
    group: "pull",
    sets: 4,
    reps: "8-12",
    load_kg: null,
  },
  {
    id: "pl2",
    name: "Remada Sentada no Cabo",
    group: "pull",
    sets: 3,
    reps: "10-12",
    load_kg: null,
  },
  {
    id: "pl3",
    name: "Remada Unilateral com Halter",
    group: "pull",
    sets: 3,
    reps: "10-12",
    load_kg: null,
  },
  { id: "pl4", name: "Face Pull", group: "pull", sets: 3, reps: "15", load_kg: null },
  {
    id: "pl5",
    name: "Rosca Direta (Barra EZ)",
    group: "pull",
    sets: 4,
    reps: "10-12",
    load_kg: null,
  },
  { id: "pl6", name: "Rosca Martelo", group: "pull", sets: 3, reps: "12", load_kg: null },
  {
    id: "pl7",
    name: "Rosca de Punho (sábado)",
    group: "pull",
    sets: 3,
    reps: "15",
    load_kg: null,
    slot: 1,
  },
  // LEGS
  { id: "l1", name: "Leg Press 45°", group: "legs", sets: 4, reps: "10-12", load_kg: null },
  { id: "l2", name: "Agachamento Livre", group: "legs", sets: 4, reps: "8-10", load_kg: null },
  { id: "l3", name: "Cadeira Extensora", group: "legs", sets: 3, reps: "12-15", load_kg: null },
  {
    id: "l4",
    name: "Levantamento Terra Romeno",
    group: "legs",
    sets: 4,
    reps: "10-12",
    load_kg: null,
  },
  { id: "l5", name: "Mesa Flexora", group: "legs", sets: 3, reps: "12-15", load_kg: null },
  {
    id: "l6",
    name: "Panturrilha em Pé (Máquina)",
    group: "legs",
    sets: 4,
    reps: "15-20",
    load_kg: null,
  },
];

// per 100g
export const FOOD_DB: FoodDb[] = [
  { name: "Arroz branco cozido", kcal: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3 },
  { name: "Feijão carioca cozido", kcal: 76, protein_g: 4.8, carbs_g: 13.6, fat_g: 0.5 },
  { name: "Frango grelhado (peito)", kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 },
  { name: "Ovo inteiro", kcal: 155, protein_g: 13, carbs_g: 1.1, fat_g: 11 },
  { name: "Clara de ovo", kcal: 52, protein_g: 11, carbs_g: 0.7, fat_g: 0.2 },
  { name: "Batata-doce cozida", kcal: 86, protein_g: 1.6, carbs_g: 20, fat_g: 0.1 },
  { name: "Aveia em flocos", kcal: 389, protein_g: 16.9, carbs_g: 66, fat_g: 6.9 },
  { name: "Whey protein (1 scoop ~30g)", kcal: 120, protein_g: 24, carbs_g: 3, fat_g: 2 },
  { name: "Banana", kcal: 89, protein_g: 1.1, carbs_g: 23, fat_g: 0.3 },
  { name: "Pão integral", kcal: 247, protein_g: 13, carbs_g: 41, fat_g: 3.4 },
  { name: "Queijo cottage", kcal: 98, protein_g: 11, carbs_g: 3.4, fat_g: 4.3 },
  { name: "Iogurte grego natural", kcal: 97, protein_g: 9, carbs_g: 3.6, fat_g: 5 },
  { name: "Atum em lata (água)", kcal: 116, protein_g: 26, carbs_g: 0, fat_g: 1 },
  { name: "Batata cozida", kcal: 87, protein_g: 1.9, carbs_g: 20, fat_g: 0.1 },
  { name: "Macarrão cozido", kcal: 131, protein_g: 5, carbs_g: 25, fat_g: 1.1 },
  { name: "Carne moída (patinho)", kcal: 200, protein_g: 26, carbs_g: 0, fat_g: 10 },
  { name: "Filé de tilápia", kcal: 96, protein_g: 20, carbs_g: 0, fat_g: 1.7 },
  { name: "Leite desnatado", kcal: 35, protein_g: 3.4, carbs_g: 5, fat_g: 0.1 },
  { name: "Azeite de oliva", kcal: 884, protein_g: 0, carbs_g: 0, fat_g: 100 },
  { name: "Amendoim", kcal: 567, protein_g: 26, carbs_g: 16, fat_g: 49 },
];

export const WEEK_PLAN: Record<number, "push" | "pull" | "legs" | "rest"> = {
  0: "rest", // sunday
  1: "push", // monday
  2: "pull", // tuesday
  3: "legs", // wednesday
  4: "rest", // thursday
  5: "push", // friday
  6: "pull", // saturday
};

export const GROUP_LABEL: Record<"push" | "pull" | "legs" | "rest", string> = {
  push: "Push (Peito • Ombros • Tríceps)",
  pull: "Pull (Costas • Bíceps)",
  legs: "Legs (Pernas)",
  rest: "Descanso",
};

// ── Cronograma semanal dinâmico ──
// O usuário pode reorganizar a semana (ex.: trocar Pull e Legs de dia);
// os exercícios seguem o GRUPO automaticamente, preservando histórico e stats.
import type { WeekSchedule } from "./types";

export const DEFAULT_SCHEDULE: WeekSchedule = [
  "rest",
  "push",
  "pull",
  "legs",
  "rest",
  "push",
  "pull",
];

export const DOW_LABEL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const DOW_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const GROUP_FOCUS: Record<"push" | "pull" | "legs", string> = {
  push: "Peito • Ombros • Tríceps",
  pull: "Costas • Bíceps • Antebraço",
  legs: "Pernas • Panturrilha",
};

export interface TrainingDay {
  dow: number; // 0=Dom … 6=Sáb
  short: string;
  label: string;
  group: "push" | "pull" | "legs";
  focus: string;
  occurrence: number; // 0 = 1ª vez do grupo na semana, 1 = 2ª…
}

/** Converte o cronograma em dias de treino (ignora descansos). */
export function daysFromSchedule(schedule: WeekSchedule): TrainingDay[] {
  const count: Record<string, number> = {};
  const out: TrainingDay[] = [];
  for (let dow = 0; dow < 7; dow++) {
    const g = schedule[dow];
    if (g === "rest" || !g) continue;
    const occurrence = count[g] ?? 0;
    count[g] = occurrence + 1;
    out.push({
      dow,
      short: DOW_SHORT[dow],
      label: DOW_LABEL[dow],
      group: g,
      focus: GROUP_FOCUS[g],
      occurrence,
    });
  }
  return out;
}

export const TRAINING_DAYS: TrainingDay[] = daysFromSchedule(DEFAULT_SCHEDULE);

export function exercisesForDay(all: Exercise[], day: TrainingDay): Exercise[] {
  return all
    .filter((e) => e.group === day.group && (e.slot == null || e.slot === day.occurrence))
    .sort((a, b) => Number(b.fav ?? false) - Number(a.fav ?? false));
}
