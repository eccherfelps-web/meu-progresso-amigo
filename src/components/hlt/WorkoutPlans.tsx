// Planos de treino pré-definidos por grupo (ex.: "Push A", "Push B").
// O usuário cria planos nomeados com seus exercícios; depois, ao montar a
// semana, escolhe qual plano usar em cada dia. Resolve o conflito de variações
// que se repetiam (antes derivadas de "slot"; agora são explícitas).
import { useState } from "react";
import { Card } from "@/components/hlt/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocalStorage, KEYS } from "@/lib/hlt/storage";
import type { WorkoutPlan, PlanExercise, Exercise } from "@/lib/hlt/types";
import { GROUP_LABEL } from "@/lib/hlt/defaults";
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  Dumbbell,
  ChevronUp,
  ChevronDown,
  Download,
} from "lucide-react";
import { toast } from "sonner";

const GROUPS: { id: "push" | "pull" | "legs"; label: string; tone: string }[] = [
  { id: "push", label: "Push", tone: "bg-info/15 text-info border-info/30" },
  { id: "pull", label: "Pull", tone: "bg-success/15 text-success border-success/30" },
  { id: "legs", label: "Legs", tone: "bg-warning/15 text-warning border-warning/30" },
];

export function WorkoutPlansSection() {
  const [plans, setPlans] = useLocalStorage<WorkoutPlan[]>(KEYS.plans, []);
  const [allExercises] = useLocalStorage<Exercise[]>(KEYS.exercises, []);
  const [activeGroup, setActiveGroup] = useState<"push" | "pull" | "legs">("push");
  const [editing, setEditing] = useState<WorkoutPlan | null>(null);
  const [open, setOpen] = useState(false);

  const groupPlans = plans.filter((p) => p.group === activeGroup);

  const startNew = () => {
    setEditing({
      id: `plan-${Date.now()}`,
      group: activeGroup,
      name: "",
      exercises: [],
      created_at: new Date().toISOString(),
    });
    setOpen(true);
  };
  const startEdit = (plan: WorkoutPlan) => {
    setEditing({ ...plan, exercises: plan.exercises.map((e) => ({ ...e })) });
    setOpen(true);
  };
  const duplicate = (plan: WorkoutPlan) => {
    const copy: WorkoutPlan = {
      ...plan,
      id: `plan-${Date.now()}`,
      name: `${plan.name} (cópia)`,
      exercises: plan.exercises.map((e) => ({ ...e, id: `pe-${Date.now()}-${Math.random()}` })),
      created_at: new Date().toISOString(),
    };
    setPlans((prev) => [...prev, copy]);
    toast.success("Plano duplicado.");
  };
  const remove = (id: string, name: string) => {
    if (!confirm(`Excluir o plano "${name}"? Esta ação não pode ser desfeita.`)) return;
    setPlans((prev) => prev.filter((p) => p.id !== id));
    toast.success("Plano removido.");
  };
  const save = (plan: WorkoutPlan) => {
    if (!plan.name.trim()) {
      toast.error("Dê um nome ao plano.");
      return;
    }
    if (plan.exercises.length === 0) {
      toast.error("Adicione ao menos um exercício.");
      return;
    }
    setPlans((prev) => {
      const exists = prev.some((p) => p.id === plan.id);
      return exists ? prev.map((p) => (p.id === plan.id ? plan : p)) : [...prev, plan];
    });
    setOpen(false);
    setEditing(null);
    toast.success("Plano salvo!");
  };

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Dumbbell className="size-4 text-primary" /> Planos por grupo
        </h3>
        <Button size="sm" variant="outline" onClick={startNew}>
          <Plus className="size-4 mr-1" /> Novo plano de{" "}
          {GROUPS.find((g) => g.id === activeGroup)?.label}
        </Button>
      </div>

      {/* seletor de grupo — os "botõezinhos no topo" */}
      <div className="flex gap-1.5 mb-3">
        {GROUPS.map((g) => {
          const count = plans.filter((p) => p.group === g.id).length;
          return (
            <button
              key={g.id}
              onClick={() => setActiveGroup(g.id)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                activeGroup === g.id
                  ? g.tone
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {g.label}
              {count > 0 && <span className="ml-1 text-xs opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      {groupPlans.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6">
          Nenhum plano de {GROUP_LABEL[activeGroup]} ainda. Crie variações (ex.: "Push A" e "Push
          B") para escolher ao montar a semana.
        </div>
      ) : (
        <div className="space-y-2">
          {groupPlans.map((plan) => (
            <div key={plan.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm">{plan.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {plan.exercises.map((e) => e.name).join(", ")}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {plan.exercises.length} exercícios
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => duplicate(plan)}
                    aria-label="Duplicar"
                  >
                    <Copy className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => startEdit(plan)}
                    aria-label="Editar"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(plan.id, plan.name)}
                    aria-label="Excluir"
                  >
                    <Trash2 className="size-4 text-danger" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => !o && (setOpen(false), setEditing(null))}>
        {editing && (
          <PlanEditor
            plan={editing}
            importable={allExercises
              .filter((e) => e.group === editing.group)
              .map((e) => ({
                id: `pe-import-${e.id}`,
                name: e.name,
                sets: e.sets,
                reps: e.reps,
                load_kg: e.load_kg,
                rest_s: e.rest_s,
                muscle: e.muscle,
                equipment: e.equipment,
                kind: e.kind,
                bodyweight: e.bodyweight,
                notes: e.notes,
              }))}
            onSave={save}
          />
        )}
      </Dialog>
    </Card>
  );
}

function PlanEditor({
  plan,
  importable,
  onSave,
}: {
  plan: WorkoutPlan;
  importable: PlanExercise[];
  onSave: (p: WorkoutPlan) => void;
}) {
  const [name, setName] = useState(plan.name);
  const [exercises, setExercises] = useState<PlanExercise[]>(plan.exercises);
  const [exName, setExName] = useState("");
  const [exSets, setExSets] = useState("3");
  const [exReps, setExReps] = useState("8-12");

  // importa os exercícios já cadastrados deste grupo (pula os que já estão no plano)
  const importExisting = () => {
    const have = new Set(exercises.map((e) => e.name.trim().toLowerCase()));
    const toAdd = importable.filter((e) => !have.has(e.name.trim().toLowerCase()));
    if (toAdd.length === 0) {
      toast.info("Todos os exercícios deste grupo já estão no plano.");
      return;
    }
    setExercises((prev) => [
      ...prev,
      ...toAdd.map((e, i) => ({ ...e, id: `pe-${Date.now()}-${i}`, order: prev.length + i })),
    ]);
    toast.success(`${toAdd.length} exercício(s) importado(s).`);
  };

  const addExercise = () => {
    if (!exName.trim()) {
      toast.error("Nome do exercício?");
      return;
    }
    setExercises((prev) => [
      ...prev,
      {
        id: `pe-${Date.now()}`,
        name: exName.trim(),
        sets: parseInt(exSets) || 3,
        reps: exReps.trim() || "8-12",
        order: prev.length,
      },
    ]);
    setExName("");
    setExSets("3");
    setExReps("8-12");
  };
  const removeEx = (id: string) => setExercises((prev) => prev.filter((e) => e.id !== id));
  const move = (id: string, dir: -1 | 1) => {
    setExercises((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      const t = idx + dir;
      if (idx < 0 || t < 0 || t >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[t]] = [next[t], next[idx]];
      return next.map((e, i) => ({ ...e, order: i }));
    });
  };

  return (
    <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{plan.name ? "Editar plano" : "Novo plano"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <label className="text-[11px] text-muted-foreground">Nome do plano</label>
          <Input
            value={name}
            placeholder="Ex.: Push A (força) ou Push pesado"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="rounded-lg border border-border p-2.5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold">Exercícios ({exercises.length})</div>
            {importable.length > 0 && (
              <button
                onClick={importExisting}
                className="text-[11px] text-primary hover:underline flex items-center gap-1"
              >
                <Download className="size-3" /> Importar exercícios atuais deste grupo
              </button>
            )}
          </div>
          {exercises.length > 0 && (
            <div className="space-y-1 mb-2">
              {exercises.map((e, i) => (
                <div
                  key={e.id}
                  className="flex items-center gap-1.5 text-sm rounded bg-muted/40 px-2 py-1"
                >
                  <div className="flex flex-col">
                    <button
                      onClick={() => move(e.id, -1)}
                      disabled={i === 0}
                      aria-label="Subir"
                      className="disabled:opacity-25"
                    >
                      <ChevronUp className="size-3" />
                    </button>
                    <button
                      onClick={() => move(e.id, 1)}
                      disabled={i === exercises.length - 1}
                      aria-label="Descer"
                      className="disabled:opacity-25"
                    >
                      <ChevronDown className="size-3" />
                    </button>
                  </div>
                  <span className="flex-1 min-w-0 truncate">{e.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {e.sets}×{e.reps}
                  </span>
                  <button onClick={() => removeEx(e.id)} aria-label="Remover">
                    <Trash2 className="size-3.5 text-danger" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* adicionar exercício */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-1.5 items-end">
            <div>
              <label className="text-[10px] text-muted-foreground">Exercício</label>
              <Input
                value={exName}
                placeholder="Nome"
                onChange={(e) => setExName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addExercise()}
                className="h-9"
              />
            </div>
            <div className="w-14">
              <label className="text-[10px] text-muted-foreground">Séries</label>
              <Input
                value={exSets}
                onChange={(e) => setExSets(e.target.value)}
                className="h-9 text-center px-1"
                inputMode="numeric"
              />
            </div>
            <div className="w-16">
              <label className="text-[10px] text-muted-foreground">Reps</label>
              <Input
                value={exReps}
                onChange={(e) => setExReps(e.target.value)}
                className="h-9 text-center px-1"
              />
            </div>
            <Button size="sm" onClick={addExercise} className="h-9">
              <Plus className="size-4" />
            </Button>
          </div>
        </div>

        <Button onClick={() => onSave({ ...plan, name, exercises })} className="w-full">
          Salvar plano
        </Button>
      </div>
    </DialogContent>
  );
}
