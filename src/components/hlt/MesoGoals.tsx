// Metas de mesociclo (4–8 semanas): 1RM de um exercício ou peso corporal.
// Barra de progresso com "ritmo necessário" e status de adiantado/atrasado.
import { useMemo, useState } from "react";
import { Card } from "@/components/hlt/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useLocalStorage, KEYS } from "@/lib/hlt/storage";
import type { Exercise, MesoGoal, WeightLog, WorkoutSession } from "@/lib/hlt/types";
import { exerciseHistory } from "@/lib/hlt/progression";
import { Target, Plus, Trophy, Trash2, Flag } from "lucide-react";
import { toast } from "sonner";

function currentValue(goal: MesoGoal, sessions: WorkoutSession[], weights: WeightLog[]): number {
  if (goal.kind === "bodyweight") {
    const sorted = [...weights].sort((a, b) => b.date.localeCompare(a.date));
    return sorted[0]?.weight_kg ?? goal.start_value;
  }
  const hist = exerciseHistory(sessions, goal.exercise_id ?? "");
  return hist.length ? hist[hist.length - 1].best1rm : goal.start_value;
}

export function MesoGoalsSection() {
  const [goals, setGoals] = useLocalStorage<MesoGoal[]>(KEYS.goals, []);
  const [exercises] = useLocalStorage<Exercise[]>(KEYS.exercises, []);
  const [sessions] = useLocalStorage<WorkoutSession[]>(KEYS.sessions, []);
  const [weights] = useLocalStorage<WeightLog[]>(KEYS.weights, []);
  const [open, setOpen] = useState(false);

  const active = goals.filter((g) => !g.archived);

  const remove = (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    toast.success("Meta removida.");
  };

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Target className="size-4 text-primary" /> Metas do ciclo
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="size-4 mr-1" /> Nova meta
            </Button>
          </DialogTrigger>
          <GoalForm
            exercises={exercises}
            sessions={sessions}
            weights={weights}
            onCreate={(g) => {
              setGoals((prev) => [...prev, g]);
              setOpen(false);
              toast.success("Meta criada! Bora perseguir. 🎯");
            }}
          />
        </Dialog>
      </div>

      {active.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6">
          Nenhuma meta ativa. Defina um alvo de 4–8 semanas (ex.: +5kg no supino) e acompanhe o
          progresso aqui.
        </div>
      ) : (
        <div className="space-y-3">
          {active.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              current={currentValue(g, sessions, weights)}
              onRemove={() => remove(g.id)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function GoalCard({
  goal,
  current,
  onRemove,
}: {
  goal: MesoGoal;
  current: number;
  onRemove: () => void;
}) {
  const gain = goal.target_value - goal.start_value;
  const done = current - goal.start_value;
  const pct = gain !== 0 ? Math.max(0, Math.min(100, (done / gain) * 100)) : 0;

  const now = Date.now();
  const start = new Date(goal.start_date).getTime();
  const end = new Date(goal.target_date).getTime();
  const timePct =
    end > start ? Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100)) : 100;
  const daysLeft = Math.max(0, Math.ceil((end - now) / 86400000));
  const reached = current >= goal.target_value;
  const onTrack = pct >= timePct;

  const unit = goal.kind === "bodyweight" ? "kg" : "kg";
  const label =
    goal.kind === "bodyweight" ? "Peso corporal" : (goal.exercise_name ?? "Exercício") + " (1RM)";

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="font-medium text-sm flex items-center gap-1.5">
            {reached ? (
              <Trophy className="size-4 text-warning" />
            ) : (
              <Flag className="size-4 text-primary" />
            )}
            {label}
          </div>
          <div className="text-xs text-muted-foreground">
            {goal.start_value}
            {unit} →{" "}
            <span className="font-semibold text-foreground">
              {goal.target_value}
              {unit}
            </span>
            {" · "}
            {daysLeft > 0 ? `${daysLeft} dias restantes` : "prazo encerrado"}
          </div>
        </div>
        <button
          onClick={onRemove}
          aria-label="Remover meta"
          className="text-muted-foreground hover:text-danger"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {/* barra de progresso com marcador de ritmo necessário */}
      <div className="relative h-3 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${reached ? "bg-warning" : onTrack ? "bg-success" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
        {!reached && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-foreground/70"
            style={{ left: `${timePct}%` }}
            title="ritmo necessário para bater no prazo"
          />
        )}
      </div>

      <div className="flex items-center justify-between mt-1.5 text-xs">
        <span className="tabular-nums">
          Atual:{" "}
          <span className="font-semibold">
            {current.toFixed(1)}
            {unit}
          </span>{" "}
          ({Math.round(pct)}%)
        </span>
        {reached ? (
          <span className="text-warning font-semibold">Meta batida! 🎉</span>
        ) : (
          <span className={onTrack ? "text-success" : "text-warning"}>
            {onTrack ? "no ritmo ✓" : "abaixo do ritmo"}
          </span>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground mt-1">
        A linha vertical marca onde você deveria estar hoje para bater no prazo.
      </div>
    </div>
  );
}

function GoalForm({
  exercises,
  sessions,
  weights,
  onCreate,
}: {
  exercises: Exercise[];
  sessions: WorkoutSession[];
  weights: WeightLog[];
  onCreate: (g: MesoGoal) => void;
}) {
  const [kind, setKind] = useState<"exercise_1rm" | "bodyweight">("exercise_1rm");
  const [exId, setExId] = useState<string>("");
  const [target, setTarget] = useState("");
  const [weeks, setWeeks] = useState("6");

  const startValue = useMemo(() => {
    if (kind === "bodyweight") {
      const sorted = [...weights].sort((a, b) => b.date.localeCompare(a.date));
      return sorted[0]?.weight_kg ?? 0;
    }
    const hist = exerciseHistory(sessions, exId);
    return hist.length ? hist[hist.length - 1].best1rm : 0;
  }, [kind, exId, sessions, weights]);

  const create = () => {
    const tgt = parseFloat(target.replace(",", "."));
    if (isNaN(tgt) || tgt <= 0) return toast.error("Informe um alvo válido.");
    if (kind === "exercise_1rm" && !exId) return toast.error("Escolha um exercício.");
    const w = parseInt(weeks);
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + w * 7);
    const ex = exercises.find((e) => e.id === exId);
    onCreate({
      id: `goal-${Date.now()}`,
      kind,
      exercise_id: kind === "exercise_1rm" ? exId : undefined,
      exercise_name: kind === "exercise_1rm" ? ex?.name : undefined,
      start_value: +startValue.toFixed(1),
      target_value: +tgt.toFixed(1),
      start_date: now.toISOString(),
      target_date: end.toISOString(),
      created_at: now.toISOString(),
    });
  };

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>Nova meta de ciclo</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <label className="text-[11px] text-muted-foreground">Tipo</label>
          <Select value={kind} onValueChange={(v: "exercise_1rm" | "bodyweight") => setKind(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="exercise_1rm">1RM de um exercício</SelectItem>
              <SelectItem value="bodyweight">Peso corporal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {kind === "exercise_1rm" && (
          <div>
            <label className="text-[11px] text-muted-foreground">Exercício</label>
            <Select value={exId} onValueChange={setExId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolher exercício" />
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
        )}

        <div className="rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">
          Ponto de partida (atual):{" "}
          <span className="font-semibold text-foreground">
            {startValue > 0 ? `${startValue.toFixed(1)} kg` : "sem dados ainda"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-muted-foreground">Alvo (kg)</label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="ex.: 100"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Duração</label>
            <Select value={weeks} onValueChange={setWeeks}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[4, 5, 6, 7, 8].map((w) => (
                  <SelectItem key={w} value={String(w)}>
                    {w} semanas
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={create} className="w-full">
          Criar meta
        </Button>
      </div>
    </DialogContent>
  );
}
