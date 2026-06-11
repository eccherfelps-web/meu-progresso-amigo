import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Card, PageHeader } from "@/components/hlt/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocalStorage, KEYS } from "@/lib/hlt/storage";
import { DEFAULT_EXERCISES, TRAINING_DAYS } from "@/lib/hlt/defaults";
import type { Exercise, MuscleGroup, SessionExercise, WorkoutSession, WorkoutSet } from "@/lib/hlt/types";
import { Trophy, Timer, Check, SkipForward } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/treino/ativo")({
  validateSearch: z.object({ type: z.enum(["push", "pull", "legs"]).default("push"), day: z.number().int().min(0).max(6).optional() }),
  head: () => ({ meta: [{ title: "Treino em andamento" }] }),
  component: TreinoAtivo,
});

function TreinoAtivo() {
  const { type, day } = Route.useSearch();
  const navigate = useNavigate();
  const [exercises] = useLocalStorage<Exercise[]>(KEYS.exercises, DEFAULT_EXERCISES);
  const [sessions, setSessions] = useLocalStorage<WorkoutSession[]>(KEYS.sessions, []);
  const dayInfo = day != null ? TRAINING_DAYS.find((d) => d.dow === day) : undefined;

  const list = useMemo(
    () => exercises.filter((e) =>
      e.group === (type as MuscleGroup) && (day == null || !e.days || e.days.includes(day))),
    [exercises, type, day],
  );

  const [phase, setPhase] = useState<"warmup" | "workout" | "done">("warmup");
  const [warmupLeft, setWarmupLeft] = useState(300);
  const [startedAt] = useState(Date.now());
  const [exIdx, setExIdx] = useState(0);
  const [logs, setLogs] = useState<SessionExercise[]>(
    list.map((e) => ({ exercise_id: e.id, name: e.name, group: e.group, sets: [] })),
  );
  const [setInput, setSetInput] = useState({ weight: "", reps: "" });
  const [restLeft, setRestLeft] = useState(0);
  const [restPick, setRestPick] = useState(90);
  const restRef = useRef<number | null>(null);
  const [prs, setPrs] = useState<{ exercise: string; type: "weight" | "reps"; value: number }[]>([]);

  // warmup countdown
  useEffect(() => {
    if (phase !== "warmup") return;
    const id = setInterval(() => setWarmupLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // rest countdown
  useEffect(() => {
    if (restLeft <= 0) {
      if (restRef.current) { clearInterval(restRef.current); restRef.current = null; }
      return;
    }
    if (restRef.current) return;
    restRef.current = window.setInterval(() => {
      setRestLeft((s) => {
        if (s <= 1) {
          if (navigator.vibrate) navigator.vibrate(200);
          toast.success("Descanso concluído!");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (restRef.current) { clearInterval(restRef.current); restRef.current = null; }
    };
  }, [restLeft]);

  if (list.length === 0) {
    return (
      <div className="p-6">
        <Card>Nenhum exercício neste grupo. Adicione exercícios em <strong>/treino</strong>.</Card>
      </div>
    );
  }

  const current = list[exIdx];
  const currentLog = logs[exIdx];
  const totalSets = list.reduce((a, e) => a + e.sets, 0);
  const doneSets = logs.reduce((a, l) => a + l.sets.length, 0);
  const progressPct = Math.round((doneSets * 100) / totalSets);

  // Past PR lookups from previous sessions
  function pastBest(exId: string) {
    let bestW = 0, bestR = 0;
    for (const s of sessions) {
      const ex = s.exercises.find((x) => x.exercise_id === exId);
      if (!ex) continue;
      for (const st of ex.sets) { if (st.weight_kg > bestW) bestW = st.weight_kg; if (st.reps > bestR) bestR = st.reps; }
    }
    return { bestW, bestR };
  }
  const lastUse = useMemo(() => {
    for (let i = sessions.length - 1; i >= 0; i--) {
      const ex = sessions[i].exercises.find((x) => x.exercise_id === current.id);
      if (ex && ex.sets.length) return ex.sets[ex.sets.length - 1];
    }
    return null;
  }, [sessions, current.id]);

  const completeSet = () => {
    const w = parseFloat(setInput.weight) || current.load_kg || 0;
    const r = parseInt(setInput.reps) || 0;
    if (!r) { toast.error("Informe as reps"); return; }
    const newSet: WorkoutSet = { weight_kg: w, reps: r };
    const past = pastBest(current.id);
    const newPrs = [...prs];
    if (w > past.bestW && past.bestW > 0) newPrs.push({ exercise: current.name, type: "weight", value: w });
    if (r > past.bestR && past.bestR > 0) newPrs.push({ exercise: current.name, type: "reps", value: r });
    setPrs(newPrs);
    if (newPrs.length > prs.length) toast.success("🏆 Novo recorde pessoal!");
    setLogs((prev) => prev.map((l, i) => (i === exIdx ? { ...l, sets: [...l.sets, newSet] } : l)));
    setSetInput({ weight: String(w), reps: "" });
    setRestLeft(restPick);
  };

  const nextExercise = () => {
    if (exIdx < list.length - 1) {
      setExIdx((i) => i + 1);
      setSetInput({ weight: "", reps: "" });
      setRestLeft(0);
    } else {
      setPhase("done");
    }
  };

  const finishWorkout = () => {
    const duration = Math.round((Date.now() - startedAt) / 60000);
    const session: WorkoutSession = {
      id: `s-${Date.now()}`,
      date: new Date().toISOString(),
      type: type as MuscleGroup,
      duration_min: duration,
      exercises: logs.filter((l) => l.sets.length > 0),
      prs,
    };
    setSessions((prev) => [...prev, session]);
    toast.success("Sessão salva!");
    navigate({ to: "/treino" });
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (phase === "warmup") {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <PageHeader title="Aquecimento" subtitle={`${dayInfo ? `Treino de ${dayInfo.label} · ` : ""}5 minutos de mobilidade leve`} />
        <Card className="text-center py-12">
          <Timer className="size-12 mx-auto mb-4 text-primary" />
          <div className="text-6xl font-bold tabular-nums">{fmtTime(warmupLeft)}</div>
          <div className="flex justify-center gap-2 mt-6">
            <Button variant="outline" onClick={() => setPhase("workout")}>
              <SkipForward className="size-4 mr-1" /> Pular
            </Button>
            <Button onClick={() => setPhase("workout")} disabled={warmupLeft > 0}>Começar</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (phase === "done") {
    const totalVolume = logs.reduce(
      (a, l) => a + l.sets.reduce((b, s) => b + s.weight_kg * s.reps, 0),
      0,
    );
    const duration = Math.round((Date.now() - startedAt) / 60000);
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <PageHeader title="🎉 Treino concluído!" />
        <Card className="mb-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div><div className="text-2xl font-bold">{duration}min</div><div className="text-xs text-muted-foreground">duração</div></div>
            <div><div className="text-2xl font-bold">{Math.round(totalVolume)}kg</div><div className="text-xs text-muted-foreground">volume</div></div>
            <div><div className="text-2xl font-bold">{prs.length}</div><div className="text-xs text-muted-foreground">PRs 🏆</div></div>
          </div>
        </Card>
        {prs.length > 0 && (
          <Card className="mb-4 border-warning/30">
            <div className="font-semibold mb-2">🏆 Novos recordes</div>
            {prs.map((p, i) => (
              <div key={i} className="text-sm">{p.exercise} — {p.type === "weight" ? `${p.value}kg` : `${p.value} reps`}</div>
            ))}
          </Card>
        )}
        <div className="flex gap-2">
          <Button onClick={finishWorkout} className="flex-1">Salvar sessão</Button>
          <Button variant="outline" onClick={() => navigate({ to: "/treino" })}>Descartar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">Progresso</span>
          <span className="font-semibold">{doneSets}/{totalSets} séries</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <Card className="mb-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Exercício {exIdx + 1} / {list.length}</div>
        <div className="text-xl font-bold">{current.name}</div>
        <div className="text-xs text-muted-foreground">Meta: {current.sets} × {current.reps}</div>
        {lastUse && <div className="text-xs text-info mt-1">Última vez: {lastUse.weight_kg}kg × {lastUse.reps}</div>}
      </Card>

      <Card className="mb-4">
        <div className="text-sm font-semibold mb-3">Séries concluídas: {currentLog.sets.length} / {current.sets}</div>
        <div className="space-y-1 mb-4">
          {currentLog.sets.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <Check className="size-4 text-success" />
              Série {i + 1}: <span className="font-medium">{s.weight_kg}kg × {s.reps}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="label-up block mb-1">Peso (kg)</label>
            <Input type="number" step="0.5" inputMode="decimal" value={setInput.weight} placeholder={String(current.load_kg ?? "")} onChange={(e) => setSetInput((p) => ({ ...p, weight: e.target.value }))} />
          </div>
          <div>
            <label className="label-up block mb-1">Reps</label>
            <Input type="number" inputMode="numeric" value={setInput.reps} onChange={(e) => setSetInput((p) => ({ ...p, reps: e.target.value }))} />
          </div>
        </div>
        <Button onClick={completeSet} className="w-full">✅ Concluir série</Button>
      </Card>

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold flex items-center gap-2"><Timer className="size-4" /> Descanso</div>
          <div className="text-2xl font-bold tabular-nums">{fmtTime(restLeft)}</div>
        </div>
        <div className="flex gap-1">
          {[60, 90, 120, 180].map((s) => (
            <Button key={s} size="sm" variant={restPick === s ? "default" : "outline"} onClick={() => setRestPick(s)} className="flex-1">
              {s < 120 ? `${s}s` : `${s / 60}min`}
            </Button>
          ))}
        </div>
      </Card>

      <Button onClick={nextExercise} variant="outline" className="w-full">
        {exIdx < list.length - 1 ? "Próximo exercício →" : "Finalizar treino"}
      </Button>
    </div>
  );
}
