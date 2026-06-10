import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card, PageHeader } from "@/components/hlt/Shell";
import { useLocalStorage, KEYS } from "@/lib/hlt/storage";
import { DEFAULT_EXERCISES } from "@/lib/hlt/defaults";
import type { Exercise, MuscleGroup, WorkoutSession } from "@/lib/hlt/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, Trash2, Play, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/treino")({
  head: () => ({ meta: [{ title: "Treino — PPL" }] }),
  component: TreinoPage,
});

const GROUPS: { key: MuscleGroup; label: string; days: string; color: string }[] = [
  { key: "push", label: "Push", days: "Seg & Sex", color: "bg-info/15 text-info" },
  { key: "pull", label: "Pull", days: "Ter & Sáb", color: "bg-primary/15 text-primary" },
  { key: "legs", label: "Legs", days: "Quarta", color: "bg-warning/15 text-warning" },
];

function TreinoPage() {
  const [exercises, setExercises] = useLocalStorage<Exercise[]>(KEYS.exercises, DEFAULT_EXERCISES);
  const [sessions] = useLocalStorage<WorkoutSession[]>(KEYS.sessions, []);
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Record<string, string>>({});

  const weeksTraining = Math.min(8, Math.floor(sessions.length / 5));
  const deload = weeksTraining >= 8;

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

  const addExercise = (group: MuscleGroup) => {
    const name = prompt("Nome do exercício:");
    if (!name) return;
    setExercises((prev) => [...prev, { id: `${group}-${Date.now()}`, name, group, sets: 3, reps: "10-12", load_kg: null }]);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader title="Plano de Treino" subtitle="Push • Pull • Legs · 5x por semana" />

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

      <Tabs defaultValue="push">
        <TabsList className="grid grid-cols-3 w-full mb-4">
          {GROUPS.map((g) => (
            <TabsTrigger key={g.key} value={g.key}>{g.label}</TabsTrigger>
          ))}
        </TabsList>

        {GROUPS.map((g) => {
          const list = exercises.filter((e) => e.group === g.key);
          return (
            <TabsContent key={g.key} value={g.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${g.color}`}>{g.label.toUpperCase()}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{g.days}</span>
                </div>
                <Button size="sm" onClick={() => navigate({ to: "/treino/ativo", search: { type: g.key } })}>
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

              <Button variant="outline" className="w-full" onClick={() => addExercise(g.key)}>
                <Plus className="size-4 mr-1" /> Adicionar exercício
              </Button>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
