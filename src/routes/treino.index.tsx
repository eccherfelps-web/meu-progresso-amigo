import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, PageHeader } from "@/components/hlt/Shell";
import { WorkoutPlansSection } from "@/components/hlt/WorkoutPlans";
import { useLocalStorage, KEYS } from "@/lib/hlt/storage";
import {
  DEFAULT_EXERCISES,
  DEFAULT_SCHEDULE,
  DOW_SHORT,
  daysFromSchedule,
  DOW_LABEL,
  dayGroups,
  exercisesForDay,
  type TrainingDay,
} from "@/lib/hlt/defaults";
import type {
  Exercise,
  WeekSchedule,
  WorkoutSession,
  WorkoutPlan,
  ActiveWorkoutDraft,
} from "@/lib/hlt/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ExerciseForm } from "@/components/hlt/ExerciseForm";
import { HistorySection } from "@/components/hlt/WorkoutHistory";
import { MUSCLE_ICON } from "@/lib/hlt/exerciseCatalog";
import {
  Pencil,
  Plus,
  Trash2,
  Play,
  AlertCircle,
  CalendarRange,
  Star,
  GripVertical,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Dumbbell,
  Timer,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/treino/")({
  head: () => ({ meta: [{ title: "Treino — Semana" }] }),
  component: TreinoPage,
});

const GROUP_BADGE: Record<string, string> = {
  push: "bg-info/15 text-info",
  pull: "bg-success/15 text-success",
  legs: "bg-warning/15 text-warning",
  rest: "bg-muted text-muted-foreground",
};
const GROUP_SHORT: Record<string, string> = {
  push: "PUSH",
  pull: "PULL",
  legs: "LEGS",
  rest: "Descanso",
};

