// Análise anatômica por sub-região muscular (corpo inteiro, v1.13).
// Detecta a sub-região pelo NOME + ângulo/pegada — funciona para qualquer
// exercício, do catálogo ou digitado à mão.
//
// Referências biomecânicas: divisões anatômicas clássicas (ExRx.net) e ênfase
// por ângulo/pegada. É uma ESTIMATIVA educada, não eletromiografia: a ativação
// real varia com execução, pegada e anatomia individual.
import type { WorkoutSession } from "./types";

// Sub-regiões, agrupadas por grupo pai (a ordem define a exibição).
export const SUB_MUSCLES = [
  // Peito
  "Peito Superior",
  "Peito Médio/Inferior",
  // Costas
  "Dorsal (Largura)",
  "Trapézio/Romboides (Espessura)",
  "Lombar",
  // Ombros
  "Deltoide Anterior",
  "Deltoide Lateral",
  "Deltoide Posterior",
  "Trapézio Superior",
  // Bíceps & antebraço
  "Bíceps Cabeça Longa",
  "Bíceps Cabeça Curta",
  "Braquial/Braquiorradial",
  "Antebraço (Flexores)",
  // Tríceps
  "Tríceps Cabeça Longa",
  "Tríceps Lateral/Medial",
  // Pernas
  "Quadríceps",
  "Posterior de Coxa",
  "Glúteo",
  "Panturrilha",
  // Core
  "Abdômen",
] as const;
export type SubMuscle = (typeof SUB_MUSCLES)[number];

export type ParentGroup = "Peito" | "Costas" | "Ombros" | "Bíceps" | "Tríceps" | "Pernas" | "Core";

export const SUB_PARENT: Record<SubMuscle, ParentGroup> = {
  "Peito Superior": "Peito",
  "Peito Médio/Inferior": "Peito",
  "Dorsal (Largura)": "Costas",
  "Trapézio/Romboides (Espessura)": "Costas",
  Lombar: "Costas",
  "Deltoide Anterior": "Ombros",
  "Deltoide Lateral": "Ombros",
  "Deltoide Posterior": "Ombros",
  "Trapézio Superior": "Ombros",
  "Bíceps Cabeça Longa": "Bíceps",
  "Bíceps Cabeça Curta": "Bíceps",
  "Braquial/Braquiorradial": "Bíceps",
  "Antebraço (Flexores)": "Bíceps",
  "Tríceps Cabeça Longa": "Tríceps",
  "Tríceps Lateral/Medial": "Tríceps",
  Quadríceps: "Pernas",
  "Posterior de Coxa": "Pernas",
  Glúteo: "Pernas",
  Panturrilha: "Pernas",
  Abdômen: "Core",
};

export const PARENT_ORDER: ParentGroup[] = [
  "Peito",
  "Costas",
  "Ombros",
  "Bíceps",
  "Tríceps",
  "Pernas",
  "Core",
];

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
 * Retorna [] se não reconhecer o exercício.
 */
