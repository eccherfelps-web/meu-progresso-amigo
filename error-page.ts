// Catálogo de exercícios para busca inteligente e sugestões automáticas.
import type { MuscleGroup } from "./types";

export interface CatalogEntry {
  name: string;
  group: MuscleGroup;
  muscle: string;
  equipment: string;
  kind: "composto" | "isolado";
}

export const MUSCLE_ICON: Record<string, string> = {
  Peito: "🫁",
  Costas: "🦅",
  Ombros: "🪨",
  Bíceps: "💪",
  Tríceps: "🔱",
  Antebraço: "✊",
  Quadríceps: "🦵",
  "Posterior de Coxa": "🦿",
  Panturrilha: "🐐",
  Abdômen: "🧱",
};

export const EXERCISE_CATALOG: CatalogEntry[] = [
  // PUSH
  {
    name: "Supino Reto com Barra",
    group: "push",
    muscle: "Peito",
    equipment: "Barra",
    kind: "composto",
  },
  {
    name: "Supino Inclinado com Halteres",
    group: "push",
    muscle: "Peito",
    equipment: "Halteres",
    kind: "composto",
  },
  {
    name: "Supino Reto com Halteres",
    group: "push",
    muscle: "Peito",
    equipment: "Halteres",
    kind: "composto",
  },
  {
    name: "Crucifixo Inclinado",
    group: "push",
    muscle: "Peito",
    equipment: "Halteres",
    kind: "isolado",
  },
  { name: "Crossover (Polia)", group: "push", muscle: "Peito", equipment: "Cabo", kind: "isolado" },
  {
    name: "Flexão de Braço",
    group: "push",
    muscle: "Peito",
    equipment: "Peso corporal",
    kind: "composto",
  },
  {
    name: "Desenvolvimento Militar",
    group: "push",
    muscle: "Ombros",
    equipment: "Barra",
    kind: "composto",
  },
  {
    name: "Desenvolvimento com Halteres",
    group: "push",
    muscle: "Ombros",
    equipment: "Halteres",
    kind: "composto",
  },
  {
    name: "Elevação Lateral",
    group: "push",
    muscle: "Ombros",
    equipment: "Halteres",
    kind: "isolado",
  },
  {
    name: "Elevação Frontal",
    group: "push",
    muscle: "Ombros",
    equipment: "Halteres",
    kind: "isolado",
  },
  { name: "Tríceps Corda", group: "push", muscle: "Tríceps", equipment: "Cabo", kind: "isolado" },
  {
    name: "Tríceps Francês",
    group: "push",
    muscle: "Tríceps",
    equipment: "Halteres",
    kind: "isolado",
  },
  { name: "Tríceps Testa", group: "push", muscle: "Tríceps", equipment: "Barra", kind: "isolado" },
  {
    name: "Mergulho nas Paralelas",
    group: "push",
    muscle: "Tríceps",
    equipment: "Peso corporal",
    kind: "composto",
  },
  // PULL
  {
    name: "Barra Fixa",
    group: "pull",
    muscle: "Costas",
    equipment: "Peso corporal",
    kind: "composto",
  },
  {
    name: "Puxada Alta (Pulley)",
    group: "pull",
    muscle: "Costas",
    equipment: "Máquina",
    kind: "composto",
  },
  { name: "Remada Curvada", group: "pull", muscle: "Costas", equipment: "Barra", kind: "composto" },
  {
    name: "Remada Baixa (Triângulo)",
    group: "pull",
    muscle: "Costas",
    equipment: "Cabo",
    kind: "composto",
  },
  {
    name: "Remada Unilateral (Serrote)",
    group: "pull",
    muscle: "Costas",
    equipment: "Halteres",
    kind: "composto",
  },
  { name: "Pullover", group: "pull", muscle: "Costas", equipment: "Halteres", kind: "isolado" },
  { name: "Face Pull", group: "pull", muscle: "Ombros", equipment: "Cabo", kind: "isolado" },
  { name: "Rosca Direta", group: "pull", muscle: "Bíceps", equipment: "Barra", kind: "isolado" },
  {
    name: "Rosca Alternada",
    group: "pull",
    muscle: "Bíceps",
    equipment: "Halteres",
    kind: "isolado",
  },
  {
    name: "Rosca Martelo",
    group: "pull",
    muscle: "Bíceps",
    equipment: "Halteres",
    kind: "isolado",
  },
  { name: "Rosca Scott", group: "pull", muscle: "Bíceps", equipment: "Máquina", kind: "isolado" },
  {
    name: "Rosca de Punho",
    group: "pull",
    muscle: "Antebraço",
    equipment: "Barra",
    kind: "isolado",
  },
  {
    name: "Encolhimento de Ombros",
    group: "pull",
    muscle: "Ombros",
    equipment: "Halteres",
    kind: "isolado",
  },
  // LEGS
  {
    name: "Agachamento Livre",
    group: "legs",
    muscle: "Quadríceps",
    equipment: "Barra",
    kind: "composto",
  },
  {
    name: "Leg Press 45",
    group: "legs",
    muscle: "Quadríceps",
    equipment: "Máquina",
    kind: "composto",
  },
  {
    name: "Cadeira Extensora",
    group: "legs",
    muscle: "Quadríceps",
    equipment: "Máquina",
    kind: "isolado",
  },
  {
    name: "Afundo (Passada)",
    group: "legs",
    muscle: "Quadríceps",
    equipment: "Halteres",
    kind: "composto",
  },
  {
    name: "Agachamento Búlgaro",
    group: "legs",
    muscle: "Quadríceps",
    equipment: "Halteres",
    kind: "composto",
  },
  {
    name: "Stiff",
    group: "legs",
    muscle: "Posterior de Coxa",
    equipment: "Barra",
    kind: "composto",
  },
  {
    name: "Mesa Flexora",
    group: "legs",
    muscle: "Posterior de Coxa",
    equipment: "Máquina",
    kind: "isolado",
  },
  {
    name: "Levantamento Terra Romeno",
    group: "legs",
    muscle: "Posterior de Coxa",
    equipment: "Barra",
    kind: "composto",
  },
  {
    name: "Panturrilha em Pé",
    group: "legs",
    muscle: "Panturrilha",
    equipment: "Máquina",
    kind: "isolado",
  },
  {
    name: "Panturrilha Sentado",
    group: "legs",
    muscle: "Panturrilha",
    equipment: "Máquina",
    kind: "isolado",
  },
  {
    name: "Abdominal Supra",
    group: "legs",
    muscle: "Abdômen",
    equipment: "Peso corporal",
    kind: "isolado",
  },
  {
    name: "Prancha",
    group: "legs",
    muscle: "Abdômen",
    equipment: "Peso corporal",
    kind: "isolado",
  },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function searchCatalog(q: string, limit = 6): CatalogEntry[] {
  const n = norm(q.trim());
  if (n.length < 2) return [];
  return EXERCISE_CATALOG.filter((e) => norm(e.name).includes(n)).slice(0, limit);
}
