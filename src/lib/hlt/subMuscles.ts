// Análise anatômica por sub-região muscular (ombros, tríceps, peito na v1.12).
// Em vez de tabela fixa por exercício (que ignora exercícios digitados à mão),
// detectamos a sub-região pelo NOME + ângulo/pegada — funciona para qualquer
// exercício, do catálogo ou personalizado.
//
// Referências biomecânicas: divisões anatômicas clássicas (ExRx.net) e a noção
// de ênfase por ângulo. Isto é uma ESTIMATIVA educada, não eletromiografia:
// a ativação real varia com execução, pegada e anatomia individual.
import type { WorkoutSession } from "./types";

// Sub-regiões cobertas nesta versão (3 grupos).
export const SUB_MUSCLES = [
  // Peito
  "Peito Superior",
  "Peito Médio/Inferior",
  // Ombros
  "Deltoide Anterior",
  "Deltoide Lateral",
  "Deltoide Posterior",
  // Tríceps
  "Tríceps Cabeça Longa",
  "Tríceps Lateral/Medial",
] as const;
export type SubMuscle = (typeof SUB_MUSCLES)[number];

// Grupo "pai" de cada sub-região (para agrupar no relatório).
export const SUB_PARENT: Record<SubMuscle, "Peito" | "Ombros" | "Tríceps"> = {
  "Peito Superior": "Peito",
  "Peito Médio/Inferior": "Peito",
  "Deltoide Anterior": "Ombros",
  "Deltoide Lateral": "Ombros",
  "Deltoide Posterior": "Ombros",
  "Tríceps Cabeça Longa": "Tríceps",
  "Tríceps Lateral/Medial": "Tríceps",
};

