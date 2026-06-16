export type GoalType = "clean_bulk" | "cut" | "maintain";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

export interface Profile {
  name: string;
  age: number;
  height_cm: number;
  weight_current_kg: number;
  weight_goal_kg: number;
  goal_type: GoalType;
  fat_daily_limit_g: number;
  training_days_per_week: number;
  activity_level: ActivityLevel;
  theme?: "dark" | "light";
  /** Alerta sonoro ao fim do descanso. */
  rest_sound_enabled?: boolean; // padrão: true
  rest_sound_type?: "beep" | "sino" | "digital";
  rest_sound_volume?: number; // 0–1
}

export type MuscleGroup = "push" | "pull" | "legs";

export interface Exercise {
  id: string;
  name: string;
  group: MuscleGroup;
  sets: number;
  reps: string;
  load_kg?: number | null;
  notes?: string;
  /** (legado) dias fixos da semana — substituído por `slot`. */
  days?: number[];
  /** Em qual ocorrência do grupo na semana o exercício aparece
   *  (0 = 1º dia do grupo, 1 = 2º dia). Ausente = todos. */
  slot?: number;
  /** Músculo principal/secundário (ex.: "Peito", "Tríceps"). */
  muscle?: string;
  muscle2?: string;
  /** Descanso sugerido entre séries (segundos). */
  rest_s?: number;
  kind?: "composto" | "isolado";
  equipment?: string;
  fav?: boolean;
  /** Ordem manual dentro do grupo (menor = primeiro). */
  order?: number;
}

/** Cronograma semanal editável: índice 0=Dom … 6=Sáb. */
export type TrainingGroup = "push" | "pull" | "legs";
/** Cada dia (0=Dom…6=Sáb) pode ter 0, 1 ou vários grupos.
 *  Formatos aceitos por dia: "rest" | um grupo | array de grupos.
 *  (Compatível com o formato antigo de string única.) */
export type DaySchedule = "rest" | TrainingGroup | TrainingGroup[];
export type WeekSchedule = DaySchedule[];

export interface WorkoutSet {
  weight_kg: number;
  reps: number;
}

export interface SessionExercise {
  exercise_id: string;
  name: string;
  group: MuscleGroup;
  sets: WorkoutSet[];
}

export interface WorkoutSession {
  id: string;
  date: string; // ISO
  type: MuscleGroup;
  duration_min: number;
  exercises: SessionExercise[];
  prs?: { exercise: string; type: "weight" | "reps"; value: number }[];
}

export interface WeightLog {
  date: string; // YYYY-MM-DD
  weight_kg: number;
}

export interface FoodItem {
  name: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export type MealKey = "breakfast" | "lunch" | "preworkout" | "dinner" | "snacks";

export interface FoodLog {
  date: string; // YYYY-MM-DD
  meals: Record<MealKey, FoodItem[]>;
}

export interface HydrationLog {
  date: string;
  cups: number;
}

export interface BodyMeasure {
  date: string;
  chest_cm?: number;
  waist_cm?: number;
  arms_cm?: number;
  thighs_cm?: number;
}

export interface Assessment {
  weeks_training: number;
  progressive_overload: "always" | "sometimes" | "no";
  sleep_quality: number; // 1-5
  recovery: "great" | "good" | "regular" | "tired";
  challenge: string;
  joint_discomfort: string;
}

export interface FoodDb {
  name: string;
  kcal: number; // per 100g
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}
