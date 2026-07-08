import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, PageHeader } from "@/components/hlt/Shell";
import { Button } from "@/components/ui/button";
import { useLocalStorage, KEYS } from "@/lib/hlt/storage";
import {
  DEFAULT_EXERCISES,
  DEFAULT_PROFILE,
  DEFAULT_SCHEDULE,
  daysFromSchedule,
  dayGroups,
} from "@/lib/hlt/defaults";
import { consecutiveTrainingStreak, scheduleStatus } from "@/lib/hlt/streakHelpers";
import { MesoGoalsSection } from "@/components/hlt/MesoGoals";
import {
  subMuscleStats,
  findBlindSpots,
  PARENT_ORDER,
  SUB_EXERCISES,
  type SubMuscle,
} from "@/lib/hlt/subMuscles";
import { rpeVolumeByExercise, rpeVolumeInsight, exerciseHistory } from "@/lib/hlt/progression";
import type {
  Assessment,
  Exercise,
  FoodLog,
  MealKey,
  Profile,
  WeightLog,
  WorkoutSession,
  WeekSchedule,
} from "@/lib/hlt/types";
import { dailyMacros, todayISO, toLocalISO, localDayOf } from "@/lib/hlt/calc";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { weeklyMuscleStats, muscleBalance } from "@/lib/hlt/muscles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Lightbulb, Trophy, Check, AlertTriangle, ChevronDown, TrendingUp } from "lucide-react";
import { oneRepMax } from "@/lib/hlt/onerm";
import { ACHIEVEMENTS, type UnlockedAchievement } from "@/lib/hlt/achievements";
import { toast } from "sonner";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Análise & Progresso" }] }),
  component: AnalyticsPage,
});

const MEAL_KEYS: MealKey[] = ["breakfast", "lunch", "preworkout", "dinner", "snacks"];

