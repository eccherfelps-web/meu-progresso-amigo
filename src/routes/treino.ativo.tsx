import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Card, PageHeader } from "@/components/hlt/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocalStorage, KEYS } from "@/lib/hlt/storage";
import { DEFAULT_EXERCISES, DEFAULT_SCHEDULE, daysFromSchedule } from "@/lib/hlt/defaults";
import type {
  Exercise,
  MuscleGroup,
  SessionExercise,
  WeekSchedule,
  WorkoutSession,
  WorkoutSet,
} from "@/lib/hlt/types";
import { Trophy, Timer, Check, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { Pencil, ChevronLeft, Pause, Play, RotateCcw, BellRing } from "lucide-react";
import { playAlert, unlockAudio } from "@/lib/hlt/sound";
import { DEFAULT_PROFILE } from "@/lib/hlt/defaults";
import type { Profile } from "@/lib/hlt/types";
import { checkAchievements } from "@/lib/hlt/achievements";

export const Route = createFileRoute("/treino/ativo")({
  validateSearch: z.object({
    type: z.enum(["push", "pull", "legs"]).default("push"),
    day: z.number().int().min(0).max(6).optional(),
  }),
  head: () => ({ meta: [{ title: "Treino em andamento" }] }),
  component: TreinoAtivo,
});

function TreinoAtivo() {
  const { type, day } = Route.useSearch();
  const navigate = useNavigate();
  const [exercises] = useLocalStorage<Exercise[]>(KEYS.exercises, DEFAULT_EXERCISES);
  const [sessions, setSessions] = useLocalStorage<WorkoutSession[]>(KEYS.sessions, []);
  const [schedule] = useLocalStorage<WeekSchedule>(KEYS.schedule, DEFAULT_SCHEDULE);
  const [profile] = useLocalStorage<Profile>(KEYS.profile, DEFAULT_PROFILE);
  const dayInfo = useMemo(
    () => (day != null ? daysFromSchedule(schedule).find((d) => d.dow === day) : undefined),
    [schedule, day],
  );

  const list = useMemo(
    () =>
      exercises.filter(
        (e) =>
          e.group === (type as MuscleGroup) &&
          (dayInfo == null || e.slot == null || e.slot === dayInfo.occurrence),
      ),
    [exercises, type, dayInfo],
  );

  const [phase, setPhase] = useState<"warmup" | "workout" | "done">("warmup");
  const [warmupLeft, setWarmupLeft] = useState(300);
  const [startedAt] = useState(Date.now());
  const [editSet, setEditSet] = useState<{ idx: number; weight: string; reps: string } | null>(
    null,
  );
  const [exIdx, setExIdx] = useState(0);
  // Fila de exercícios (permite pular p/ o fim) + logs POR ID — as séries e
  // cargas ficam presas ao exercício, não à posição, então nada se perde.
  // Também corrige a corrida: antes os logs nasciam dos exercícios padrão,
  // antes dos personalizados carregarem do banco.
  const [order, setOrder] = useState<string[]>([]);
  const [logs, setLogs] = useState<Record<string, SessionExercise>>({});
  useEffect(() => {
    const ids = list.map((e) => e.id);
    const anySets = Object.values(logs).some((l) => l.sets.length > 0);
    const sameIds = order.length === ids.length && order.every((id) => ids.includes(id));
    if (!anySets && !sameIds && ids.length) {
      setOrder(ids);
      setLogs(
        Object.fromEntries(
          list.map((e) => [e.id, { exercise_id: e.id, name: e.name, group: e.group, sets: [] }]),
        ),
      );
      setExIdx(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);
  const [setInput, setSetInput] = useState({ weight: "", reps: "" });
  // Descanso por timestamp (endsAt): a contagem continua correta mesmo se o
  // navegador acelerar/atrasar o intervalo com a aba em segundo plano.
  const [rest, setRest] = useState<{ endsAt: number; total: number; paused: number | null } | null>(
    null,
  );
  const [restDone, setRestDone] = useState(false);
  const [, setTick] = useState(0); // re-render do contador
  const [restPick, setRestPick] = useState(90);
  const restAlerted = useRef(false);
  // refs com os valores atuais — o callback do setInterval não "congela" o
  // perfil nem o estado do descanso de quando o efeito foi criado.
  const restRef = useRef(rest);
  restRef.current = rest;
  const soundPrefRef = useRef(profile);
  soundPrefRef.current = profile;
  const [prs, setPrs] = useState<{ exercise: string; type: "weight" | "reps"; value: number }[]>(
    [],
  );

  // warmup countdown
  useEffect(() => {
    if (phase !== "warmup") return;
    const id = setInterval(() => setWarmupLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // contagem do descanso + alerta (som/vibração/título) ao terminar
  useEffect(() => {
    if (!rest || rest.paused != null) return;
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
      if (Date.now() >= rest.endsAt && !restAlerted.current) {
        restAlerted.current = true;
        if (profile.rest_sound_enabled !== false)
          playAlert(profile.rest_sound_type ?? "beep", profile.rest_sound_volume ?? 0.7);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        toast.success("✅ Descanso concluído — próxima série!");
        const old = document.title;
        document.title = "✅ Descanso concluído!";
        setTimeout(() => (document.title = old), 5000);
        setRest(null);
        setRestDone(true);
      }
    }, 250);
    return () => clearInterval(id);
  }, [rest, profile.rest_sound_enabled, profile.rest_sound_type, profile.rest_sound_volume]);

  const startRest = (sec: number) => {
    restAlerted.current = false;
    setRestDone(false);
    setRest({ endsAt: Date.now() + sec * 1000, total: sec, paused: null });
  };
  const restRemaining = rest
    ? Math.max(0, Math.ceil(((rest.paused ?? rest.endsAt - Date.now()) as number) / 1000))
    : 0;
  const pauseRest = () =>
    setRest((r) => (r && r.paused == null ? { ...r, paused: r.endsAt - Date.now() } : r));
  const resumeRest = () =>
    setRest((r) =>
      r && r.paused != null ? { ...r, endsAt: Date.now() + r.paused, paused: null } : r,
    );
  const restartRest = () => rest && startRest(rest.total);
  const addRest = (sec: number) =>
    setRest((r) =>
      !r
        ? r
        : r.paused != null
          ? { ...r, paused: r.paused + sec * 1000, total: r.total + sec }
          : { ...r, endsAt: r.endsAt + sec * 1000, total: r.total + sec },
    );
  const endRest = () => {
    setRest(null);
    setRestDone(false);
  };

  const byId = useMemo(() => new Map(list.map((e) => [e.id, e])), [list]);
  const current = order.length ? byId.get(order[Math.min(exIdx, order.length - 1)]) : undefined;
  const currentLog = current ? logs[current.id] : undefined;
  const totalSets = list.reduce((a, e) => a + e.sets, 0);
  const doneSets = Object.values(logs).reduce((a, l) => a + l.sets.length, 0);
  const progressPct = Math.round((doneSets * 100) / totalSets);

  // Past PR lookups from previous sessions
  function pastBest(exId: string) {
    let bestW = 0,
      bestR = 0;
    for (const s of sessions) {
      const ex = s.exercises.find((x) => x.exercise_id === exId);
      if (!ex) continue;
      for (const st of ex.sets) {
        if (st.weight_kg > bestW) bestW = st.weight_kg;
        if (st.reps > bestR) bestR = st.reps;
      }
    }
    return { bestW, bestR };
  }
  const lastUse = useMemo(() => {
    if (!current) return null;
    for (let i = sessions.length - 1; i >= 0; i--) {
      const ex = sessions[i].exercises.find((x) => x.exercise_id === current.id);
      if (ex && ex.sets.length) return ex.sets[ex.sets.length - 1];
    }
    return null;
  }, [sessions, current]);

  // o descanso sugerido cadastrado no exercício vira o tempo padrão
  useEffect(() => {
    if (current?.rest_s) setRestPick(current.rest_s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (list.length === 0) {
    return (
      <div className="p-6">
        <Card>
          Nenhum exercício neste grupo. Adicione exercícios em <strong>/treino</strong>.
        </Card>
      </div>
    );
  }

  // Recalcula TODOS os recordes a partir dos logs atuais — assim, editar uma
  // série recalcula volume e PRs automaticamente (sem duplicatas).
  const recomputePrs = (allLogs: Record<string, SessionExercise>) => {
    const out: { exercise: string; type: "weight" | "reps"; value: number }[] = [];
    for (const log of Object.values(allLogs)) {
      if (!log.sets.length) continue;
      const past = pastBest(log.exercise_id);
      const bestW = Math.max(...log.sets.map((x) => x.weight_kg));
      const bestR = Math.max(...log.sets.map((x) => x.reps));
      if (bestW > past.bestW && past.bestW > 0)
        out.push({ exercise: log.name, type: "weight", value: bestW });
      if (bestR > past.bestR && past.bestR > 0)
        out.push({ exercise: log.name, type: "reps", value: bestR });
    }
    return out;
  };

  const completeSet = () => {
    if (!current || !currentLog) return;
    const w = parseFloat(setInput.weight) || current.load_kg || 0;
    const r = parseInt(setInput.reps) || 0;
    if (!r) {
      toast.error("Informe as reps");
      return;
    }
    const newSet: WorkoutSet = { weight_kg: w, reps: r };
    const newLogs = {
      ...logs,
      [current.id]: { ...logs[current.id], sets: [...logs[current.id].sets, newSet] },
    };
    setLogs(newLogs);
    const newPrs = recomputePrs(newLogs);
    if (newPrs.length > prs.length) toast.success("🏆 Novo recorde pessoal!");
    setPrs(newPrs);
    setSetInput({ weight: String(w), reps: "" });
    unlockAudio();
    startRest(restPick);
  };

  // Edição de uma série já concluída (peso/reps) com recálculo automático
  const saveSetEdit = () => {
    if (!editSet || !current || !currentLog) return;
    const w = parseFloat(editSet.weight.replace(",", "."));
    const r = parseInt(editSet.reps);
    if (isNaN(w) || w < 0 || w > 1000) {
      toast.error("Peso inválido");
      return;
    }
    if (!r || r < 1 || r > 200) {
      toast.error("Repetições inválidas");
      return;
    }
    const newLogs = {
      ...logs,
      [current.id]: {
        ...logs[current.id],
        sets: logs[current.id].sets.map((x, i) =>
          i === editSet.idx ? { weight_kg: w, reps: r } : x,
        ),
      },
    };
    setLogs(newLogs);
    setPrs(recomputePrs(newLogs));
    setEditSet(null);
    toast.success("Série atualizada — volume e recordes recalculados.");
  };

  const prevExercise = () => {
    if (exIdx === 0) return;
    setExIdx((i) => i - 1);
    setSetInput({ weight: "", reps: "" });
    endRest();
    setEditSet(null);
  };

  const nextExercise = () => {
    if (exIdx < order.length - 1) {
      setExIdx((i) => i + 1);
      setSetInput({ weight: "", reps: "" });
      endRest();
      setEditSet(null);
    } else {
      setPhase("done");
    }
  };

  // NOVO: pular exercício (equipamento ocupado) — move para o fim da fila
  // sem perder nenhuma série/carga já registrada.
  const skipExercise = () => {
    if (!current) return;
    if (exIdx >= order.length - 1) {
      toast.info("Este é o último exercício — não há próximo para pular.");
      return;
    }
    const skipped = current.name;
    setOrder((prev) => {
      const next = [...prev];
      const [id] = next.splice(exIdx, 1);
      next.push(id);
      return next;
    });
    setSetInput({ weight: "", reps: "" });
    endRest();
    toast.info(`"${skipped}" foi para o fim da fila — séries registradas mantidas.`);
  };

  const finishWorkout = () => {
    const duration = Math.round((Date.now() - startedAt) / 60000);
    const session: WorkoutSession = {
      id: `s-${Date.now()}`,
      date: new Date().toISOString(),
      type: type as MuscleGroup,
      duration_min: duration,
      exercises: order.map((id) => logs[id]).filter((l) => l && l.sets.length > 0),
      prs,
    };
    setSessions((prev) => [...prev, session]);
    toast.success("Sessão salva!");
    // verifica conquistas com os dados recém-salvos (pequeno delay p/ persistir)
    setTimeout(async () => {
      const fresh = await checkAchievements();
      for (const a of fresh) toast.success(`${a.icon} Conquista desbloqueada: ${a.name}!`);
    }, 600);
    navigate({ to: "/treino" });
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (phase === "warmup") {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <PageHeader
          title="Aquecimento"
          subtitle={`${dayInfo ? `Treino de ${dayInfo.label} · ` : ""}5 minutos de mobilidade leve`}
        />
        <Card className="text-center py-12">
          <Timer className="size-12 mx-auto mb-4 text-primary" />
          <div className="text-6xl font-bold tabular-nums">{fmtTime(warmupLeft)}</div>
          <div className="flex justify-center gap-2 mt-6">
            <Button variant="outline" onClick={() => setPhase("workout")}>
              <SkipForward className="size-4 mr-1" /> Pular
            </Button>
            <Button onClick={() => setPhase("workout")} disabled={warmupLeft > 0}>
              Começar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (phase === "done") {
    const totalVolume = Object.values(logs).reduce(
      (a, l) => a + l.sets.reduce((b, s) => b + s.weight_kg * s.reps, 0),
      0,
    );
    const duration = Math.round((Date.now() - startedAt) / 60000);
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <PageHeader title="🎉 Treino concluído!" />
        <Card className="mb-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{duration}min</div>
              <div className="text-xs text-muted-foreground">duração</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{Math.round(totalVolume)}kg</div>
              <div className="text-xs text-muted-foreground">volume</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{prs.length}</div>
              <div className="text-xs text-muted-foreground">PRs 🏆</div>
            </div>
          </div>
        </Card>
        {prs.length > 0 && (
          <Card className="mb-4 border-warning/30">
            <div className="font-semibold mb-2">🏆 Novos recordes</div>
            {prs.map((p, i) => (
              <div key={i} className="text-sm">
                {p.exercise} — {p.type === "weight" ? `${p.value}kg` : `${p.value} reps`}
              </div>
            ))}
          </Card>
        )}
        <div className="flex gap-2">
          <Button onClick={finishWorkout} className="flex-1">
            Salvar sessão
          </Button>
          <Button variant="outline" onClick={() => navigate({ to: "/treino" })}>
            Descartar
          </Button>
        </div>
      </div>
    );
  }

  if (!current || !currentLog) {
    return (
      <div className="p-6">
        <Card>Preparando o treino…</Card>
      </div>
    );
  }

  const setNum = currentLog.sets.length + 1;
  const isLastExercise = exIdx >= order.length - 1;
  const resting = rest != null;
  const restPct = rest ? Math.max(0, Math.min(1, restRemaining / rest.total)) : 0;
  const RING = 2 * Math.PI * 54; // circunferência do anel (r=54)

  return (
    <div className="p-3 pb-6 md:p-8 max-w-md md:max-w-2xl mx-auto">
      {/* ── progresso compacto ── */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>
            Exercício{" "}
            <span className="font-semibold text-foreground">
              {exIdx + 1}/{order.length}
            </span>
          </span>
          <span>
            {doneSets}/{totalSets} séries
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* ── exercício atual (prioridade 1) ── */}
      <Card className="mb-3 py-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {dayInfo ? `Treino de ${dayInfo.label}` : type}
        </div>
        <h2 className="text-xl md:text-2xl font-bold leading-tight mt-0.5">{current.name}</h2>
        <div className="text-xs text-muted-foreground mt-1">
          Meta: {current.sets} × {current.reps}
          {current.load_kg ? ` · sugerido ${current.load_kg}kg` : ""}
          {lastUse ? ` · último: ${lastUse.weight_kg}kg × ${lastUse.reps}` : ""}
        </div>
      </Card>

      {/* ── TEMPORIZADOR DE DESCANSO (elemento principal ao descansar) ── */}
      <Card
        className={`mb-3 text-center transition-all duration-300 ${
          resting
            ? "ring-2 ring-primary/70 shadow-lg shadow-primary/10 py-4"
            : restDone
              ? "ring-2 ring-success/70 py-4"
              : "py-2.5"
        }`}
        aria-live="polite"
      >
        {resting ? (
          <>
            <div className="relative mx-auto size-36">
              <svg viewBox="0 0 120 120" className="size-36 -rotate-90">
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="var(--color-muted)"
                  strokeWidth="7"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke={restRemaining <= 5 ? "var(--color-success)" : "var(--color-primary)"}
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={RING}
                  strokeDashoffset={RING * (1 - restPct)}
                  className="transition-[stroke-dashoffset] duration-300 ease-linear"
                />
              </svg>
              <div
                className={`absolute inset-0 flex flex-col items-center justify-center ${
                  restRemaining <= 5 ? "animate-pulse" : ""
                }`}
              >
                <span className="text-4xl font-bold tabular-nums">{fmtTime(restRemaining)}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {rest.paused != null ? "pausado" : "descanso"}
                </span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-1.5">
              {rest.paused != null ? (
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={resumeRest}
                  aria-label="Continuar descanso"
                >
                  <Play className="size-4" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={pauseRest}
                  aria-label="Pausar descanso"
                >
                  <Pause className="size-4" />
                </Button>
              )}
              <Button
                variant="outline"
                className="h-11"
                onClick={restartRest}
                aria-label="Reiniciar descanso"
              >
                <RotateCcw className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="h-11 text-xs font-semibold"
                onClick={() => addRest(15)}
              >
                +15s
              </Button>
              <Button
                variant="outline"
                className="h-11 text-xs font-semibold"
                onClick={() => addRest(30)}
              >
                +30s
              </Button>
              <Button className="h-11 text-xs font-semibold" onClick={endRest}>
                Pular
              </Button>
            </div>
          </>
        ) : restDone ? (
          <div className="flex flex-col items-center gap-2">
            <BellRing className="size-8 text-success animate-bounce" />
            <div className="font-semibold text-success">Descanso concluído!</div>
            <div className="text-xs text-muted-foreground">Pode iniciar a série {setNum}.</div>
            <Button size="sm" variant="outline" className="h-9" onClick={() => setRestDone(false)}>
              Ok, bora 💪
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground flex-wrap">
            <span>Descanso automático:</span>
            {[60, 90, 120, 180].map((sec) => (
              <button
                key={sec}
                onClick={() => setRestPick(sec)}
                className={`px-2.5 py-1 rounded-full border text-xs font-semibold transition ${
                  restPick === sec
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* ── série atual + registro ── */}
      <Card className="mb-3">
        <div className="flex items-baseline justify-between mb-2">
          <div className="font-semibold">
            Série {Math.min(setNum, current.sets)}
            {setNum > current.sets ? "+" : ""} de {current.sets}
          </div>
          <span className="text-xs text-muted-foreground">{currentLog.sets.length} concluídas</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-[11px] text-muted-foreground block mb-1">Peso (kg)</label>
            <Input
              type="number"
              step="0.5"
              inputMode="decimal"
              className="h-12 text-lg text-center font-semibold"
              placeholder={current.load_kg ? String(current.load_kg) : "0"}
              value={setInput.weight}
              onChange={(e) => setSetInput({ ...setInput, weight: e.target.value })}
              aria-label="Peso em kg"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block mb-1">Repetições</label>
            <Input
              type="number"
              inputMode="numeric"
              className="h-12 text-lg text-center font-semibold"
              placeholder={current.reps}
              value={setInput.reps}
              onChange={(e) => setSetInput({ ...setInput, reps: e.target.value })}
              aria-label="Repetições"
            />
          </div>
        </div>

        {/* séries concluídas como chips compactos (toque para editar) */}
        {currentLog.sets.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {currentLog.sets.map((st, i) => (
              <button
                key={i}
                onClick={() =>
                  setEditSet({ idx: i, weight: String(st.weight_kg), reps: String(st.reps) })
                }
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs tabular-nums transition ${
                  editSet?.idx === i
                    ? "border-primary bg-primary/15"
                    : "border-success/40 bg-success/10 text-foreground"
                }`}
                aria-label={`Editar série ${i + 1}: ${st.weight_kg}kg × ${st.reps}`}
              >
                <Check className="size-3 text-success" />
                {st.weight_kg}kg×{st.reps}
                <Pencil className="size-2.5 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}

        {/* editor inline da série selecionada */}
        {editSet && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 p-2">
            <span className="text-xs shrink-0">Série {editSet.idx + 1}:</span>
            <Input
              type="number"
              step="0.5"
              inputMode="decimal"
              className="h-9 w-20 text-center"
              value={editSet.weight}
              onChange={(e) => setEditSet({ ...editSet, weight: e.target.value })}
              aria-label="Peso (kg)"
              autoFocus
            />
            <span className="text-xs text-muted-foreground">kg ×</span>
            <Input
              type="number"
              inputMode="numeric"
              className="h-9 w-16 text-center"
              value={editSet.reps}
              onChange={(e) => setEditSet({ ...editSet, reps: e.target.value })}
              aria-label="Repetições"
            />
            <Button size="sm" className="h-9" onClick={saveSetEdit}>
              OK
            </Button>
            <Button size="sm" variant="ghost" className="h-9" onClick={() => setEditSet(null)}>
              ✕
            </Button>
          </div>
        )}
      </Card>

      {/* ── ações principais (grandes, para uma mão) ── */}
      <Button onClick={completeSet} className="w-full h-14 text-lg font-bold mb-2">
        ✅ Concluir série {Math.min(setNum, current.sets)}
      </Button>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <Button
          onClick={prevExercise}
          variant="outline"
          className="h-12"
          disabled={exIdx === 0}
          aria-label="Exercício anterior"
        >
          <ChevronLeft className="size-4" /> Anterior
        </Button>
        <Button
          onClick={skipExercise}
          variant="outline"
          className="h-12"
          disabled={isLastExercise}
          aria-label="Pular exercício"
        >
          <SkipForward className="size-4" /> Pular
        </Button>
        <Button
          onClick={nextExercise}
          variant={isLastExercise ? "outline" : "default"}
          className="h-12"
          aria-label={isLastExercise ? "Revisar treino antes de finalizar" : "Próximo exercício"}
          title={
            isLastExercise
              ? "Abre a tela de resumo do treino para você conferir tudo antes de salvar"
              : "Avança para o próximo exercício"
          }
        >
          {isLastExercise ? "Revisar ✓" : "Próximo →"}
        </Button>
      </div>

      <Button
        onClick={() => setPhase("done")}
        variant={isLastExercise ? "default" : "outline"}
        className={`w-full h-12 font-semibold ${isLastExercise ? "" : "text-muted-foreground"}`}
      >
        🏁 Finalizar treino
      </Button>
      {isLastExercise && (
        <p className="text-[11px] text-muted-foreground text-center mt-2">
          <strong>Revisar ✓</strong> abre o resumo do treino (volume, recordes e duração) para você
          conferir antes de salvar. <strong>Finalizar treino</strong> salva tudo direto.
        </p>
      )}
    </div>
  );
}