export function activationsOf(name: string): Activation[] {
  const n = norm(name);
  const out: Activation[] = [];

  // ---------- PEITO ----------
  const isChest = /supino|crucifixo|cross|voador|peck|flexao|flexão|peito|mergulho|paralela/.test(
    n,
  );
  if (isChest && !/tricep/.test(n) && !/invertid|reverse|reverso/.test(n)) {
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
      out.push({ sub: "Peito Médio/Inferior", factor: 1.0 });
      out.push({ sub: "Peito Superior", factor: 0.4 });
      out.push({ sub: "Deltoide Anterior", factor: 0.35 });
      out.push({ sub: "Tríceps Lateral/Medial", factor: 0.3 });
    }
    return out;
  }

  // ---------- COSTAS ----------
  const isBack =
    /puxada|pulldown|barra fixa|remada|pullover|serrote|dorsal|terra|levantamento/.test(n);
  // exceção: terra ROMENO e stiff são de posterior de coxa (tratados em pernas)
  const isRomanianDeadlift = /romeno|stiff/.test(n);
  if (isBack && !isRomanianDeadlift && !/tricep|rosca|frances/.test(n)) {
    // levantamento terra / stiff → lombar + posterior + glúteo (tratado em pernas)
    if (/terra|deadlift/.test(n) && !/romeno|stiff/.test(n)) {
      out.push({ sub: "Lombar", factor: 1.0 });
      out.push({ sub: "Trapézio/Romboides (Espessura)", factor: 0.5 });
      out.push({ sub: "Glúteo", factor: 0.5 });
      out.push({ sub: "Posterior de Coxa", factor: 0.5 });
      return out;
    }
    // puxadas verticais (barra fixa, pulldown) → largura (dorsal)
    if (/puxada|pulldown|barra fixa|pull.?up/.test(n)) {
      out.push({ sub: "Dorsal (Largura)", factor: 1.0 });
      out.push({ sub: "Bíceps Cabeça Longa", factor: 0.4 });
      out.push({ sub: "Trapézio/Romboides (Espessura)", factor: 0.3 });
      return out;
    }
    // pullover → dorsal com peito
    if (/pullover/.test(n)) {
      out.push({ sub: "Dorsal (Largura)", factor: 1.0 });
      out.push({ sub: "Peito Médio/Inferior", factor: 0.3 });
      return out;
    }
    // remadas horizontais → espessura (trapézio/romboides) + dorsal
    out.push({ sub: "Trapézio/Romboides (Espessura)", factor: 1.0 });
    out.push({ sub: "Dorsal (Largura)", factor: 0.6 });
    out.push({ sub: "Deltoide Posterior", factor: 0.4 });
    out.push({ sub: "Bíceps Cabeça Longa", factor: 0.35 });
    return out;
  }

  // ---------- OMBROS ----------
  const isShoulder =
    /desenvolvimento|militar|arnold|eleva|face ?pull|crucifixo invertido|remada alta|encolhimento|ombro|deltoide|overhead/.test(
      n,
    );
  if (isShoulder) {
    if (/encolhimento|shrug/.test(n)) {
      out.push({ sub: "Trapézio Superior", factor: 1.0 });
      return out;
    }
    if (/frontal|frente/.test(n)) {
      out.push({ sub: "Deltoide Anterior", factor: 1.0 });
    } else if (/lateral/.test(n) && !/remada/.test(n)) {
      out.push({ sub: "Deltoide Lateral", factor: 1.0 });
    } else if (/posterior|invertid|face ?pull|reverse|reverso/.test(n)) {
      out.push({ sub: "Deltoide Posterior", factor: 1.0 });
      out.push({ sub: "Trapézio/Romboides (Espessura)", factor: 0.4 });
    } else if (/remada alta/.test(n)) {
      out.push({ sub: "Deltoide Lateral", factor: 1.0 });
      out.push({ sub: "Trapézio Superior", factor: 0.5 });
    } else if (/desenvolvimento|militar|arnold|overhead/.test(n)) {
      out.push({ sub: "Deltoide Anterior", factor: 1.0 });
      out.push({ sub: "Deltoide Lateral", factor: 0.5 });
      out.push({ sub: "Tríceps Cabeça Longa", factor: 0.4 });
    } else {
      out.push({ sub: "Deltoide Lateral", factor: 1.0 });
    }
    return out;
  }

  // ---------- BÍCEPS & ANTEBRAÇO ----------
  const isBiceps = /rosca|biceps|bíceps|martelo|scott|punho|antebrac|braquial/.test(n);
  if (isBiceps) {
    if (/punho|antebrac|flexor.*punho/.test(n)) {
      out.push({ sub: "Antebraço (Flexores)", factor: 1.0 });
      return out;
    }
    if (/martelo|hammer|neutr|invertid/.test(n)) {
      out.push({ sub: "Braquial/Braquiorradial", factor: 1.0 });
      out.push({ sub: "Bíceps Cabeça Longa", factor: 0.4 });
      out.push({ sub: "Antebraço (Flexores)", factor: 0.3 });
      return out;
    }
    if (/scott|banco.*scott|concentrad/.test(n)) {
      // cotovelo à frente → cabeça curta
      out.push({ sub: "Bíceps Cabeça Curta", factor: 1.0 });
      out.push({ sub: "Bíceps Cabeça Longa", factor: 0.4 });
      return out;
    }
    if (/inclinad|banco inclinad/.test(n)) {
      // cotovelo atrás do corpo → cabeça longa
      out.push({ sub: "Bíceps Cabeça Longa", factor: 1.0 });
      out.push({ sub: "Bíceps Cabeça Curta", factor: 0.4 });
      return out;
    }
    // rosca direta/alternada genérica: trabalha o bíceps como um todo
    out.push({ sub: "Bíceps Cabeça Longa", factor: 1.0 });
    out.push({ sub: "Bíceps Cabeça Curta", factor: 1.0 });
    out.push({ sub: "Braquial/Braquiorradial", factor: 0.3 });
    return out;
  }

  // ---------- TRÍCEPS ----------
  const isTriceps =
    /tricep|frances|francês|testa|pulley|corda|coice|extensao.*cotovelo|paralela|mergulho/.test(n);
  if (isTriceps) {
    if (/frances|francês|testa|overhead|acima|sobre a cabeca|katana/.test(n)) {
      out.push({ sub: "Tríceps Cabeça Longa", factor: 1.0 });
      out.push({ sub: "Tríceps Lateral/Medial", factor: 0.5 });
    } else {
      out.push({ sub: "Tríceps Lateral/Medial", factor: 1.0 });
      out.push({ sub: "Tríceps Cabeça Longa", factor: 0.3 });
    }
    return out;
  }

  // ---------- PERNAS ----------
  if (/stiff|romeno|mesa flexora|flexora|posterior|nordic/.test(n)) {
    out.push({ sub: "Posterior de Coxa", factor: 1.0 });
    out.push({ sub: "Glúteo", factor: 0.5 });
    if (/stiff|romeno/.test(n)) out.push({ sub: "Lombar", factor: 0.4 });
    return out;
  }
  if (/agach|leg ?press|extensora|afundo|bulgaro|búlgaro|hack|passada|avanco|avanço/.test(n)) {
    out.push({ sub: "Quadríceps", factor: 1.0 });
    out.push({ sub: "Glúteo", factor: 0.5 });
    if (/afundo|bulgaro|búlgaro|passada|avanco|avanço/.test(n))
      out.push({ sub: "Posterior de Coxa", factor: 0.3 });
    return out;
  }
  if (/gluteo|glúteo|eleva.*quadril|hip thrust|coice.*gluteo/.test(n)) {
    out.push({ sub: "Glúteo", factor: 1.0 });
    out.push({ sub: "Posterior de Coxa", factor: 0.4 });
    return out;
  }
  if (/panturr|gemeo|gêmeo|soleo|sóleo|calf/.test(n)) {
    out.push({ sub: "Panturrilha", factor: 1.0 });
    return out;
  }

  // ---------- CORE ----------
  if (/abdom|prancha|crunch|infra|supra|core|obliquo|oblíquo|prancha/.test(n)) {
    out.push({ sub: "Abdômen", factor: 1.0 });
    return out;
  }

  return out;
}

