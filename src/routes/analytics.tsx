import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, PageHeader } from "@/components/hlt/Shell";
import { Button } from "@/components/ui/button";
import { useLocalStorage, KEYS } from "@/lib/hlt/storage";
import { DEFAULT_EXERCISES, DEFAULT_PROFILE } from "@/lib/hlt/defaults";
import type {
  Assessment,
  Exercise,
  FoodLog,
  MealKey,
  Profile,
  WeightLog,
  WorkoutSession,
} from "@/lib/hlt/types";
import { dailyMacros } from "@/lib/hlt/calc";
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
import { Lightbulb, Trophy } from "lucide-react";
import { epley } from "@/lib/hlt/onerm";
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
  const [assessment, setAssessment] = useLocalStorage<Assessment | null>(KEYS.assessment, null);
  const [unlocked] = useLocalStorage<UnlockedAchievement[]>(KEYS.achievements, []);
  const [selectedExId, setSelectedExId] = useState(exercises[0]?.id ?? "");

  const weeksOfData = useMemo(() => {
    if (sessions.length === 0) return 0;
    const first = new Date(sessions[0].date).getTime();
    return Math.floor((Date.now() - first) / (7 * 24 * 3600 * 1000));
  }, [sessions]);

  const showAssessment = weeksOfData < 4 && !assessment;

  const loadHistory = useMemo(() => {
    return sessions.flatMap((s) => {
      const ex = s.exercises.find((e) => e.exercise_id === selectedExId);
      if (!ex || ex.sets.length === 0) return [];
      const maxW = Math.max(...ex.sets.map((x) => x.weight_kg));
      const rm = Math.max(...ex.sets.map((x) => epley(x.weight_kg, x.reps)));
      return [{ date: s.date.slice(5, 10), peso: maxW, rm }];
    });
  }, [sessions, selectedExId]);

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
  const maxMuscleVol = Math.max(1, ...muscleStats.map((m) => m.volume));

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
    const t: string[] = [];
    // Same load 2+ weeks
    if (sessions.length >= 4 && selectedExId) {
      const recent = sessions
        .filter((s) => s.exercises.some((e) => e.exercise_id === selectedExId))
        .slice(-4);
      if (recent.length >= 2) {
        const maxes = recent.map((s) =>
          Math.max(
            ...(s.exercises
              .find((e) => e.exercise_id === selectedExId)
              ?.sets.map((x) => x.weight_kg) ?? [0]),
          ),
        );
        if (maxes.every((m) => m === maxes[0]))
          t.push(`Tente adicionar 1-2 kg ou aumentar reps no exercício selecionado.`);
      }
    }
    // Workouts last week
    const lastWeekCount = sessions.filter(
      (s) => new Date(s.date).getTime() > Date.now() - 7 * 24 * 3600 * 1000,
    ).length;
    if (lastWeekCount < 4 && sessions.length > 5)
      t.push("Sua consistência caiu esta semana — priorize ao menos 4 sessões.");
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
        t.push(`Sua gordura média está acima do limite de ${fatLimit}g — revise os lanches.`);
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
      t.push(
        "Proteína abaixo da meta nos últimos 3 dias — adicione fonte proteica em cada refeição.",
      );
    // Weight stagnant
    const last14W = weights.slice(-14);
    if (
      last14W.length >= 10 &&
      Math.max(...last14W.map((w) => w.weight_kg)) - Math.min(...last14W.map((w) => w.weight_kg)) <
        0.3
    ) {
      t.push("Seu peso está estagnado — considere aumentar 100-150 kcal/dia.");
    }
    // Legs vs chest
    const chest = radarData.find((r) => r.group === "Peito")?.volume ?? 0;
    const legs = radarData.find((r) => r.group === "Pernas")?.volume ?? 0;
    if (chest > 0 && legs < chest * 0.6)
      t.push("Pernas recebendo menos atenção — reforce o treino de quarta.");
    // 7 days in a row
    const last7Sessions = sessions.slice(-7);
    if (last7Sessions.length === 7) {
      const uniqueDays = new Set(last7Sessions.map((s) => s.date.slice(0, 10)));
      if (uniqueDays.size === 7)
        t.push("⚠️ 7 dias seguidos sem descanso — planeje uma folga para evitar overtraining.");
    }
    if (t.length === 0) t.push("Tudo certo! Continue assim — disciplina é o caminho.");
    return t;
  }, [sessions, selectedExId, foods, weights, radarData, profile]);

  // Heatmap data — last 12 weeks
  const heatmap = useMemo(() => {
    const days: { date: string; count: number }[] = [];
    const trained = new Set(sessions.map((s) => s.date.slice(0, 10)));
    const now = new Date();
    for (let i = 83; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      days.push({ date: iso, count: trained.has(iso) ? 1 : 0 });
    }
    return days;
  }, [sessions]);

  if (showAssessment) {
    return (
      <AssessmentForm
        onSave={(a) => {
          setAssessment(a);
          toast.success("Obrigado! Análises calibradas.");
        }}
      />
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Análise & Progresso"
        subtitle={`${sessions.length} sessões registradas · ${weeksOfData} semanas`}
      />

      <Card className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="size-5 text-warning" />
          <h3 className="font-semibold">Dicas inteligentes</h3>
        </div>
        <ul className="space-y-2 text-sm">
          {tips.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-primary">•</span>
              <span>{t}</span>
            </li>
          ))}
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
          <Select value={selectedExId} onValueChange={setSelectedExId}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {exercises.map((e) => (
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
        <h3 className="font-semibold mb-1">Volume por músculo (últimos 7 dias)</h3>
        <div className="text-xs text-muted-foreground mb-3">
          Séries semanais · volume total · percentual do treino
        </div>
        {muscleStats.length === 0 ? (
          <Empty>Registre treinos esta semana para ver o foco real por músculo.</Empty>
        ) : (
          <div className="space-y-2">
            {muscleStats.map((m) => (
              <div key={m.muscle}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="font-medium flex items-center gap-1.5">
                    <span
                      className={`size-1.5 rounded-full ${m.sets < 10 ? "bg-warning" : m.sets <= 20 ? "bg-success" : "bg-info"}`}
                      title={
                        m.sets < 10
                          ? "Abaixo da faixa (10–20 séries/semana)"
                          : m.sets <= 20
                            ? "Na faixa ideal"
                            : "Volume alto"
                      }
                    />
                    {m.muscle}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {m.sets} séries · {m.volume.toLocaleString("pt-BR")} kg ·{" "}
                    <span className="font-semibold text-foreground">{m.pct}%</span>
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary"
                    style={{ width: `${Math.max(3, (m.volume / maxMuscleVol) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <h3 className="font-semibold mb-3">Consistência (últimos 12 semanas)</h3>
        <div className="grid grid-cols-[repeat(12,1fr)] gap-1">
          {Array.from({ length: 12 }, (_, w) => (
            <div key={w} className="flex flex-col gap-1">
              {Array.from({ length: 7 }, (_, d) => {
                const idx = w * 7 + d;
                const day = heatmap[idx];
                return (
                  <div
                    key={d}
                    className={`aspect-square rounded-sm ${day?.count ? "bg-primary" : "bg-muted"}`}
                    title={day?.date}
                  />
                );
              })}
            </div>
          ))}
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
                    name === "Calorias" ? `${Math.round(v)} kcal` : `${v} kg`,
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

function AssessmentForm({ onSave }: { onSave: (a: Assessment) => void }) {
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
