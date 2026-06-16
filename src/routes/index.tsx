import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card, PageHeader } from "@/components/hlt/Shell";
import { useLocalStorage, KEYS } from "@/lib/hlt/storage";
import {
  DEFAULT_PROFILE,
  DEFAULT_SCHEDULE,
  GROUP_LABEL,
  GROUP_LABEL_SHORT,
  dayGroups,
} from "@/lib/hlt/defaults";
import { dailyMacros, todayISO } from "@/lib/hlt/calc";
import type {
  FoodLog,
  Profile,
  WeightLog,
  WorkoutSession,
  HydrationLog,
  MealKey,
  WeekSchedule,
} from "@/lib/hlt/types";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Dumbbell, TrendingUp, Flame, Trophy, Plus, Activity } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Início — Healthy Life Tracker" }] }),
  component: Dashboard,
});

const MEAL_KEYS: MealKey[] = ["breakfast", "lunch", "preworkout", "dinner", "snacks"];

function Dashboard() {
  const [profile] = useLocalStorage<Profile>(KEYS.profile, DEFAULT_PROFILE);
  const [foods] = useLocalStorage<FoodLog[]>(KEYS.foods, []);
  const [weights] = useLocalStorage<WeightLog[]>(KEYS.weights, []);
  const [sessions] = useLocalStorage<WorkoutSession[]>(KEYS.sessions, []);
  const [hydration] = useLocalStorage<HydrationLog[]>(KEYS.hydration, []);

  const today = todayISO();
  const dayOfWeek = new Date().getDay();
  const [schedule] = useLocalStorage<WeekSchedule>(KEYS.schedule, DEFAULT_SCHEDULE);
  const todayGroups = dayGroups(schedule[dayOfWeek]);
  const isRestDay = todayGroups.length === 0;
  const todayLabel = isRestDay
    ? "Descanso"
    : todayGroups.map((g) => GROUP_LABEL_SHORT[g]).join(" + ");
  const isRest = isRestDay;
  const macros = dailyMacros(profile, isRest);

  const todayFood = foods.find((f) => f.date === today);
  const consumed = useMemo(() => {
    const t = { kcal: 0, p: 0, c: 0, f: 0 };
    if (!todayFood) return t;
    for (const m of MEAL_KEYS) {
      for (const item of todayFood.meals[m] || []) {
        t.kcal += item.kcal;
        t.p += item.protein_g;
        t.c += item.carbs_g;
        t.f += item.fat_g;
      }
    }
    return t;
  }, [todayFood]);

  const lastWeight = weights[weights.length - 1];
  const prevWeight = weights[weights.length - 2];
  const trend = lastWeight && prevWeight ? lastWeight.weight_kg - prevWeight.weight_kg : 0;

  // streak
  const streak = useMemo(() => {
    const dates = new Set<string>();
    sessions.forEach((s) => dates.add(s.date.slice(0, 10)));
    foods.forEach(
      (f) => f.meals && Object.values(f.meals).some((x) => x.length) && dates.add(f.date),
    );
    weights.forEach((w) => dates.add(w.date));
    let n = 0;
    const d = new Date();
    while (true) {
      const iso = d.toISOString().slice(0, 10);
      if (dates.has(iso)) {
        n++;
        d.setDate(d.getDate() - 1);
      } else break;
    }
    return n;
  }, [sessions, foods, weights]);

  const cupsToday = hydration.find((h) => h.date === today)?.cups ?? 0;
  const waterGoalMl = Math.round(35 * profile.weight_current_kg);
  const waterPct = Math.min(100, Math.round((cupsToday * 250 * 100) / waterGoalMl));

  const motivational = useMemo(() => {
    const left = profile.weight_goal_kg - profile.weight_current_kg;
    if (!isRestDay) {
      return `Treino ${todayLabel} hoje — vamos lá! 💪`;
    }
    if (left > 0) return `Você está a ${left.toFixed(1)}kg do seu objetivo!`;
    return "Mantenha o foco — disciplina vence motivação.";
  }, [profile, isRestDay, todayLabel]);

  const macroPie = [
    { name: "Proteína", value: consumed.p * 4, color: "var(--color-success)" },
    { name: "Carbs", value: consumed.c * 4, color: "var(--color-info)" },
    { name: "Gordura", value: consumed.f * 9, color: "var(--color-warning)" },
  ];

  const kcalPct = Math.min(100, Math.round((consumed.kcal / macros.kcal) * 100));

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader title={`Olá, ${profile.name}`} subtitle={motivational} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <Card>
          <div className="flex items-center gap-2 mb-1">
            <Dumbbell className="size-4 text-primary" />
            <span className="label-up">Hoje</span>
          </div>
          <div className="text-lg font-bold">{todayLabel}</div>
          <div className="text-xs text-muted-foreground">
            {isRestDay ? GROUP_LABEL.rest : todayGroups.map((g) => GROUP_LABEL[g]).join(" · ")}
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-1">
            <Flame className="size-4 text-warning" />
            <span className="label-up">Calorias</span>
          </div>
          <div className="text-lg font-bold">
            {Math.round(consumed.kcal)}{" "}
            <span className="text-xs font-normal text-muted-foreground">/ {macros.kcal}</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${kcalPct}%` }} />
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="size-4 text-info" />
            <span className="label-up">Peso</span>
          </div>
          <div className="text-lg font-bold">
            {lastWeight?.weight_kg.toFixed(1) ?? profile.weight_current_kg}kg
          </div>
          <div className="text-xs text-muted-foreground">
            {trend > 0
              ? `↑ +${trend.toFixed(1)}kg`
              : trend < 0
                ? `↓ ${trend.toFixed(1)}kg`
                : "→ estável"}
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="size-4 text-warning" />
            <span className="label-up">Streak</span>
          </div>
          <div className="text-lg font-bold">
            {streak} dia{streak !== 1 ? "s" : ""}
          </div>
          <div className="text-xs text-muted-foreground">consecutivos</div>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card className="md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Macros do dia</h3>
            <Link to="/nutricao" className="text-xs text-primary">
              Detalhes →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={macroPie}
                    dataKey="value"
                    innerRadius={45}
                    outerRadius={70}
                    strokeWidth={0}
                  >
                    {macroPie.map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              <MacroRow
                label="Proteína"
                value={consumed.p}
                goal={macros.protein_g}
                color="bg-success"
                suffix="g"
              />
              <MacroRow
                label="Carboidratos"
                value={consumed.c}
                goal={macros.carbs_g}
                color="bg-info"
                suffix="g"
              />
              <MacroRow
                label="Gordura"
                value={consumed.f}
                goal={macros.fat_g}
                color={
                  consumed.f >= 50 ? "bg-danger" : consumed.f >= 40 ? "bg-warning" : "bg-success"
                }
                suffix="g"
                hardLimit
              />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Hidratação</h3>
            <Link to="/nutricao" className="text-xs text-primary">
              +
            </Link>
          </div>
          <div className="text-3xl font-bold">{((cupsToday * 250) / 1000).toFixed(2)}L</div>
          <div className="text-xs text-muted-foreground mb-3">
            meta {(waterGoalMl / 1000).toFixed(2)}L · {cupsToday} copos
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-info transition-all" style={{ width: `${waterPct}%` }} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <QuickAction to="/peso" icon={<Activity className="size-4" />} label="Registrar peso" />
        <QuickAction to="/nutricao" icon={<Plus className="size-4" />} label="Adicionar refeição" />
        <QuickAction to="/treino" icon={<Dumbbell className="size-4" />} label="Iniciar treino" />
      </div>
    </div>
  );
}

function MacroRow({
  label,
  value,
  goal,
  color,
  suffix,
  hardLimit,
}: {
  label: string;
  value: number;
  goal: number;
  color: string;
  suffix: string;
  hardLimit?: boolean;
}) {
  const pct = Math.min(100, (value / goal) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {Math.round(value)}
          {suffix} / {goal}
          {suffix}
          {hardLimit ? " (máx)" : ""}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function QuickAction({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-3 text-xs md:text-sm font-medium hover:bg-accent transition"
    >
      {icon}
      {label}
    </Link>
  );
}