export interface SubMuscleStat {
  sub: SubMuscle;
  parent: ParentGroup;
  directSets: number; // séries com este alvo como principal (factor >= 0.9)
  effectiveSets: number; // séries ponderadas (inclui sinergia)
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
  fix: string;
}

// Sugestões concretas de exercício por sub-região negligenciada.
// Lista de exercícios sugeridos por sub-região (para o accordion na UI).
export const SUB_EXERCISES: Record<SubMuscle, string[]> = {
  "Peito Superior": [
    "Supino Inclinado com Halteres",
    "Supino Inclinado com Barra",
    "Crucifixo Inclinado",
    "Crossover de baixo para cima",
  ],
  "Peito Médio/Inferior": [
    "Supino Reto com Barra",
    "Supino Reto com Halteres",
    "Crossover",
    "Mergulho nas Paralelas",
  ],
  "Dorsal (Largura)": ["Barra Fixa", "Puxada Alta (Pulley)", "Pullover", "Puxada pegada aberta"],
  "Trapézio/Romboides (Espessura)": [
    "Remada Curvada",
    "Remada Baixa (Triângulo)",
    "Remada Unilateral (Serrote)",
    "Remada Cavalinho",
  ],
  Lombar: ["Levantamento Terra", "Stiff", "Hiperextensão (banco romano)"],
  "Deltoide Anterior": ["Desenvolvimento Militar", "Desenvolvimento Arnold", "Elevação Frontal"],
  "Deltoide Lateral": [
    "Elevação Lateral",
    "Elevação Lateral no Cabo",
    "Remada Alta (pegada aberta)",
  ],
  "Deltoide Posterior": [
    "Face Pull",
    "Crucifixo Invertido",
    "Voador Invertido (peck deck)",
    "Remada Alta na corda",
  ],
  "Trapézio Superior": ["Encolhimento de Ombros", "Encolhimento com Halteres"],
  "Bíceps Cabeça Longa": [
    "Rosca no banco inclinado",
    "Rosca Direta em pé",
    "Rosca Barra (pegada fechada)",
  ],
  "Bíceps Cabeça Curta": ["Rosca Scott", "Rosca Concentrada", "Rosca no cabo (pegada aberta)"],
  "Braquial/Braquiorradial": ["Rosca Martelo", "Rosca Inversa (pronada)"],
  "Antebraço (Flexores)": ["Rosca de Punho", "Farmer's Walk", "Prancha com pegada"],
  "Tríceps Cabeça Longa": [
    "Tríceps Testa",
    "Tríceps Francês",
    "Extensão de Tríceps acima da cabeça",
  ],
  "Tríceps Lateral/Medial": [
    "Tríceps Corda (pulley)",
    "Tríceps Pulley pegada pronada",
    "Mergulho no banco",
  ],
  Quadríceps: ["Agachamento Livre", "Leg Press 45", "Cadeira Extensora", "Afundo (Passada)"],
  "Posterior de Coxa": ["Stiff", "Mesa Flexora", "Levantamento Terra Romeno", "Cadeira Flexora"],
  Glúteo: ["Hip Thrust", "Agachamento Búlgaro", "Elevação Pélvica", "Coice no Cabo"],
  Panturrilha: ["Panturrilha em Pé", "Panturrilha Sentado", "Panturrilha no Leg Press"],
  Abdômen: ["Prancha", "Abdominal Supra", "Elevação de Pernas", "Abdominal na Roda"],
};

