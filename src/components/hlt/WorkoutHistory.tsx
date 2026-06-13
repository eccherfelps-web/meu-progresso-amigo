// Histórico de treinos: último treino de cada dia da semana + modal de
// detalhes. Tudo derivado das sessões salvas — nenhum dado duplicado.
import { useMemo, useState } from "react";
import { Card } from "@/components/hlt/Shell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { WorkoutSession } from "@/lib/hlt/types";
import { DOW_LABEL, DOW_SHORT } from "@/lib/hlt/defaults";
import { epley } from "@/lib/hlt/onerm";
import { Clock, Dumbbell, Trophy, ChevronRight } from "lucide-react";

const GROUP_BADGE: Record<string, string> = {
  push: "bg-info/15 text-info",
  pull: "bg-success/15 text-success",
  legs: "bg-warning/15 text-warning",
};

const fmt = (n: number) => n.toLocaleString("pt-BR");
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function sessionVolume(s: WorkoutSession) {
  return s.exercises.reduce(
    (a, e) => a + e.sets.reduce((b, st) => b + st.weight_kg * st.reps, 0),
    0,
  );
}
function sessionSets(s: WorkoutSession) {
  return s.exercises.reduce((a, e) => a + e.sets.length, 0);
}

export function HistorySection({ sessions }: { sessions: WorkoutSession[] }) {
  const [open, setOpen] = useState<WorkoutSession | null>(null);

  // último treino registrado em cada dia da semana (Seg → Dom)
  const byWeekday = useMemo(() => {
    const map = new Map<number, WorkoutSession>();
    for (const s of sessions) {
      const dow = new Date(s.date).getDay();
      const cur = map.get(dow);
      if (!cur || s.date > cur.date) map.set(dow, s);
    }
    const order = [1, 2, 3, 4, 5, 6, 0];
    return order.filter((d) => map.has(d)).map((d) => ({ dow: d, s: map.get(d)! }));
  }, [sessions]);

  if (!sessions.length) return null;

  return (
    <Card className="mt-6">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold">Histórico — último treino de cada dia</h3>
        <span className="text-xs text-muted-foreground">{sessions.length} sessões no total</span>
      </div>
      <div className="space-y-1.5">
        {byWeekday.map(({ dow, s }) => (
          <button
            key={dow}
            onClick={() => setOpen(s)}
            className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-left text-sm hover:bg-accent transition"
          >
            <span className="w-9 font-semibold">{DOW_SHORT[dow]}</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${GROUP_BADGE[s.type] ?? "bg-muted text-muted-foreground"}`}
            >
              {s.type}
            </span>
            <span className="text-muted-foreground text-xs">{fmtDate(s.date)}</span>
            <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {s.duration_min} min
              </span>
              <span className="hidden sm:flex items-center gap-1">
                <Dumbbell className="size-3" />
                {fmt(Math.round(sessionVolume(s)))} kg
              </span>
              {(s.prs?.length ?? 0) > 0 && <Trophy className="size-3.5 text-warning" />}
              <ChevronRight className="size-4" />
            </span>
          </button>
        ))}
      </div>

      <SessionDetail session={open} onClose={() => setOpen(null)} />
    </Card>
  );
}

function SessionDetail({
  session,
  onClose,
}: {
  session: WorkoutSession | null;
  onClose: () => void;
}) {
  if (!session) return null;
  const dow = new Date(session.date).getDay();
  const volume = Math.round(sessionVolume(session));
  const totalSets = sessionSets(session);
  const best1rm = Math.max(
    0,
    ...session.exercises.flatMap((e) => e.sets.map((st) => epley(st.weight_kg, st.reps))),
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            Treino de {DOW_LABEL[dow]}
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${GROUP_BADGE[session.type] ?? "bg-muted"}`}
            >
              {session.type}
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              {new Date(session.date).toLocaleDateString("pt-BR")}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* estatísticas da sessão */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Duração" value={`${session.duration_min} min`} />
          <Stat label="Volume total" value={`${fmt(volume)} kg`} />
          <Stat label="Séries" value={String(totalSets)} />
          <Stat label="Melhor 1RM (Epley)" value={best1rm ? `${best1rm} kg` : "—"} />
        </div>

        {(session.prs?.length ?? 0) > 0 && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold mb-1">
              <Trophy className="size-4 text-warning" /> Recordes desta sessão
            </div>
            <ul className="text-xs space-y-0.5">
              {session.prs!.map((p, i) => (
                <li key={i}>
                  {p.exercise} — {p.type === "weight" ? `${p.value} kg` : `${p.value} reps`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* exercícios e séries */}
        <div className="space-y-3">
          {session.exercises.map((e) => {
            const vol = Math.round(e.sets.reduce((a, st) => a + st.weight_kg * st.reps, 0));
            return (
              <div key={e.exercise_id} className="rounded-lg border border-border p-3">
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <div className="font-medium text-sm">{e.name}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {e.sets.length} séries · {fmt(vol)} kg
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {e.sets.map((st, i) => (
                    <div
                      key={i}
                      className="rounded bg-muted/50 px-2 py-1 text-xs tabular-nums text-center"
                    >
                      <span className="text-muted-foreground">#{i + 1}</span> {st.weight_kg}kg ×{" "}
                      {st.reps}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-2.5 text-center">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="font-semibold tabular-nums text-sm mt-0.5">{value}</div>
    </div>
  );
}
