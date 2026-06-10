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
}

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
