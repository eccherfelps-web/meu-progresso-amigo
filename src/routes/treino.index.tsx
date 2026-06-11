import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card, PageHeader } from "@/components/hlt/Shell";
import { useLocalStorage, KEYS } from "@/lib/hlt/storage";
import { DEFAULT_EXERCISES, TRAINING_DAYS, exercisesForDay } from "@/lib/hlt/defaults";
import type { Exercise, WorkoutSession } from "@/lib/hlt/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, Trash2, Play, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/treino/")({
  head: () => ({ meta: [{ title: "Treino — Semana" }] }),
  component: TreinoPage,
});

const GROUP_BADGE: Record<string, string> = {
  push: "bg-info/15 text-info",
  pull: "bg-primary/15 text-primary",
  legs: "bg-warning/15 text-warning",
};

// aba inicial: o dia de treino de hoje; se hoje for descanso, o próximo dia
function defaultDay(): string {
  const today = new Date().getDay();
  if (TRAINING_DAYS.some((d) => d.dow === today)) return String(today);
  for (let i = 1; i <= 7; i++) {
    const dow = (today + i) % 7;
    const d = TRAINING_DAYS.find((x) => x.dow === dow);
    if (d) return String(d.dow);
  }
  return String(TRAINING_DAYS[0].dow);
}

function TreinoPage() {
  const [exercises, setExercises] = useLocalStorage<Exercise[]>(KEYS.exercises, DEFAULT_EXERCISES);
  const [sessions] = useLocalStorage<WorkoutSession[]>(KEYS.sessions, []);
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Record<string, string>>({});

  const weeksTraining = Math.min(8, Math.floor(sessions.length / 5));
  const deload = weeksTraining >= 8;
  const todayDow = new Date().getDay();

  const saveLoad = (id: string) => {
    const v = parseFloat(editing[id] || "0");
    setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, load_kg: isNaN(v) ? null : v } : e)));
    setEditing((p) => { const n = { ...p }; delete n[id]; return n; });
    toast.success("Carga atualizada");
  };

  const remove = (id: string) => {
    setExercises((prev) => prev.filter((e) => e.id !== id));
    toast.success("Exercício removido");
  };

  const addExercise = (day: (typeof TRAINING_DAYS)[number]) => {
    const name = prompt(`Nome do exercício (${day.label}):`);
    if (!name) return;
    setExercises((prev) => [
      ...prev,
      { id: `${day.group}-${Date.now()}`, name, group: day.group, sets: 3, reps: "10-12", load_kg: null, days: [day.dow] },
    ]);
    toast.success(`Adicionado ao treino de ${day.label}`);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader title="Plano de Treino" subtitle="Organizado por dia da semana · 5x por semana" />

      {deload && (
        <Card className="mb-4 border-warning/40 bg-warning/10">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 text-warning" />
            <div className="text-sm">
              <div className="font-semibold">Semana de deload sugerida</div>
              <div className="text-muted-foreground text-xs">Reduza ~10% da carga ou volume para recuperação.</div>
            </div>
          </div>
        </Card>
      )}

      <Tabs defaultValue={defaultDay()}>
        <TabsList className="grid grid-cols-5 w-full mb-4">
          {TRAINING_DAYS.map((d) => (
            <TabsTrigger key={d.dow} value={String(d.dow)} className="relative">
              {d.short}
              {d.dow === todayDow && <span className="absolute -top-1 -right-1 size-2 rounded-full bg-primary" />}
            </TabsTrigger>
          ))}
        </TabsList>

        {TRAINING_DAYS.map((d) => {
          const list = exercisesForDay(exercises, d);
          return (
            <TabsContent key={d.dow} value={String(d.dow)} className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <div className="font-semibold">
                    Treino de {d.label}
                    {d.dow === todayDow && <span className="ml-2 text-xs text-primary">— é hoje!</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${GROUP_BADGE[d.group]}`}>{d.group}</span>
                    <span className="text-xs text-muted-foreground">{d.focus}</span>
                  </div>
                </div>
                <Button size="sm" onClick={() => navigate({ to: "/treino/ativo", search: { type: d.group, day: d.dow } })}>
                  <Play className="size-4 mr-1" /> Iniciar Treino
                </Button>
              </div>

              {list.map((e) => (
                <Card key={e.id}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{e.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{e.sets} séries × {e.reps} reps</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {editing[e.id] !== undefined ? (
                        <>
                          <Input
                            type="number"
                            step="0.5"
                            value={editing[e.id]}
                            onChange={(ev) => setEditing((p) => ({ ...p, [e.id]: ev.target.value }))}
                            className="w-20 h-8"
                            autoFocus
                          />
                          <Button size="sm" onClick={() => saveLoad(e.id)}>OK</Button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-semibold tabular-nums">
                            {e.load_kg ? `${e.load_kg}kg` : "—"}
                          </span>
                          <Button size="icon" variant="ghost" onClick={() => setEditing((p) => ({ ...p, [e.id]: String(e.load_kg ?? "") }))}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(e.id)}>
                            <Trash2 className="size-4 text-danger" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
              {list.length === 0 && (
                <Card className="text-sm text-muted-foreground">Nenhum exercício neste dia ainda — adicione abaixo.</Card>
              )}

              <Button variant="outline" className="w-full" onClick={() => addExercise(d)}>
                <Plus className="size-4 mr-1" /> Adicionar exercício à {d.label}
              </Button>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
