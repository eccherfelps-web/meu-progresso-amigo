// Classificação de exercícios por músculo + estatísticas semanais + equilíbrio.
import type { WorkoutSession } from "./types";

export const MUSCLES = [
  "Peito",
  "Costas",
  "Ombros",
  "Bíceps",
  "Tríceps",
  "Antebraço",
  "Quadríceps",
  "Posterior de Coxa",
  "Panturrilha",
  "Abdômen",
] as const;
export type Muscle = (typeof MUSCLES)[number] | "Outros";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Classifica um exercício pelo nome (pt-BR). Ordem importa nos casos ambíguos. */
export function muscleOf(name: string): Muscle {
  const n = norm(name);
  if (/punho|antebrac/.test(n)) return "Antebraço";
  if (/panturr|gemeo/.test(n)) return "Panturrilha";
  if (/stiff|flexora|posterior|romeno|nordic|terra/.test(n)) return "Posterior de Coxa";
  if (/agach|leg ?press|extensora|afundo|bulgaro|hack|passada/.test(n)) return "Quadríceps";
  if (/abdom|prancha|crunch|infra|supra/.test(n)) return "Abdômen";
  if (/tricep|frances|testa|mergulho|paralela|coice/.test(n)) return "Tríceps";
  if (/rosca|martelo|scott|biceps/.test(n)) return "Bíceps";
  if (/supino|crucifixo|cross|voador|peck|flexao/.test(n)) return "Peito";
  if (/remada|puxada|barra fixa|pulldown|pullover|serrote/.test(n)) return "Costas";
  if (/desenvolvimento|eleva|arnold|face ?pull|militar|encolhimento/.test(n)) return "Ombros";
  return "Outros";
}

export interface MuscleStat {
  muscle: Muscle;
  sets: number;
  volume: number;
  pct: number;
}

/** Séries, volume (kg) e % por músculo nos últimos `days` dias. */
export function weeklyMuscleStats(sessions: WorkoutSession[], days = 7): MuscleStat[] {
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  const acc = new Map<Muscle, { sets: number; volume: number }>();
  for (const s of sessions) {
    if (new Date(s.date).getTime() <= cutoff) continue;
    for (const ex of s.exercises) {
      const m = muscleOf(ex.name);
      const cur = acc.get(m) ?? { sets: 0, volume: 0 };
      cur.sets += ex.sets.length;
      cur.volume += ex.sets.reduce((a, st) => a + st.weight_kg * st.reps, 0);
      acc.set(m, cur);
    }
  }
  const total = [...acc.values()].reduce((a, v) => a + v.volume, 0) || 1;
  const order: Muscle[] = [...MUSCLES, "Outros"];
  return order
    .filter((m) => acc.has(m))
    .map((m) => {
      const v = acc.get(m)!;
      return {
        muscle: m,
        sets: v.sets,
        volume: Math.round(v.volume),
        pct: Math.round((v.volume / total) * 100),
      };
    });
}

export interface BalancePair {
  label: string;
  a: { name: string; volume: number };
  b: { name: string; volume: number };
  ratio: number | null; // a/b
  ideal: [number, number];
  ok: boolean;
  suggestion: string | null;
}
export interface BalanceReport {
  score: number;
  pairs: BalancePair[];
}

/** Equilíbrio muscular: pares antagonistas + score 0–100. */
export function muscleBalance(stats: MuscleStat[]): BalanceReport {
  const vol = (m: Muscle) => stats.find((s) => s.muscle === m)?.volume ?? 0;
  const sum = (...ms: Muscle[]) => ms.reduce((a, m) => a + vol(m), 0);

  const defs: {
    label: string;
    a: [string, number];
    b: [string, number];
    ideal: [number, number];
    low: string;
    high: string;
  }[] = [
    {
      label: "Peito × Costas",
      a: ["Peito", vol("Peito")],
      b: ["Costas", vol("Costas")],
      ideal: [0.8, 1.25],
      low: "Costas dominando — adicione 2–4 séries de supino/crucifixo.",
      high: "Peito dominando — adicione 2–4 séries de remada/puxada para proteger os ombros.",
    },
    {
      label: "Quadríceps × Posterior",
      a: ["Quadríceps", vol("Quadríceps")],
      b: ["Posterior", vol("Posterior de Coxa")],
      ideal: [0.9, 1.7],
      low: "Posterior dominando — inclua mais agachamento/leg press.",
      high: "Quadríceps dominando — adicione stiff/mesa flexora (previne lesão de joelho).",
    },
    {
      label: "Bíceps × Tríceps",
      a: ["Bíceps", vol("Bíceps")],
      b: ["Tríceps", vol("Tríceps")],
      ideal: [0.6, 1.4],
      low: "Tríceps dominando — 2 séries extras de rosca resolvem.",
      high: "Bíceps dominando — adicione tríceps corda/francês.",
    },
    {
      label: "Empurrar × Puxar",
      a: ["Empurrar", sum("Peito", "Ombros", "Tríceps")],
      b: ["Puxar", sum("Costas", "Bíceps", "Antebraço")],
      ideal: [0.8, 1.3],
      low: "Volume de puxar maior — equilibre com mais empurrões.",
      high: "Volume de empurrar maior — mais remadas/puxadas equilibram a postura.",
    },
  ];

  const pairs: BalancePair[] = [];
  let penalty = 0,
    evaluated = 0;
  for (const d of defs) {
    const [an, av] = d.a,
      [bn, bv] = d.b;
    if (av === 0 && bv === 0) continue; // sem dados deste par na semana
    let ratio: number | null = null,
      ok = true,
      suggestion: string | null = null;
    if (av === 0 || bv === 0) {
      ok = false;
      suggestion =
        av === 0
          ? `Nenhum volume de ${an} esta semana — ${d.low}`
          : `Nenhum volume de ${bn} esta semana — ${d.high}`;
      penalty += 25;
    } else {
      ratio = +(av / bv).toFixed(2);
      ok = ratio >= d.ideal[0] && ratio <= d.ideal[1];
      if (!ok) {
        suggestion = ratio < d.ideal[0] ? d.low : d.high;
        const dev = ratio < d.ideal[0] ? d.ideal[0] / ratio : ratio / d.ideal[1];
        penalty += Math.min(25, Math.round((dev - 1) * 50));
      }
    }
    evaluated++;
    pairs.push({
      label: d.label,
      a: { name: an, volume: av },
      b: { name: bn, volume: bv },
      ratio,
      ideal: d.ideal,
      ok,
      suggestion,
    });
  }
  const score = evaluated === 0 ? 100 : Math.max(0, 100 - penalty);
  return { score, pairs };
}