function AnalyticsPage() {
  const [sessions] = useLocalStorage<WorkoutSession[]>(KEYS.sessions, []);
  const [exercises] = useLocalStorage<Exercise[]>(KEYS.exercises, DEFAULT_EXERCISES);
  const [weights] = useLocalStorage<WeightLog[]>(KEYS.weights, []);
  const [foods] = useLocalStorage<FoodLog[]>(KEYS.foods, []);
  const [profile] = useLocalStorage<Profile>(KEYS.profile, DEFAULT_PROFILE);
  const [schedule] = useLocalStorage<WeekSchedule>(KEYS.schedule, DEFAULT_SCHEDULE);
  const [assessment, setAssessment] = useLocalStorage<Assessment | null>(KEYS.assessment, null);
  const [unlocked] = useLocalStorage<UnlockedAchievement[]>(KEYS.achievements, []);
  const [selectedExId, setSelectedExId] = useState("");

  const weeksOfData = useMemo(() => {
    if (sessions.length === 0) return 0;
    const first = new Date(sessions[0].date).getTime();
    return Math.floor((Date.now() - first) / (7 * 24 * 3600 * 1000));
  }, [sessions]);

  const showAssessment = weeksOfData < 4 && !assessment;

  // Feature 3 — RPE médio por sessão (todas as sessões, para tendência de fadiga)
  const rpeHistory = useMemo(() => {
    return sessions
      .map((s) => {
        const rpes = s.exercises.flatMap((e) =>
          e.sets.map((st) => st.rpe).filter((r): r is number => r != null),
        );
        return rpes.length
          ? {
              date: s.date.slice(5, 10),
              rpe: +(rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1),
            }
          : null;
      })
      .filter((x): x is { date: string; rpe: number } => x !== null)
      .slice(-20);
  }, [sessions]);

  // Lista de exercícios para o gráfico de progressão, sem nomes repetidos.
  // Exercícios com o mesmo nome (ex.: "Supino" em Push A e Push B, ou duplicados
  // por edições antigas) são agrupados: fica o que tem mais sessões no histórico.
  const progressionOptions = useMemo(() => {
    const sessionCount = new Map<string, number>();
    for (const s of sessions)
      for (const ex of s.exercises)
        sessionCount.set(ex.exercise_id, (sessionCount.get(ex.exercise_id) ?? 0) + 1);
    const byName = new Map<string, Exercise>();
    for (const e of exercises) {
      const key = e.name.trim().toLowerCase();
      const cur = byName.get(key);
      if (!cur || (sessionCount.get(e.id) ?? 0) > (sessionCount.get(cur.id) ?? 0)) {
        byName.set(key, e);
      }
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, sessions]);

  // exercício efetivamente exibido: o escolhido, ou o 1º do dropdown como padrão
  const effectiveExId = selectedExId || progressionOptions[0]?.id || "";
  const effectiveExName = progressionOptions.find((e) => e.id === effectiveExId)?.name ?? "";

  // histórico de carga/1RM do exercício — casa por ID ou nome, já ordenado por
  // data (mais antiga → mais recente) pela função exerciseHistory.
  const loadHistory = useMemo(() => {
    if (!effectiveExId) return [];
    return exerciseHistory(sessions, effectiveExId, effectiveExName).map((h) => ({
      date: h.date.slice(5, 10),
      peso: h.topWeight,
      rm: h.best1rm,
      rpe: h.avgRpe,
    }));
  }, [sessions, effectiveExId, effectiveExName]);

  const best1RM = useMemo(
    () => (loadHistory.length ? Math.max(...loadHistory.map((d) => d.rm)) : 0),
    [loadHistory],
  );

  // últimas 8 semanas (domingo a sábado), com total e percentuais — a
  // versão antiga agrupava por Math.ceil(dia/7), misturando meses.
  const volumeByGroup = useMemo(() => {
    const weekStart = (d: Date) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      x.setDate(x.getDate() - x.getDay());
      return x;
    };
    const byWeek = new Map<number, { push: number; pull: number; legs: number }>();
    for (const s of sessions) {
      const k = weekStart(new Date(s.date)).getTime();
      const vol = s.exercises.reduce(
        (a, e) => a + e.sets.reduce((b, st) => b + st.weight_kg * st.reps, 0),
        0,
      );
      const cur = byWeek.get(k) ?? { push: 0, pull: 0, legs: 0 };
      cur[s.type] = (cur[s.type] ?? 0) + vol;
      byWeek.set(k, cur);
    }
    return [...byWeek.entries()]
      .sort(([a], [b]) => a - b)
      .slice(-8)
      .map(([k, v]) => {
        const d = new Date(k);
        const total = v.push + v.pull + v.legs;
        return {
          week: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
          push: Math.round(v.push),
          pull: Math.round(v.pull),
          legs: Math.round(v.legs),
          total: Math.round(total),
        };
      });
  }, [sessions]);

  // comparação desta semana × anterior, por grupo e total
  const volCompare = useMemo(() => {
    if (volumeByGroup.length < 2) return null;
    const cur = volumeByGroup[volumeByGroup.length - 1];
    const prev = volumeByGroup[volumeByGroup.length - 2];
    const delta = (a: number, b: number) =>
      b > 0 ? Math.round(((a - b) / b) * 100) : a > 0 ? 100 : 0;
    return {
      total: delta(cur.total, prev.total),
      push: delta(cur.push, prev.push),
      pull: delta(cur.pull, prev.pull),
      legs: delta(cur.legs, prev.legs),
    };
  }, [volumeByGroup]);

  const radarData = useMemo(() => {
    const groups = { Peito: 0, Costas: 0, Ombros: 0, Bíceps: 0, Tríceps: 0, Pernas: 0 };
    const mapEx = (name: string): keyof typeof groups | null => {
      const n = name.toLowerCase();
      if (n.includes("supino") || n.includes("crossover") || n.includes("voador")) return "Peito";
      if (n.includes("puxada") || n.includes("remada") || n.includes("barra fixa")) return "Costas";
      if (n.includes("desenvolvimento") || n.includes("lateral") || n.includes("face pull"))
        return "Ombros";
      if (n.includes("rosca")) return "Bíceps";
      if (n.includes("tríceps") || n.includes("triceps") || n.includes("pulley")) return "Tríceps";
      if (
        n.includes("leg") ||
        n.includes("agacha") ||
        n.includes("cadeira") ||
        n.includes("terra") ||
        n.includes("flexora") ||
        n.includes("panturrilha")
      )
        return "Pernas";
      return null;
    };
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    for (const s of sessions.filter((s) => new Date(s.date).getTime() > cutoff)) {
      for (const ex of s.exercises) {
        const g = mapEx(ex.name);
        if (!g) continue;
        groups[g] += ex.sets.reduce((a, st) => a + st.weight_kg * st.reps, 0);
      }
    }
    return Object.entries(groups).map(([k, v]) => ({ group: k, volume: v }));
  }, [sessions]);

  const weightKcal = useMemo(() => {
    const map = new Map<string, { peso?: number; kcal?: number }>();
    for (const w of weights) map.set(w.date, { ...map.get(w.date), peso: w.weight_kg });
    for (const f of foods) {
      const kcal = MEAL_KEYS.reduce(
        (a, m) => a + (f.meals[m] || []).reduce((b, i) => b + i.kcal, 0),
        0,
      );
      map.set(f.date, { ...map.get(f.date), kcal });
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, v]) => ({ date: date.slice(5), ...v }));
  }, [weights, foods]);

  // média móvel de 7 pontos do peso (tendência suavizada)
  const weightKcalPlus = useMemo(() => {
    const win: number[] = [];
    return weightKcal.map((d) => {
      if (d.peso != null) {
        win.push(d.peso);
        if (win.length > 7) win.shift();
      }
      const mm7 =
        win.length >= 3 ? +(win.reduce((a, b) => a + b, 0) / win.length).toFixed(2) : undefined;
      return { ...d, mm7 };
    });
  }, [weightKcal]);

  const weightTrend = useMemo(() => {
    const pts = weightKcal.filter((d) => d.peso != null).slice(-14);
    if (pts.length < 4) return null;
    const n = pts.length;
    const xs = pts.map((_, i) => i),
      ys = pts.map((d) => d.peso as number);
    const mx = xs.reduce((a, b) => a + b, 0) / n,
      my = ys.reduce((a, b) => a + b, 0) / n;
    const slope =
      xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) /
      xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    return +(slope * 7).toFixed(2); // kg por semana
  }, [weightKcal]);

  // volume por músculo (7 dias) + relatório de equilíbrio
  const muscleStats = useMemo(() => weeklyMuscleStats(sessions), [sessions]);
  const balance = useMemo(() => muscleBalance(muscleStats), [muscleStats]);
  const [openSub, setOpenSub] = useState<SubMuscle | null>(null);
  const [openTip, setOpenTip] = useState<number | null>(null);
  const [rpeExId, setRpeExId] = useState<string>("");
  const subMuscleData = useMemo(() => subMuscleStats(sessions), [sessions]);

  // Exercícios que têm ao menos uma série com RPE registrado (para o seletor)
  const rpeExerciseOptions = useMemo(() => {
    const withRpe = new Map<string, string>();
    for (const s of sessions)
      for (const ex of s.exercises)
        if (ex.sets.some((st) => st.rpe != null)) withRpe.set(ex.exercise_id, ex.name);
    return [...withRpe.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions]);

  const effectiveRpeExId = rpeExId || rpeExerciseOptions[0]?.id || "";
  const rpeByExercise = useMemo(
    () =>
      effectiveRpeExId
        ? rpeVolumeByExercise(
            sessions,
            effectiveRpeExId,
            rpeExerciseOptions.find((e) => e.id === effectiveRpeExId)?.name,
          )
        : [],
    [sessions, effectiveRpeExId, rpeExerciseOptions],
  );
  const rpeInsight = useMemo(() => rpeVolumeInsight(rpeByExercise), [rpeByExercise]);
  const criticalSeries = useMemo(
    () =>
      rpeByExercise.flatMap((p) => p.criticalSets.map((c) => ({ dateLabel: p.dateLabel, ...c }))),
    [rpeByExercise],
  );

  const blindSpots = useMemo(() => findBlindSpots(subMuscleData), [subMuscleData]);

  // % de cada grupo no volume dos últimos 7 dias
  const groupPct = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    const acc = { push: 0, pull: 0, legs: 0 } as Record<string, number>;
    for (const ses of sessions) {
      if (new Date(ses.date).getTime() <= cutoff) continue;
      acc[ses.type] += ses.exercises.reduce(
        (a, e) => a + e.sets.reduce((b, st) => b + st.weight_kg * st.reps, 0),
        0,
      );
    }
    const total = acc.push + acc.pull + acc.legs || 1;
    return [
      { key: "push", label: "Push", pct: Math.round((acc.push / total) * 100), cls: "text-info" },
      {
        key: "pull",
        label: "Pull",
        pct: Math.round((acc.pull / total) * 100),
        cls: "text-success",
      },
      {
        key: "legs",
        label: "Legs",
        pct: Math.round((acc.legs / total) * 100),
        cls: "text-warning",
      },
    ];
  }, [sessions]);

  // Smart tips
  const tips = useMemo(() => {
    const t: { short: string; detail: string }[] = [];
    // Same load 2+ weeks
    if (sessions.length >= 4 && effectiveExId) {
      const recent = sessions
        .filter((s) => s.exercises.some((e) => e.exercise_id === effectiveExId))
        .slice(-4);
      if (recent.length >= 2) {
        const maxes = recent.map((s) =>
          Math.max(
            ...(s.exercises
              .find((e) => e.exercise_id === effectiveExId)
              ?.sets.map((x) => x.weight_kg) ?? [0]),
          ),
        );
        if (maxes.every((m) => m === maxes[0]))
          t.push({
            short: "Hora de progredir a carga no exercício selecionado.",
            detail:
              "Você repetiu o mesmo peso máximo nas últimas sessões deste exercício. Quando a carga estaciona, o estímulo de crescimento diminui. Aplique a progressão dupla: se já bate o topo da faixa de repetições, suba 1–2 kg na próxima; se não, mantenha o peso e busque mais 1–2 reps por série até chegar lá.",
          });
      }
    }
    // Workouts last week
    const lastWeekCount = sessions.filter(
      (s) => new Date(s.date).getTime() > Date.now() - 7 * 24 * 3600 * 1000,
    ).length;
    if (lastWeekCount < 4 && sessions.length > 5)
      t.push({
        short: "Sua consistência caiu esta semana.",
        detail:
          "Você treinou menos de 4 vezes nos últimos 7 dias. A frequência é o fator que mais influencia resultado a longo prazo — mais até que o treino perfeito. Tente garantir pelo menos 4 sessões por semana, mesmo que alguma seja mais curta.",
      });
    // Fat avg 7d
    const last7Days = foods.filter(
      (f) => new Date(f.date).getTime() > Date.now() - 7 * 24 * 3600 * 1000,
    );
    if (last7Days.length >= 3) {
      const avgFat =
        last7Days.reduce(
          (a, f) =>
            a +
            MEAL_KEYS.reduce((b, m) => b + (f.meals[m] || []).reduce((c, i) => c + i.fat_g, 0), 0),
          0,
        ) / last7Days.length;
      const fatLimit = profile.fat_daily_limit_g ?? 50;
      if (avgFat > fatLimit)
        t.push({
          short: `Gordura média acima do limite de ${fatLimit}g/dia.`,
          detail: `Nos últimos dias sua média de gordura passou de ${fatLimit}g (sua meta). Gordura tem 9 kcal/g (mais que o dobro da proteína e carboidrato), então ela estoura as calorias rápido. Olhe os lanches e frituras: troque parte por fontes magras de proteína ou carboidrato para manter o bulk limpo.`,
        });
    }
    // Protein
    const macros = dailyMacros(profile);
    const lowProteinDays = last7Days
      .slice(-3)
      .filter(
        (f) =>
          MEAL_KEYS.reduce(
            (b, m) => b + (f.meals[m] || []).reduce((c, i) => c + i.protein_g, 0),
            0,
          ) <
          macros.protein_g * 0.8,
      );
    if (lowProteinDays.length >= 3)
      t.push({
        short: "Proteína abaixo da meta nos últimos 3 dias.",
        detail:
          "A proteína é o nutriente que constrói músculo — sem ela, o treino rende menos. Você ficou abaixo de 80% da meta em 3 dias seguidos. Garanta uma fonte (ovos, frango, carne, whey, iogurte) em cada refeição principal para distribuir ao longo do dia.",
      });
    // Weight stagnant
    const last14W = weights.slice(-14);
    if (
      last14W.length >= 10 &&
      Math.max(...last14W.map((w) => w.weight_kg)) - Math.min(...last14W.map((w) => w.weight_kg)) <
        0.3
    ) {
      t.push({
        short: "Seu peso está estagnado (bulk parado).",
        detail:
          "Nas últimas 2 semanas seu peso variou menos de 0,3 kg. Num bulk, isso significa que suas calorias estão de manutenção, não de ganho. Adicione 100–150 kcal por dia (de preferência carboidrato) e reavalie em 1–2 semanas.",
      });
    }
    // Legs vs chest
    const chest = radarData.find((r) => r.group === "Peito")?.volume ?? 0;
    const legs = radarData.find((r) => r.group === "Pernas")?.volume ?? 0;
    if (chest > 0 && legs < chest * 0.6)
      t.push({
        short: "Pernas recebendo menos volume que peito.",
        detail:
          "Seu volume de pernas está abaixo de 60% do volume de peito. Desequilíbrios assim, ao longo do tempo, geram desproporção estética e podem afetar postura e força geral. Reforce o treino de pernas (mais séries ou um exercício extra).",
      });
    // dias CONSECUTIVOS de treino (calendário real, sem buracos)
    const consec = consecutiveTrainingStreak(sessions);
    if (consec >= 7)
      t.push({
        short: `${consec} dias seguidos sem descanso.`,
        detail: `Você treinou ${consec} dias consecutivos sem folga. O músculo cresce no descanso, não no treino — dias seguidos sem pausa aumentam o risco de overtraining, queda de desempenho e lesão. Programe pelo menos 1 dia de descanso para recuperar.`,
      });
    // treino do cronograma não registrado nesta semana
    const st = scheduleStatus(sessions, schedule);
    if (st.missedToday)
      t.push({
        short: "Hoje é dia de treino no seu plano.",
        detail:
          "Segundo seu cronograma, hoje é dia de treinar e ainda não há sessão registrada. Se já treinou, não esqueça de registrar para manter suas estatísticas e streak corretos.",
      });
    else if (st.missedThisWeek.length > 0)
      t.push({
        short: `${st.missedThisWeek.length} treino(s) sem registro esta semana.`,
        detail:
          "Alguns dias que seu cronograma marcava como treino ficaram sem sessão registrada nesta semana. Se você treinou e esqueceu de registrar, adicione manualmente; se faltou mesmo, tente compensar em outro dia.",
      });
    if (t.length === 0)
      t.push({
        short: "Tudo certo! Continue assim. 💪",
        detail:
          "Nenhum alerta no momento: sua consistência, volume, nutrição e progressão estão dentro do esperado. Disciplina é o que constrói resultado — siga firme no seu plano.",
      });
    return t;
  }, [sessions, effectiveExId, foods, weights, radarData, profile, schedule]);

  // Heatmap dos últimos 84 dias (12 semanas), começando no domingo.
  // Estados: treino realizado, dia de treino sem registro (só na SEMANA ATUAL,
  // onde o cronograma vigente se aplica), descanso, e futuro.
  // Importante: NÃO marcamos "faltou" no passado — o cronograma de hoje não
  // valia necessariamente semanas atrás, então dias passados sem treino são
  // apenas "descanso" (evita pintar de vermelho retroativamente ao mudar o plano).
  const heatmap = useMemo(() => {
    const trained = new Set(sessions.map((s) => localDayOf(s.date)));
    const now = new Date();
    const todayIso = toLocalISO(now);
    // início da semana atual (domingo) — só a partir daqui "faltou" faz sentido
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
    const curWeekIso = toLocalISO(currentWeekStart);

    const start = new Date();
    start.setDate(start.getDate() - start.getDay() - 11 * 7); // domingo, 12 semanas atrás
    const days: { date: string; state: "trained" | "missed" | "rest" | "future" }[] = [];
    for (let i = 0; i < 84; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const iso = toLocalISO(d);
      let state: "trained" | "missed" | "rest" | "future";
      if (trained.has(iso)) {
        state = "trained";
      } else if (iso > todayIso) {
        state = "future";
      } else if (iso >= curWeekIso && dayGroups(schedule[d.getDay()]).length > 0) {
        // só a semana atual pode marcar "faltou", pois o cronograma é o de agora
        state = "missed";
      } else {
        state = "rest";
      }
      days.push({ date: iso, state });
    }
    return days;
  }, [sessions, schedule]);

  // estatísticas de consistência exibidas acima da grade
  const consistency = useMemo(() => {
    const trainedCount = heatmap.filter((d) => d.state === "trained").length;
    const expected = heatmap.filter((d) => d.state === "trained" || d.state === "missed").length;
    const adherence = expected > 0 ? Math.round((trainedCount / expected) * 100) : 100;
    return { streak: consecutiveTrainingStreak(sessions), trainedCount, adherence };
  }, [heatmap, sessions]);

  if (showAssessment) {
    return (
      <AssessmentForm
        onSave={(a) => {
          setAssessment(a);
          toast.success("Obrigado! Análises calibradas.");
        }}
        onSkip={() => setAssessment({ skipped: true } as unknown as Assessment)}
      />
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Análise & Progresso"
        subtitle={`${sessions.length} sessões registradas · ${weeksOfData} semanas`}
      />

      <MesoGoalsSection />

      <Card className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="size-5 text-warning" />
          <h3 className="font-semibold">Dicas inteligentes</h3>
        </div>
        <ul className="space-y-1.5 text-sm">
          {tips.map((t, i) => {
            const open = openTip === i;
            return (
              <li key={i} className="rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setOpenTip(open ? null : i)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent/50 transition"
                  aria-expanded={open}
                >
                  <span className="text-primary shrink-0">•</span>
                  <span className="flex-1">{t.short}</span>
                  <ChevronDown
                    className={`size-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </button>
                {open && (
                  <div className="px-3 pb-3 pl-8 text-xs text-muted-foreground leading-relaxed">
                    {t.detail}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">Progressão de carga & força</h3>
            {best1RM > 0 && (
              <div className="text-xs text-muted-foreground">
                1RM estimado atual (Epley):{" "}
                <span className="font-semibold text-warning">{best1RM} kg</span>
              </div>
            )}
          </div>
          <Select value={effectiveExId} onValueChange={setSelectedExId}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {progressionOptions.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="h-56">
          {loadHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={loadHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="peso"
                  name="Carga máx."
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="rm"
                  name="1RM estimado"
                  stroke="var(--color-warning)"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Empty>Sem dados para este exercício ainda.</Empty>
          )}
        </div>
      </Card>

      {/* Análise micro de RPE por exercício (carga × esforço, série crítica) */}
      {rpeByExercise.length >= 1 && (
        <Card className="mb-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
            <h3 className="font-semibold">Esforço × Carga por exercício</h3>
            <Select value={effectiveRpeExId} onValueChange={setRpeExId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Escolher exercício" />
              </SelectTrigger>
              <SelectContent>
                {rpeExerciseOptions.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground mb-3">
            RPE médio (linha) cruzado com o volume do dia (barras). Volume estável + RPE caindo =
            ganho de força; volume estável + RPE subindo = fadiga acumulando.
          </div>

          {rpeByExercise.filter((p) => p.avgRpe != null).length < 1 ? (
            <Empty>Registre RPE neste exercício para ver a análise.</Empty>
          ) : (
            <>
              {rpeInsight && (
                <div className="mb-3 flex items-start gap-2 rounded-lg bg-info/10 border border-info/25 px-3 py-2 text-xs">
                  <TrendingUp className="size-4 text-info shrink-0 mt-0.5" />
                  <span>{rpeInsight}</span>
                </div>
              )}

              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={rpeByExercise}
                    margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="dateLabel"
                      stroke="var(--color-muted-foreground)"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      yAxisId="rpe"
                      domain={[0, 10]}
                      ticks={[0, 2, 4, 6, 8, 10]}
                      stroke="var(--color-warning)"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      yAxisId="vol"
                      orientation="right"
                      stroke="var(--color-primary)"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                      formatter={(v: number, name: string) =>
                        name === "avgRpe"
                          ? [`RPE ${v}`, "esforço médio"]
                          : [`${Number(v).toLocaleString("pt-BR")} kg`, "volume"]
                      }
                    />
                    <ReferenceLine
                      yAxisId="rpe"
                      y={9.5}
                      stroke="var(--color-danger)"
                      strokeDasharray="4 3"
                      label={{
                        value: "crítico",
                        fontSize: 9,
                        fill: "var(--color-danger)",
                        position: "insideTopRight",
                      }}
                    />
                    <Bar
                      yAxisId="vol"
                      dataKey="volume"
                      fill="var(--color-primary)"
                      opacity={0.25}
                      radius={[3, 3, 0, 0]}
                    />
                    <Line
                      yAxisId="rpe"
                      type="monotone"
                      dataKey="avgRpe"
                      stroke="var(--color-warning)"
                      strokeWidth={2.5}
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        if (cx == null || cy == null) return <g />;
                        const crit = payload.hasCritical;
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={crit ? 5 : 3}
                            fill={crit ? "var(--color-danger)" : "var(--color-warning)"}
                            stroke={crit ? "var(--color-danger)" : "none"}
                            strokeWidth={crit ? 2 : 0}
                          />
                        );
                      }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* legenda dos eixos */}
              <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <i className="w-3 h-0.5 bg-warning inline-block" /> RPE (esq.)
                </span>
                <span className="flex items-center gap-1">
                  <i className="w-2.5 h-2.5 rounded-sm bg-primary/30 inline-block" /> Volume (dir.)
                </span>
                <span className="flex items-center gap-1">
                  <i className="size-2 rounded-full bg-danger inline-block" /> série RPE ≥ 9,5
                </span>
              </div>

              {/* alerta de séries críticas */}
              {criticalSeries.length > 0 && (
                <div className="mt-3 rounded-lg bg-danger/10 border border-danger/30 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-danger mb-1.5">
                    <AlertTriangle className="size-4" /> Séries no limite (RPE ≥ 9,5)
                  </div>
                  <div className="space-y-1">
                    {criticalSeries.slice(0, 6).map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground w-12 tabular-nums">
                          {c.dateLabel}
                        </span>
                        <span className="tabular-nums">
                          {c.weight}kg × {c.reps}
                        </span>
                        <span className="ml-auto font-bold text-danger tabular-nums">
                          RPE {c.rpe}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-2">
                    Séries no limite são normais pontualmente, mas se repetem com frequência indicam
                    fadiga alta — considere ajustar carga ou descanso.
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <Card>
          <div className="flex items-center justify-between flex-wrap gap-1 mb-1">
            <h3 className="font-semibold">Volume semanal por grupo</h3>
            {volCompare && (
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${volCompare.total >= 0 ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}
              >
                {volCompare.total >= 0 ? "▲" : "▼"} {Math.abs(volCompare.total)}% vs semana anterior
              </span>
            )}
          </div>
          <div className="h-56">
            {volumeByGroup.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={volumeByGroup}
                  margin={{ top: 4, right: 4, left: -18, bottom: 0 }}
                  barGap={2}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="week"
                    stroke="var(--color-muted-foreground)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={<VolumeTooltip />}
                    cursor={{ fill: "var(--color-muted)", opacity: 0.25 }}
                  />
                  <Bar dataKey="push" name="Push" stackId="v" fill="var(--color-info)" />
                  <Bar dataKey="pull" name="Pull" stackId="v" fill="var(--color-success)" />
                  <Bar
                    dataKey="legs"
                    name="Legs"
                    stackId="v"
                    fill="var(--color-warning)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty>Sem sessões registradas.</Empty>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
            <span className="text-muted-foreground">7 dias:</span>
            {groupPct.map((g) => {
              const d = volCompare ? volCompare[g.key as "push" | "pull" | "legs"] : null;
              const top = groupPct.every((o) => g.pct >= o.pct) && g.pct > 0;
              const low = g.pct < 15;
              return (
                <span key={g.key} className={`font-semibold ${g.cls}`}>
                  {top ? "🏆 " : low ? "⚠ " : ""}
                  {g.label} {g.pct}%
                  {d != null && (
                    <span
                      className={`ml-0.5 font-normal ${d >= 0 ? "text-success" : "text-danger"}`}
                    >
                      ({d >= 0 ? "+" : ""}
                      {d}%)
                    </span>
                  )}
                </span>
              );
            })}
          </div>
          {groupPct.some((g) => g.pct < 15 && g.pct >= 0) && groupPct.some((g) => g.pct > 0) && (
            <div className="text-[11px] text-warning mt-1">
              ⚠ = grupo abaixo de 15% do volume — considere reforçá-lo na semana.
            </div>
          )}
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">Equilíbrio muscular (últimos 7 dias)</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--color-border)" />
                <PolarAngleAxis
                  dataKey="group"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                />
                <Radar
                  dataKey="volume"
                  stroke="var(--color-primary)"
                  fill="var(--color-primary)"
                  fillOpacity={0.4}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-3 mt-2 mb-2">
            <div
              className={`text-2xl font-bold ${balance.score >= 80 ? "text-success" : balance.score >= 60 ? "text-warning" : "text-danger"}`}
            >
              {balance.score}%
            </div>
            <div className="flex-1">
              <div className="text-xs text-muted-foreground mb-1">Equilíbrio geral</div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all ${balance.score >= 80 ? "bg-success" : balance.score >= 60 ? "bg-warning" : "bg-danger"}`}
                  style={{ width: `${balance.score}%` }}
                />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            {balance.pairs.map((pr) => (
              <div key={pr.label} className="text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`size-1.5 rounded-full ${pr.ok ? "bg-success" : "bg-warning"}`}
                    />
                    {pr.label}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {pr.ratio != null
                      ? `${pr.ratio}× (ideal ${pr.ideal[0]}–${pr.ideal[1]})`
                      : "sem dados de um lado"}
                  </span>
                </div>
                {pr.suggestion && (
                  <div className="text-warning/90 ml-3 mt-0.5">{pr.suggestion}</div>
                )}
              </div>
            ))}
            {balance.pairs.length === 0 && (
              <div className="text-xs text-muted-foreground">
                Treine esta semana para gerar o relatório.
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="mb-4">
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
          <h3 className="font-semibold">Volume por grupo</h3>
          <span className="text-xs text-muted-foreground">séries/semana · meta 10–20</span>
        </div>
        {muscleStats.length === 0 ? (
          <Empty>Registre treinos esta semana para ver o foco por grupo.</Empty>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {muscleStats.map((m) => {
              const tone =
                m.sets < 10 ? "text-warning" : m.sets <= 20 ? "text-success" : "text-info";
              return (
                <div
                  key={m.muscle}
                  className="rounded-lg border border-border px-2.5 py-2"
                  title={
                    m.sets < 10
                      ? "Abaixo da faixa ideal (10–20)"
                      : m.sets <= 20
                        ? "Na faixa ideal"
                        : "Volume alto"
                  }
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-medium truncate">{m.muscle}</span>
                    <span className={`text-sm font-bold tabular-nums ${tone}`}>{m.sets}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{m.pct}% do volume</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Análise anatômica por sub-região — corpo inteiro */}
      <Card className="mb-4">
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
          <h3 className="font-semibold">Análise anatômica</h3>
          <span className="text-xs text-muted-foreground">sub-regiões · últimos 7 dias</span>
        </div>

        {subMuscleData.every((s) => s.directSets === 0) ? (
          <Empty>Treine esta semana para ver a cobertura por região muscular.</Empty>
        ) : (
          <>
            {/* pontos cegos — só o essencial, em destaque */}
            {blindSpots.length > 0 ? (
              <div className="mb-4 space-y-1.5">
                {blindSpots.map((b) => (
                  <div
                    key={b.sub}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs ${
                      b.severity === "crítico"
                        ? "bg-danger/10 border border-danger/30"
                        : "bg-warning/10 border border-warning/25"
                    }`}
                  >
                    <span
                      className={`shrink-0 size-6 rounded-full grid place-items-center text-[11px] ${
                        b.severity === "crítico"
                          ? "bg-danger/20 text-danger"
                          : "bg-warning/20 text-warning"
                      }`}
                    >
                      {b.severity === "crítico" ? "!" : "~"}
                    </span>
                    <div className="min-w-0">
                      <span className="font-semibold">{b.sub}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        {b.directSets === 0 ? "sem trabalho direto" : `só ${b.directSets} série`} —
                        adicione {b.fix}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-success/10 border border-success/30 px-3 py-2 text-xs text-success">
                <Check className="size-4 shrink-0" /> Cobertura equilibrada nas regiões treinadas.
                Mandou bem! 💪
              </div>
            )}

            {/* mapa por grupo — clique numa sub-região para ver exercícios */}
            <div className="space-y-3">
              {PARENT_ORDER.map((parent) => {
                const subs = subMuscleData.filter((s) => s.parent === parent);
                if (subs.reduce((a, s) => a + s.directSets, 0) === 0) return null;
                return (
                  <div key={parent}>
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                      {parent}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {subs.map((s) => {
                        const short = s.sub.replace(/^(Peito|Tríceps|Bíceps|Deltoide) /, "");
                        const open = openSub === s.sub;
                        const tone =
                          s.directSets === 0
                            ? "bg-danger/10 text-danger border-danger/30"
                            : s.directSets < 2
                              ? "bg-warning/10 text-warning border-warning/30"
                              : "bg-success/10 text-success border-success/30";
                        return (
                          <button
                            key={s.sub}
                            onClick={() => setOpenSub(open ? null : s.sub)}
                            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${tone} ${open ? "ring-2 ring-primary/40" : ""}`}
                            title={`${s.effectiveSets} séries efetivas (com sinergia) · toque para ver exercícios`}
                            aria-expanded={open}
                          >
                            <span className="font-medium">{short}</span>
                            <span className="tabular-nums opacity-80">{s.directSets}</span>
                            <ChevronDown
                              className={`size-3 transition-transform ${open ? "rotate-180" : ""}`}
                            />
                          </button>
                        );
                      })}
                    </div>

                    {/* accordion: exercícios da sub-região aberta (se for deste grupo) */}
                    {openSub && subs.some((s) => s.sub === openSub) && (
                      <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                        <div className="text-xs font-semibold mb-1.5">
                          Exercícios para {openSub}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {SUB_EXERCISES[openSub].map((ex) => (
                            <span
                              key={ex}
                              className="rounded-md bg-card border border-border px-2 py-1 text-[11px]"
                            >
                              {ex}
                            </span>
                          ))}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-2">
                          Cadastre um destes no seu plano (aba Treino) para cobrir esta região.
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <i className="size-2 rounded-full bg-success inline-block" /> ok (2+)
              </span>
              <span className="flex items-center gap-1">
                <i className="size-2 rounded-full bg-warning inline-block" /> pouco (1)
              </span>
              <span className="flex items-center gap-1">
                <i className="size-2 rounded-full bg-danger inline-block" /> zerado
              </span>
              <span className="ml-auto">nº = séries diretas · estimativa biomecânica</span>
            </div>
          </>
        )}
      </Card>

      <Card className="mb-4">
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
          <h3 className="font-semibold">Consistência</h3>
          <span className="text-xs text-muted-foreground">últimas 12 semanas</span>
        </div>

        {/* resumo em números */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-lg border border-border p-2 text-center">
            <div className="text-lg font-bold text-primary tabular-nums">{consistency.streak}</div>
            <div className="text-[10px] text-muted-foreground">dias seguidos 🔥</div>
          </div>
          <div className="rounded-lg border border-border p-2 text-center">
            <div className="text-lg font-bold tabular-nums">{consistency.trainedCount}</div>
            <div className="text-[10px] text-muted-foreground">treinos em 84 dias</div>
          </div>
          <div className="rounded-lg border border-border p-2 text-center">
            <div className="text-lg font-bold text-success tabular-nums">
              {consistency.adherence}%
            </div>
            <div className="text-[10px] text-muted-foreground">adesão ao plano</div>
          </div>
        </div>

        {/* grade com rótulos dos dias */}
        <div className="flex gap-1">
          <div className="flex flex-col gap-1 justify-between pr-0.5 text-[9px] text-muted-foreground">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((l, i) => (
              <span key={i} className="h-3 leading-3">
                {l}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-[repeat(12,1fr)] gap-1 flex-1">
            {Array.from({ length: 12 }, (_, w) => (
              <div key={w} className="flex flex-col gap-1">
                {Array.from({ length: 7 }, (_, d) => {
                  const day = heatmap[w * 7 + d];
                  if (!day) return <div key={d} className="aspect-square" />;
                  const cls =
                    day.state === "trained"
                      ? "bg-success"
                      : day.state === "missed"
                        ? "bg-danger/60"
                        : day.state === "rest"
                          ? "bg-muted"
                          : "bg-muted/40";
                  const label =
                    day.state === "trained"
                      ? "treino realizado"
                      : day.state === "missed"
                        ? "dia de treino sem registro"
                        : day.state === "rest"
                          ? "descanso planejado"
                          : "futuro";
                  return (
                    <div
                      key={d}
                      className={`aspect-square rounded-sm ${cls}`}
                      title={`${day.date}: ${label}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* legenda */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <i className="size-2.5 rounded-sm bg-success inline-block" /> Treino
          </span>
          <span className="flex items-center gap-1">
            <i className="size-2.5 rounded-sm bg-danger/60 inline-block" /> Faltou (era dia de
            treino)
          </span>
          <span className="flex items-center gap-1">
            <i className="size-2.5 rounded-sm bg-muted inline-block" /> Descanso planejado
          </span>
        </div>
      </Card>

      <Card className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="size-5 text-warning" />
          <h3 className="font-semibold">Conquistas</h3>
          <span className="text-xs text-muted-foreground ml-auto">
            {unlocked.length}/{ACHIEVEMENTS.length}
          </span>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          {ACHIEVEMENTS.map((a) => {
            const got = unlocked.some((u) => u.code === a.code);
            return (
              <div
                key={a.code}
                title={a.desc}
                className={`rounded-lg border p-2 text-center transition ${got ? "border-warning/50 bg-warning/10" : "border-border bg-muted/30 opacity-45"}`}
              >
                <div className="text-xl">{a.icon}</div>
                <div className="text-[9px] mt-1 leading-tight">{a.name}</div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <h3 className="font-semibold">Peso × Calorias</h3>
          {weightTrend != null && (
            <span
              className={`text-xs font-semibold px-2 py-1 rounded-full ${weightTrend >= 0 ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}
            >
              {weightTrend >= 0 ? "▲" : "▼"} {Math.abs(weightTrend)} kg/semana
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground mb-3">
          Últimos 30 dias · linha = peso diário · área = média móvel 7d · barras = calorias
        </div>
        <div className="h-72">
          {weightKcalPlus.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={weightKcalPlus}
                margin={{ top: 8, right: 4, left: -16, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradMm7" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradKcal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-info)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="var(--color-info)" stopOpacity={0.12} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="var(--color-muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={28}
                />
                <YAxis
                  yAxisId="left"
                  domain={["dataMin - 0.6", "dataMax + 0.6"]}
                  stroke="var(--color-muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="var(--color-muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--color-muted-foreground)", fontSize: 11 }}
                  formatter={(v: number, name: string) => [
                    name === "Calorias" ? `${Math.round(v)} kcal` : `${Number(v).toFixed(1)} kg`,
                    name,
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} iconSize={9} />
                <ReferenceLine
                  yAxisId="right"
                  y={dailyMacros(profile).kcal}
                  stroke="var(--color-warning)"
                  strokeDasharray="5 4"
                  label={{
                    value: "meta kcal",
                    fontSize: 9,
                    fill: "var(--color-warning)",
                    position: "insideTopRight",
                  }}
                />
                <Bar
                  yAxisId="right"
                  name="Calorias"
                  dataKey="kcal"
                  fill="url(#gradKcal)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={14}
                />
                <Area
                  yAxisId="left"
                  name="Média 7d"
                  dataKey="mm7"
                  type="monotone"
                  stroke="var(--color-success)"
                  strokeWidth={1.5}
                  fill="url(#gradMm7)"
                  dot={false}
                  connectNulls
                />
                <Line
                  yAxisId="left"
                  name="Peso (kg)"
                  dataKey="peso"
                  type="monotone"
                  stroke="var(--color-primary)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <Empty>Registre peso e refeições para ver a correlação.</Empty>
          )}
        </div>
      </Card>
    </div>
  );
}

interface VolTipPayload {
  name?: string;
  value?: number;
  color?: string;
  payload?: { total: number };
}
function VolumeTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: VolTipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload[0]?.payload?.total ?? payload.reduce((a, p) => a + (p.value ?? 0), 0);
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <div className="text-muted-foreground mb-1">Semana de {label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-sm" style={{ background: p.color }} />
          <span className="w-9">{p.name}</span>
          <span className="font-semibold tabular-nums">
            {(p.value ?? 0).toLocaleString("pt-BR")} kg
          </span>
          <span className="text-muted-foreground">
            ({total ? Math.round(((p.value ?? 0) / total) * 100) : 0}%)
          </span>
        </div>
      ))}
      <div className="mt-1 pt-1 border-t border-border font-semibold">
        Total: {total.toLocaleString("pt-BR")} kg
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function AssessmentForm({
  onSave,
  onSkip,
}: {
  onSave: (a: Assessment) => void;
  onSkip: () => void;
}) {
  const [a, setA] = useState<Assessment>({
    weeks_training: 12,
    progressive_overload: "sometimes",
    sleep_quality: 4,
    recovery: "good",
    challenge: "Ganhar peso",
    joint_discomfort: "Não",
  });
  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <PageHeader title="Vamos calibrar sua análise" subtitle="Responda rapidinho — leva 1 min" />
      <Card className="space-y-5">
        <div>
          <label className="text-sm font-medium">
            Há quantas semanas você treina de forma consistente?{" "}
            <span className="text-primary font-bold">{a.weeks_training}</span>
          </label>
          <input
            type="range"
            min={1}
            max={104}
            value={a.weeks_training}
            onChange={(e) => setA({ ...a, weeks_training: +e.target.value })}
            className="w-full mt-2 accent-primary"
          />
        </div>
        <Q label="Aplica sobrecarga progressiva?">
          <Select
            value={a.progressive_overload}
            onValueChange={(v: Assessment["progressive_overload"]) =>
              setA({ ...a, progressive_overload: v })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="always">Sim, toda semana</SelectItem>
              <SelectItem value="sometimes">Às vezes</SelectItem>
              <SelectItem value="no">Ainda não</SelectItem>
            </SelectContent>
          </Select>
        </Q>
        <Q label="Qualidade do sono">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setA({ ...a, sleep_quality: n })}
                className={`text-2xl ${n <= a.sleep_quality ? "text-warning" : "text-muted-foreground/40"}`}
              >
                ★
              </button>
            ))}
          </div>
        </Q>
        <Q label="Recuperação antes de treinar">
          <Select
            value={a.recovery}
            onValueChange={(v: Assessment["recovery"]) => setA({ ...a, recovery: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="great">Ótima</SelectItem>
              <SelectItem value="good">Boa</SelectItem>
              <SelectItem value="regular">Regular</SelectItem>
              <SelectItem value="tired">Cansado</SelectItem>
            </SelectContent>
          </Select>
        </Q>
        <Q label="Maior desafio atual">
          <Select value={a.challenge} onValueChange={(v) => setA({ ...a, challenge: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                "Ganhar força",
                "Ganhar peso",
                "Consistência nos treinos",
                "Dieta",
                "Recuperação",
                "Motivação",
              ].map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Q>
        <Q label="Desconforto articular?">
          <Select
            value={a.joint_discomfort}
            onValueChange={(v) => setA({ ...a, joint_discomfort: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Não">Não</SelectItem>
              <SelectItem value="Joelho">Sim — joelho</SelectItem>
              <SelectItem value="Ombro">Sim — ombro</SelectItem>
              <SelectItem value="Lombar">Sim — lombar</SelectItem>
              <SelectItem value="Punho">Sim — punho</SelectItem>
            </SelectContent>
          </Select>
        </Q>
        <Button onClick={() => onSave(a)} className="w-full">
          Salvar respostas
        </Button>
        <button
          onClick={onSkip}
          className="w-full text-xs text-muted-foreground hover:text-foreground underline"
        >
          Pular e ver minhas análises agora
        </button>
      </Card>
    </div>
  );
}

function Q({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium block mb-2">{label}</label>
      {children}
    </div>
  );
}