export interface Activation {
  sub: SubMuscle;
  factor: number; // 1.0 = alvo principal · 0.3–0.5 = sinergista
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/**
 * Mapa de ativação de um exercício por sub-região, detectado pelo nome.
 * Retorna [] se o exercício não pertence aos 3 grupos cobertos.
 */
export function activationsOf(name: string): Activation[] {
  const n = norm(name);
  const out: Activation[] = [];

  // ---------- PEITO ----------
  const isChest = /supino|crucifixo|cross|voador|peck|flexao|flexão|peito|mergulho|paralela/.test(
    n,
  );
  if (isChest && !/tricep/.test(n) && !/invertid|reverse|reverso|posterior/.test(n)) {
    const inclinado = /inclinad|superior|30|45/.test(n);
    const declinado = /declinad|inferior|paralela|mergulho/.test(n);
    if (inclinado) {
      out.push({ sub: "Peito Superior", factor: 1.0 });
      out.push({ sub: "Peito Médio/Inferior", factor: 0.4 });
      out.push({ sub: "Deltoide Anterior", factor: 0.5 });
      out.push({ sub: "Tríceps Lateral/Medial", factor: 0.3 });
    } else if (declinado) {
      out.push({ sub: "Peito Médio/Inferior", factor: 1.0 });
      out.push({ sub: "Tríceps Lateral/Medial", factor: 0.3 });
    } else {
      // reto / plano / genérico
      out.push({ sub: "Peito Médio/Inferior", factor: 1.0 });
      out.push({ sub: "Peito Superior", factor: 0.4 });
      out.push({ sub: "Deltoide Anterior", factor: 0.35 });
      out.push({ sub: "Tríceps Lateral/Medial", factor: 0.3 });
    }
    return out;
  }

  // ---------- OMBROS ----------
  const isShoulder =
    /desenvolvimento|militar|arnold|eleva|face ?pull|crucifixo invertido|remada alta|encolhimento|ombro|deltoide/.test(
      n,
    );
  if (isShoulder) {
    if (/frontal|frente/.test(n)) {
      out.push({ sub: "Deltoide Anterior", factor: 1.0 });
    } else if (/lateral/.test(n)) {
      out.push({ sub: "Deltoide Lateral", factor: 1.0 });
    } else if (/posterior|invertid|face ?pull|reverse|reverso|crucifixo invertido/.test(n)) {
      out.push({ sub: "Deltoide Posterior", factor: 1.0 });
    } else if (/desenvolvimento|militar|arnold|overhead/.test(n)) {
      // pressões acima da cabeça: anterior domina, lateral participa
      out.push({ sub: "Deltoide Anterior", factor: 1.0 });
      out.push({ sub: "Deltoide Lateral", factor: 0.5 });
      out.push({ sub: "Tríceps Cabeça Longa", factor: 0.4 });
    } else if (/encolhimento/.test(n)) {
      // trapézio — fora do escopo das 3 regiões; ignora
      return out;
    } else {
      out.push({ sub: "Deltoide Lateral", factor: 0.7 });
    }
    return out;
  }

  // ---------- TRÍCEPS ----------
  const isTriceps =
    /tricep|frances|francês|testa|pulley|corda|coice|extensao.*cotovelo|paralela|mergulho/.test(n);
  if (isTriceps) {
    // braço acima da cabeça (francês/testa) enfatiza a cabeça longa
    if (/frances|francês|testa|overhead|acima|sobre a cabeca|katana/.test(n)) {
      out.push({ sub: "Tríceps Cabeça Longa", factor: 1.0 });
      out.push({ sub: "Tríceps Lateral/Medial", factor: 0.5 });
    } else {
      // pulley/corda/coice: braço ao lado do corpo → lateral/medial
      out.push({ sub: "Tríceps Lateral/Medial", factor: 1.0 });
      out.push({ sub: "Tríceps Cabeça Longa", factor: 0.3 });
    }
    return out;
  }

  return out;
}

export interface SubMuscleStat {
  sub: SubMuscle;
  parent: "Peito" | "Ombros" | "Tríceps";
  directSets: number; // séries com este alvo como principal (factor >= 0.9)
  effectiveSets: number; // séries ponderadas pelo fator (inclui sinergia)
  volume: number; // volume ponderado (kg)
}

/** Estatísticas por sub-região nos últimos `days` dias. */
export function subMuscleStats(sessions: WorkoutSession[], days = 7): SubMuscleStat[] {
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  const acc = new Map<SubMuscle, { direct: number; eff: number; vol: number }>();
  for (const s of sessions) {
    if (new Date(s.date).getTime() <= cutoff) continue;
    for (const ex of s.exercises) {
      const acts = activationsOf(ex.name);
      if (acts.length === 0) continue;
      const exVol = ex.sets.reduce((a, st) => a + st.weight_kg * st.reps, 0);
      for (const a of acts) {
        const cur = acc.get(a.sub) ?? { direct: 0, eff: 0, vol: 0 };
        cur.eff += ex.sets.length * a.factor;
        cur.vol += exVol * a.factor;
        if (a.factor >= 0.9) cur.direct += ex.sets.length;
        acc.set(a.sub, cur);
      }
    }
  }
  return SUB_MUSCLES.map((sub) => {
    const v = acc.get(sub) ?? { direct: 0, eff: 0, vol: 0 };
    return {
      sub,
      parent: SUB_PARENT[sub],
      directSets: v.direct,
      effectiveSets: +v.eff.toFixed(1),
      volume: Math.round(v.vol),
    };
  });
}

export interface BlindSpot {
  sub: SubMuscle;
  parent: string;
  directSets: number;
  severity: "crítico" | "atenção";
  message: string;
}

// Sugestões concretas de exercício por sub-região negligenciada.
const FIX: Record<SubMuscle, string> = {
  "Peito Superior": "adicione Supino Inclinado (halteres ou barra)",
  "Peito Médio/Inferior": "adicione Supino Reto ou Crossover",
  "Deltoide Anterior": "adicione Desenvolvimento ou Elevação Frontal",
  "Deltoide Lateral": "adicione Elevação Lateral",
  "Deltoide Posterior": "adicione Face Pull ou Crucifixo Invertido",
  "Tríceps Cabeça Longa": "adicione Tríceps Testa ou Francês (braço acima da cabeça)",
  "Tríceps Lateral/Medial": "adicione Tríceps Pulley/Corda",
};

/**
 * Detecta pontos cegos: sub-regiões com pouco/nenhum trabalho DIRETO enquanto
 * o grupo pai foi treinado. É o alerta anti-assimetria.
 */
export function findBlindSpots(stats: SubMuscleStat[]): BlindSpot[] {
  const spots: BlindSpot[] = [];
  // volume direto por grupo pai — só alerta se o grupo foi treinado
  const parentSets: Record<string, number> = {};
  for (const s of stats) parentSets[s.parent] = (parentSets[s.parent] ?? 0) + s.directSets;

  for (const s of stats) {
    if (parentSets[s.parent] < 3) continue; // grupo mal treinado: não cobra sub-região
    if (s.directSets === 0) {
      spots.push({
        sub: s.sub,
        parent: s.parent,
        directSets: 0,
        severity: "crítico",
        message: `0 séries diretas de ${s.sub} — ${FIX[s.sub]}.`,
      });
    } else if (s.directSets < 2 && s.effectiveSets < 4) {
      spots.push({
        sub: s.sub,
        parent: s.parent,
        directSets: s.directSets,
        severity: "atenção",
        message: `Só ${s.directSets} série(s) de ${s.sub} — ${FIX[s.sub]}.`,
      });
    }
  }
  return spots;
}