const FIX: Record<SubMuscle, string> = {
  "Peito Superior": "Supino Inclinado (halteres ou barra)",
  "Peito Médio/Inferior": "Supino Reto ou Crossover",
  "Dorsal (Largura)": "Puxada Alta ou Barra Fixa",
  "Trapézio/Romboides (Espessura)": "Remada Curvada ou Baixa",
  Lombar: "Levantamento Terra ou Stiff",
  "Deltoide Anterior": "Desenvolvimento ou Elevação Frontal",
  "Deltoide Lateral": "Elevação Lateral",
  "Deltoide Posterior": "Face Pull ou Crucifixo Invertido",
  "Trapézio Superior": "Encolhimento de Ombros",
  "Bíceps Cabeça Longa": "Rosca no banco inclinado",
  "Bíceps Cabeça Curta": "Rosca Scott",
  "Braquial/Braquiorradial": "Rosca Martelo",
  "Antebraço (Flexores)": "Rosca de Punho",
  "Tríceps Cabeça Longa": "Tríceps Testa ou Francês (braço acima da cabeça)",
  "Tríceps Lateral/Medial": "Tríceps Pulley/Corda",
  Quadríceps: "Agachamento ou Leg Press",
  "Posterior de Coxa": "Stiff ou Mesa Flexora",
  Glúteo: "Hip Thrust ou Agachamento",
  Panturrilha: "Panturrilha em Pé",
  Abdômen: "Prancha ou Abdominal",
};

/**
 * Pontos cegos: sub-regiões com pouco/nenhum trabalho DIRETO enquanto o grupo
 * pai foi treinado. Alerta anti-assimetria.
 */
export function findBlindSpots(stats: SubMuscleStat[]): BlindSpot[] {
  const spots: BlindSpot[] = [];
  const parentSets: Record<string, number> = {};
  for (const s of stats) parentSets[s.parent] = (parentSets[s.parent] ?? 0) + s.directSets;

  for (const s of stats) {
    if (parentSets[s.parent] < 3) continue; // grupo mal treinado: não cobra sub-região
    // lombar e trapézio superior recebem muito estímulo indireto — só alerta se crítico
    const secondary = /Lombar|Trapézio Superior|Braquial/.test(s.sub);
    if (s.directSets === 0 && s.effectiveSets < 1) {
      if (secondary) continue;
      spots.push({
        sub: s.sub,
        parent: s.parent,
        directSets: 0,
        severity: "crítico",
        fix: FIX[s.sub],
      });
    } else if (s.directSets < 2 && s.effectiveSets < 4 && !secondary) {
      spots.push({
        sub: s.sub,
        parent: s.parent,
        directSets: s.directSets,
        severity: "atenção",
        fix: FIX[s.sub],
      });
    }
  }
  return spots;
}
