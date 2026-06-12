// Formulário completo de criação/edição de exercícios, com validação,
// busca inteligente no catálogo, sugestões automáticas e exercícios recentes.
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Exercise, MuscleGroup } from "@/lib/hlt/types";
import type { TrainingDay } from "@/lib/hlt/defaults";
import { MUSCLES } from "@/lib/hlt/muscles";
import { searchCatalog, MUSCLE_ICON, type CatalogEntry } from "@/lib/hlt/exerciseCatalog";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Exercise | null; // null/undefined = criar novo
  defaultGroup: MuscleGroup;
  defaultSlot?: number | null;
  days: TrainingDay[]; // cronograma atual (p/ opções de dia)
  recents: string[]; // nomes usados recentemente
  onSave: (ex: Exercise) => void;
}

const GROUP_LABELS: { value: MuscleGroup; label: string }[] = [
  { value: "push", label: "Push — Peito/Ombro/Tríceps" },
  { value: "pull", label: "Pull — Costas/Bíceps" },
  { value: "legs", label: "Legs — Pernas/Core" },
];
const EQUIPMENT = [
  "Barra",
  "Halteres",
  "Máquina",
  "Cabo",
  "Peso corporal",
  "Kettlebell",
  "Elástico",
  "Outro",
];

export function ExerciseForm({
  open,
  onOpenChange,
  initial,
  defaultGroup,
  defaultSlot,
  days,
  recents,
  onSave,
}: Props) {
  const editing = !!initial;
  const [name, setName] = useState("");
  const [group, setGroup] = useState<MuscleGroup>(defaultGroup);
  const [muscle, setMuscle] = useState<string>("");
  const [muscle2, setMuscle2] = useState<string>("none");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10-12");
  const [load, setLoad] = useState("");
  const [unit, setUnit] = useState<"kg" | "lb">("kg");
  const [rest, setRest] = useState("90");
  const [kind, setKind] = useState<"composto" | "isolado">("composto");
  const [equipment, setEquipment] = useState("Halteres");
  const [slot, setSlot] = useState<string>("all");
  const [notes, setNotes] = useState("");
  const [showSug, setShowSug] = useState(false);

  // (re)preenche ao abrir
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setGroup(initial.group);
      setMuscle(initial.muscle ?? "");
      setMuscle2(initial.muscle2 ?? "none");
      setSets(String(initial.sets));
      setReps(initial.reps);
      setLoad(initial.load_kg != null ? String(initial.load_kg) : "");
      setUnit("kg");
      setRest(String(initial.rest_s ?? 90));
      setKind(initial.kind ?? "composto");
      setEquipment(initial.equipment ?? "Halteres");
      setSlot(initial.slot != null ? String(initial.slot) : "all");
      setNotes(initial.notes ?? "");
    } else {
      setName("");
      setGroup(defaultGroup);
      setMuscle("");
      setMuscle2("none");
      setSets("3");
      setReps("10-12");
      setLoad("");
      setUnit("kg");
      setRest("90");
      setKind("composto");
      setEquipment("Halteres");
      setSlot(defaultSlot != null ? String(defaultSlot) : "all");
      setNotes("");
    }
    setShowSug(false);
  }, [open, initial, defaultGroup, defaultSlot]);

  const suggestions = useMemo(
    () => (showSug && !editing ? searchCatalog(name) : []),
    [name, showSug, editing],
  );

  // opções de dia SEMPRE do grupo selecionado no formulário (reativo)
  const slotOptions = useMemo(() => {
    const groupDays = days.filter((d) => d.group === group);
    const opts: { value: number | null; label: string }[] = [
      {
        value: null,
        label:
          groupDays.length > 1
            ? `Todos (${groupDays.map((d) => d.short).join(" e ")})`
            : "Todos os dias do grupo",
      },
    ];
    groupDays.forEach((d) => opts.push({ value: d.occurrence, label: `Apenas ${d.label}` }));
    return opts;
  }, [days, group]);

  // se trocar de grupo e o slot escolhido não existir nele, volta para "Todos"
  useEffect(() => {
    if (slot !== "all" && !slotOptions.some((o) => o.value != null && String(o.value) === slot))
      setSlot("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group]);

  const applySuggestion = (c: CatalogEntry) => {
    setName(c.name);
    setGroup(c.group);
    setMuscle(c.muscle);
    setEquipment(c.equipment);
    setKind(c.kind);
    setShowSug(false);
  };

  const save = () => {
    // ── validações ──
    if (name.trim().length < 2) return toast.error("Informe o nome do exercício.");
    if (!group) return toast.error("Selecione o grupo do treino (Push/Pull/Legs).");
    if (!muscle) return toast.error("Selecione o músculo principal.");
    const nSets = parseInt(sets);
    if (!nSets || nSets < 1 || nSets > 12)
      return toast.error("Séries deve ser um número entre 1 e 12.");
    if (!reps.trim() || !/\d/.test(reps))
      return toast.error("Informe as repetições (ex.: 10 ou 8-12).");
    const rawLoad = load.trim() === "" ? null : parseFloat(load.replace(",", "."));
    if (rawLoad != null && (isNaN(rawLoad) || rawLoad < 0 || rawLoad > 1000))
      return toast.error("Carga inválida.");
    const nRest = parseInt(rest);
    if (!nRest || nRest < 10 || nRest > 600)
      return toast.error("Descanso deve estar entre 10 e 600 segundos.");

    const load_kg =
      rawLoad == null ? null : unit === "lb" ? +(rawLoad * 0.4536).toFixed(1) : rawLoad;
    onSave({
      id: initial?.id ?? `${group}-${Date.now()}`,
      name: name.trim(),
      group,
      muscle,
      muscle2: muscle2 === "none" ? undefined : muscle2,
      sets: nSets,
      reps: reps.trim(),
      load_kg,
      rest_s: nRest,
      kind,
      equipment,
      slot:
        slot === "all" || parseInt(slot) >= days.filter((d) => d.group === group).length
          ? undefined
          : parseInt(slot),
      notes: notes.trim() || undefined,
      fav: initial?.fav,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar exercício" : "Novo exercício"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {!editing && recents.length > 0 && (
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">Recentes</div>
              <div className="flex flex-wrap gap-1.5">
                {recents.slice(0, 5).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setName(r);
                      setShowSug(true);
                    }}
                    className="text-[11px] px-2 py-1 rounded-full border border-border hover:bg-accent"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="relative">
            <label className="text-[11px] text-muted-foreground">Nome *</label>
            <Input
              value={name}
              autoFocus
              placeholder="Ex.: Supino Inclinado com Halteres"
              onChange={(e) => {
                setName(e.target.value);
                setShowSug(true);
              }}
            />
            {suggestions.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 rounded-md border border-border bg-popover shadow-lg overflow-hidden">
                {suggestions.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => applySuggestion(c)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span>{MUSCLE_ICON[c.muscle] ?? "🏋️"}</span>
                    <span className="flex-1">{c.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {c.muscle} · {c.equipment}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-muted-foreground">Grupo do treino *</label>
              <Select value={group} onValueChange={(v: MuscleGroup) => setGroup(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROUP_LABELS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Dia do grupo</label>
              <Select value={slot} onValueChange={setSlot}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {slotOptions.map((o) => (
                    <SelectItem
                      key={String(o.value)}
                      value={o.value == null ? "all" : String(o.value)}
                    >
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Músculo principal *</label>
              <Select value={muscle || undefined} onValueChange={setMuscle}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {MUSCLES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {MUSCLE_ICON[m]} {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Músculo secundário</label>
              <Select value={muscle2} onValueChange={setMuscle2}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {MUSCLES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {MUSCLE_ICON[m]} {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Séries *</label>
              <Input
                type="number"
                inputMode="numeric"
                value={sets}
                onChange={(e) => setSets(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Repetições *</label>
              <Input value={reps} placeholder="8-12" onChange={(e) => setReps(e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Carga inicial</label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  step="0.5"
                  inputMode="decimal"
                  value={load}
                  placeholder="—"
                  onChange={(e) => setLoad(e.target.value)}
                />
                <Select value={unit} onValueChange={(v: "kg" | "lb") => setUnit(v)}>
                  <SelectTrigger className="w-[64px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="lb">lb</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Descanso (s) *</label>
              <Input
                type="number"
                inputMode="numeric"
                value={rest}
                onChange={(e) => setRest(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Tipo</label>
              <Select value={kind} onValueChange={(v: "composto" | "isolado") => setKind(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="composto">Composto</SelectItem>
                  <SelectItem value="isolado">Isolado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Equipamento</label>
              <Select value={equipment} onValueChange={setEquipment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-muted-foreground">Observações</label>
            <Input
              value={notes}
              placeholder="Ex.: pegada neutra, banco a 30°"
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button onClick={save} className="w-full">
            {editing ? "Salvar alterações" : "Adicionar exercício"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