function TreinoPage() {
  const [exercises, setExercises] = useLocalStorage<Exercise[]>(KEYS.exercises, DEFAULT_EXERCISES);
  const [plans] = useLocalStorage<WorkoutPlan[]>(KEYS.plans, []);
  const [sessions] = useLocalStorage<WorkoutSession[]>(KEYS.sessions, []);
  const [schedule, setSchedule] = useLocalStorage<WeekSchedule>(KEYS.schedule, DEFAULT_SCHEDULE);
  const navigate = useNavigate();

  const days = useMemo(() => daysFromSchedule(schedule), [schedule]);
  const todayDow = new Date().getDay();

  const [tab, setTab] = useState<string>(() => String(todayDow));
  const activeTab = days.some((d) => String(d.dow) === tab) ? tab : String(days[0]?.dow ?? 1);

  // ── formulário de criar/editar ──
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Exercise | null>(null);
  const [formDay, setFormDay] = useState<TrainingDay | null>(null);

  const recents = useMemo(() => {
    const names: string[] = [];
    for (let i = sessions.length - 1; i >= 0 && names.length < 8; i--) {
      for (const ex of sessions[i].exercises) if (!names.includes(ex.name)) names.push(ex.name);
    }
    return names;
  }, [sessions]);

  const saveExercise = (ex: Exercise) => {
    setExercises((prev) => {
      const exists = prev.some((e) => e.id === ex.id);
      return exists ? prev.map((e) => (e.id === ex.id ? ex : e)) : [...prev, ex];
    });
    toast.success(
      editTarget
        ? "Exercício atualizado — estatísticas e gráficos já refletem."
        : `"${ex.name}" adicionado!`,
    );
  };

  // ── exclusão com Desfazer ──
  const remove = (ex: Exercise) => {
    setExercises((prev) => prev.filter((e) => e.id !== ex.id));
    toast(`"${ex.name}" removido.`, {
      duration: 6000,
      action: {
        label: "Desfazer",
        onClick: () => {
          setExercises((prev) => (prev.some((e) => e.id === ex.id) ? prev : [...prev, ex]));
          toast.success("Exercício restaurado!");
        },
      },
    });
  };

  const toggleFav = (id: string) =>
    setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, fav: !e.fav } : e)));

  // ── reordenar exercícios dentro de um dia (mover ↑/↓ + arrastar) ──
  const moveExercise = (dayList: Exercise[], id: string, dir: -1 | 1) => {
    const idx = dayList.findIndex((e) => e.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= dayList.length) return;
    const a = dayList[idx],
      b = dayList[target];
    // troca a ordem manual entre os dois vizinhos (normalizando se ausente)
    setExercises((prev) => {
      const orderOf = (ex: Exercise) => ex.order ?? dayList.findIndex((x) => x.id === ex.id);
      const oa = orderOf(a),
        ob = orderOf(b);
      return prev.map((e) => {
        if (e.id === a.id) return { ...e, order: ob };
        if (e.id === b.id) return { ...e, order: oa };
        return e;
      });
    });
  };
  const reorderByDrag = (dayList: Exercise[], fromId: string, toId: string) => {
    if (fromId === toId) return;
    const ids = dayList.map((e) => e.id);
    const from = ids.indexOf(fromId),
      to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setExercises((prev) =>
      prev.map((e) => {
        const pos = ids.indexOf(e.id);
        return pos >= 0 ? { ...e, order: pos } : e;
      }),
    );
    toast.success("Ordem dos exercícios atualizada.");
  };
  const [dragExId, setDragExId] = useState<string | null>(null);

  // ── editor do cronograma: liga/desliga grupos por dia (múltiplos!) ──
  const [editWeek, setEditWeek] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [planPick, setPlanPick] = useState<{
    dow: number;
    group: "push" | "pull" | "legs";
  } | null>(null);

  const toggleGroup = (dow: number, group: "push" | "pull" | "legs") => {
    const current = dayGroups(schedule[dow]);
    const has = current.includes(group);
    // desligar: sempre direto
    if (has) {
      applyGroupToDay(dow, group, false);
      return;
    }
    // ligar: se houver planos salvos deste grupo, oferece escolher qual usar
    const groupPlans = plans.filter((p) => p.group === group);
    if (groupPlans.length >= 1) {
      setPlanPick({ dow, group });
    } else {
      applyGroupToDay(dow, group, true);
    }
  };

  // aplica (liga/desliga) um grupo a um dia
  const applyGroupToDay = (dow: number, group: "push" | "pull" | "legs", turnOn: boolean) => {
    setSchedule((prev) => {
      const next = [...prev] as WeekSchedule;
      const current = dayGroups(next[dow]);
      const updated = turnOn ? [...current, group] : current.filter((g) => g !== group);
      next[dow] = updated.length === 0 ? "rest" : updated.length === 1 ? updated[0] : updated;
      return next;
    });
  };

  // aplica um PLANO salvo a um dia: liga o grupo e materializa os exercícios do
  // plano nesse dia (com slot = ocorrência do grupo naquele dia).
  const applyPlanToDay = (planId: string) => {
    if (!planPick) return;
    const { dow, group } = planPick;
    const plan = plans.find((p) => p.id === planId);
    if (!plan) {
      setPlanPick(null);
      return;
    }
    // 1) liga o grupo no dia e calcula a ocorrência resultante
    const withDay = [...schedule] as WeekSchedule;
    const cur = dayGroups(withDay[dow]);
    withDay[dow] = [...cur, group].length === 1 ? group : [...cur, group];
    const thisDay = daysFromSchedule(withDay).find((d) => d.dow === dow);
    const occ = thisDay?.occ[group] ?? 0;

    // 2) remove exercícios antigos desse grupo+ocorrência (evita duplicar) e
    //    materializa os do plano com o slot certo
    setExercises((prev) => {
      const cleaned = prev.filter((e) => !(e.group === group && e.slot === occ));
      const materialized = plan.exercises.map((pe, i) => ({
        id: `${plan.id}-${occ}-${pe.id}`,
        name: pe.name,
        group,
        sets: pe.sets,
        reps: pe.reps,
        load_kg: pe.load_kg ?? null,
        rest_s: pe.rest_s,
        muscle: pe.muscle,
        equipment: pe.equipment,
        kind: pe.kind,
        bodyweight: pe.bodyweight,
        notes: pe.notes,
        slot: occ,
        order: pe.order ?? i,
      }));
      return [...cleaned, ...materialized];
    });
    // 3) grava o schedule
    setSchedule(withDay);
    toast.success(`"${plan.name}" aplicado a ${DOW_LABEL[dow]}.`);
    setPlanPick(null);
  };

  const weeksTraining = Math.min(8, Math.floor(sessions.length / 5));
  const [activeDraft] = useLocalStorage<ActiveWorkoutDraft | null>(KEYS.activeWorkout, null);
  const draftMinutesAgo = activeDraft
    ? Math.max(0, Math.round((Date.now() - activeDraft.startedAt) / 60000))
    : 0;
  const deload = weeksTraining >= 8;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <PageHeader title="Plano de Treino" subtitle="Organizado por dia da semana" />
        <div className="flex gap-2">
          <Button
            variant={showPlans ? "default" : "outline"}
            size="sm"
            onClick={() => setShowPlans((v) => !v)}
          >
            <Dumbbell className="size-4 mr-1" /> {showPlans ? "Fechar planos" : "Meus planos"}
          </Button>
          <Button
            variant={editWeek ? "default" : "outline"}
            size="sm"
            onClick={() => setEditWeek((v) => !v)}
          >
            <CalendarRange className="size-4 mr-1" /> {editWeek ? "Concluir" : "Editar semana"}
          </Button>
        </div>
      </div>

      {showPlans && <WorkoutPlansSection />}

      {activeDraft && (
        <Card className="mb-4 border-primary/40 bg-primary/5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Timer className="size-4 text-primary shrink-0" />
              <div className="text-sm">
                <span className="font-semibold">
                  Treino de {GROUP_SHORT[activeDraft.type] ?? activeDraft.type} em andamento
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · iniciado há {draftMinutesAgo} min ·{" "}
                  {Object.values(activeDraft.logs).reduce((a, l) => a + l.sets.length, 0)} séries
                  registradas
                </span>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() =>
                navigate({
                  to: "/treino/ativo",
                  search: {
                    type: activeDraft.type as "push" | "pull" | "legs",
                    day: activeDraft.day ?? undefined,
                  },
                })
              }
            >
              Continuar treino
            </Button>
          </div>
        </Card>
      )}

      {editWeek && (
        <Card className="mb-4">
          <div className="text-sm font-semibold mb-1">Montar a semana</div>
          <div className="text-xs text-muted-foreground mb-3">
            Toque para ligar/desligar cada grupo em cada dia. Um mesmo dia pode ter vários grupos
            (ex.: Sábado com Pull + Legs). Exercícios, histórico e estatísticas são preservados.
          </div>
          <div className="space-y-1.5">
            {Array.from({ length: 7 }, (_, dow) => {
              const groups = dayGroups(schedule[dow]);
              return (
                <div
                  key={dow}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${dow === todayDow ? "border-primary/40 bg-accent/30" : "border-border"}`}
                >
                  <span className="w-9 text-sm font-semibold">{DOW_SHORT[dow]}</span>
                  <div className="flex gap-1.5 flex-1">
                    {(["push", "pull", "legs"] as const).map((g) => {
                      const on = groups.includes(g);
                      return (
                        <button
                          key={g}
                          onClick={() => toggleGroup(dow, g)}
                          className={`flex-1 rounded-md py-1.5 text-[11px] font-bold uppercase transition ${
                            on ? GROUP_BADGE[g] : "bg-muted/40 text-muted-foreground/60"
                          }`}
                        >
                          {GROUP_SHORT[g]}
                        </button>
                      );
                    })}
                  </div>
                  <span className="w-12 text-right text-[10px] text-muted-foreground">
                    {groups.length === 0
                      ? "folga"
                      : `${groups.length} grupo${groups.length > 1 ? "s" : ""}`}
                  </span>
                </div>
              );
            })}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-muted-foreground"
            onClick={() => {
              setSchedule(DEFAULT_SCHEDULE);
              toast.success("Cronograma padrão restaurado.");
            }}
          >
            <RotateCcw className="size-3.5 mr-1" /> Restaurar padrão (Seg Push · Ter Pull · Qua Legs
            · Sex Push · Sáb Pull)
          </Button>
        </Card>
      )}

      {deload && (
        <Card className="mb-4 border-warning/40 bg-warning/10">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 text-warning" />
            <div className="text-sm">
              <div className="font-semibold">Semana de deload sugerida</div>
              <div className="text-muted-foreground text-xs">
                Reduza ~10% da carga ou volume para recuperação.
              </div>
            </div>
          </div>
        </Card>
      )}

      {days.length === 0 ? (
        <Card>Sem dias de treino no cronograma — use "Reorganizar semana" para definir.</Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setTab}>
          <TabsList
            className="w-full mb-4"
            style={{ display: "grid", gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
          >
            {days.map((d) => (
              <TabsTrigger key={d.dow} value={String(d.dow)} className="relative">
                {d.short}
                {d.dow === todayDow && (
                  <span className="absolute -top-1 -right-1 size-2 rounded-full bg-primary" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {days.map((d) => {
            const list = exercisesForDay(exercises, d);
            return (
              <TabsContent key={d.dow} value={String(d.dow)} className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-semibold">
                      Treino de {d.label}
                      {d.dow === todayDow && (
                        <span className="ml-2 text-xs text-primary">— é hoje!</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {d.groups.map((g) => (
                        <span
                          key={g}
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${GROUP_BADGE[g]}`}
                        >
                          {g}
                        </span>
                      ))}
                      <span className="text-xs text-muted-foreground">{d.focus}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() =>
                      navigate({ to: "/treino/ativo", search: { type: d.group, day: d.dow } })
                    }
                  >
                    <Play className="size-4 mr-1" /> Iniciar Treino
                  </Button>
                </div>

                {list.map((e, exPos) => (
                  <div
                    key={e.id}
                    draggable
                    onDragStart={() => setDragExId(e.id)}
                    onDragOver={(ev: React.DragEvent) => ev.preventDefault()}
                    onDrop={() => {
                      if (dragExId) reorderByDrag(list, dragExId, e.id);
                      setDragExId(null);
                    }}
                    className={dragExId === e.id ? "opacity-50" : ""}
                  >
                    <Card>
                      <div className="flex items-start gap-2">
                        {/* alça + mover ↑/↓ */}
                        <div className="flex flex-col items-center -ml-1 mt-0.5">
                          <button
                            onClick={() => moveExercise(list, e.id, -1)}
                            disabled={exPos === 0}
                            aria-label="Mover para cima"
                            className="text-muted-foreground hover:text-foreground disabled:opacity-25 leading-none"
                          >
                            <ChevronUp className="size-4" />
                          </button>
                          <GripVertical className="size-3.5 text-muted-foreground/40 cursor-grab active:cursor-grabbing" />
                          <button
                            onClick={() => moveExercise(list, e.id, 1)}
                            disabled={exPos === list.length - 1}
                            aria-label="Mover para baixo"
                            className="text-muted-foreground hover:text-foreground disabled:opacity-25 leading-none"
                          >
                            <ChevronDown className="size-4" />
                          </button>
                        </div>
                        <button
                          onClick={() => toggleFav(e.id)}
                          aria-label="Favoritar"
                          className="mt-0.5"
                        >
                          <Star
                            className={`size-4 ${e.fav ? "fill-warning text-warning" : "text-muted-foreground/50"}`}
                          />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium flex items-center gap-1.5">
                            {e.muscle && (
                              <span title={e.muscle}>{MUSCLE_ICON[e.muscle] ?? ""}</span>
                            )}
                            {e.name}
                            {d.groups.length > 1 && (
                              <span
                                className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${GROUP_BADGE[e.group]}`}
                              >
                                {GROUP_SHORT[e.group]}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {e.sets} × {e.reps}
                            {e.rest_s ? ` · descanso ${e.rest_s}s` : ""}
                            {e.equipment ? ` · ${e.equipment}` : ""}
                            {e.slot != null
                              ? ` · só ${days.find((x) => x.groups.includes(e.group) && x.occ[e.group] === e.slot)?.label ?? `${e.slot + 1}º dia do grupo`}`
                              : ""}
                          </div>
                          {e.notes && <div className="text-[11px] text-info mt-0.5">{e.notes}</div>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold tabular-nums">
                            {e.load_kg ? `${e.load_kg}kg` : "—"}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditTarget(e);
                              setFormDay(d);
                              setFormOpen(true);
                            }}
                            aria-label="Editar"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => remove(e)}
                            aria-label="Excluir"
                          >
                            <Trash2 className="size-4 text-danger" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </div>
                ))}
                {list.length === 0 && (
                  <Card className="text-sm text-muted-foreground">
                    Nenhum exercício neste dia ainda — adicione abaixo.
                  </Card>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setEditTarget(null);
                    setFormDay(d);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="size-4 mr-1" /> Adicionar exercício à {d.label}
                </Button>
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      <HistorySection sessions={sessions} />

      <ExerciseForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editTarget}
        defaultGroup={formDay?.group ?? "push"}
        defaultSlot={
          formDay && days.filter((x) => x.group === formDay.group).length > 1
            ? formDay.occurrence
            : null
        }
        days={days}
        recents={recents}
        onSave={saveExercise}
      />

      {/* Atribuição Inteligente: escolher qual PLANO salvo usar no dia */}
      <Dialog open={planPick != null} onOpenChange={(o) => !o && setPlanPick(null)}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Qual plano de {planPick ? GROUP_SHORT[planPick.group] : ""} usar em{" "}
              {planPick ? DOW_LABEL[planPick.dow] : ""}?
            </DialogTitle>
          </DialogHeader>
          <div className="text-xs text-muted-foreground mb-1">
            Escolha um dos seus planos salvos deste grupo. Os exercícios do plano serão aplicados a
            este dia.
          </div>
          <div className="space-y-2">
            {plans
              .filter((p) => planPick && p.group === planPick.group)
              .map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => applyPlanToDay(plan.id)}
                  className="w-full text-left rounded-lg border border-border hover:border-primary hover:bg-accent p-3 transition"
                >
                  <div className="font-semibold text-sm">{plan.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {plan.exercises.map((e) => e.name).join(", ")}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {plan.exercises.length} exercícios
                  </div>
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
