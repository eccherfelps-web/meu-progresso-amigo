import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, PageHeader } from "@/components/hlt/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocalStorage, KEYS } from "@/lib/hlt/storage";
import { DEFAULT_PROFILE } from "@/lib/hlt/defaults";
import type { BodyMeasure, Profile, WeightLog } from "@/lib/hlt/types";
import { todayISO } from "@/lib/hlt/calc";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/peso")({
  head: () => ({ meta: [{ title: "Peso Corporal" }] }),
  component: PesoPage,
});

const PERIODS = [7, 30, 60, 90] as const;

function PesoPage() {
  const [profile] = useLocalStorage<Profile>(KEYS.profile, DEFAULT_PROFILE);
  const [weights, setWeights] = useLocalStorage<WeightLog[]>(KEYS.weights, []);
  const [measures, setMeasures] = useLocalStorage<BodyMeasure[]>(KEYS.measures, []);
  const [input, setInput] = useState("");
  const [period, setPeriod] = useState<number>(30);

  const save = () => {
    const v = parseFloat(input);
    if (!v || v < 30 || v > 300) { toast.error("Peso inválido"); return; }
    const today = todayISO();
    setWeights((prev) => {
      const idx = prev.findIndex((w) => w.date === today);
      if (idx >= 0) { const u = [...prev]; u[idx] = { date: today, weight_kg: v }; return u; }
      return [...prev, { date: today, weight_kg: v }].sort((a, b) => a.date.localeCompare(b.date));
    });
    setInput("");
    toast.success("Peso registrado");
  };

  const sorted = useMemo(() => [...weights].sort((a, b) => a.date.localeCompare(b.date)), [weights]);
  const filtered = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - period);
    return sorted.filter((w) => new Date(w.date) >= cutoff);
  }, [sorted, period]);

  const current = sorted[sorted.length - 1]?.weight_kg ?? profile.weight_current_kg;
  const min = sorted.length ? Math.min(...sorted.map((w) => w.weight_kg)) : current;
  const max = sorted.length ? Math.max(...sorted.map((w) => w.weight_kg)) : current;
  const last14 = sorted.slice(-14);
  const avg14 = last14.length ? last14.reduce((a, w) => a + w.weight_kg, 0) / last14.length : current;
  const last7 = sorted.slice(-7);
  const weekDelta = last7.length >= 2 ? last7[last7.length - 1].weight_kg - last7[0].weight_kg : 0;
  const trend = weekDelta > 0.1 ? "Em bulk ✅" : weekDelta < -0.1 ? "Perdendo peso ⚠️" : "Estável →";

  const goalPct = Math.min(100, Math.max(0, ((current - 58) / (profile.weight_goal_kg - 58)) * 100));
  const chartData = filtered.map((w) => ({ date: w.date.slice(5), peso: w.weight_kg, media: avg14 }));

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader title="Peso Corporal" subtitle={`Meta: ${profile.weight_goal_kg}kg · ${trend}`} />

      <Card className="mb-4">
        <div className="flex gap-2">
          <Input type="number" step="0.1" placeholder="Peso de hoje (kg)" value={input} onChange={(e) => setInput(e.target.value)} inputMode="decimal" />
          <Button onClick={save}>Salvar</Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Stat label="Atual" value={`${current.toFixed(1)}kg`} />
        <Stat label="Mínimo" value={`${min.toFixed(1)}kg`} />
        <Stat label="Máximo" value={`${max.toFixed(1)}kg`} />
        <Stat label="Média 14d" value={`${avg14.toFixed(1)}kg`} />
        <Stat label="Semana" value={`${weekDelta >= 0 ? "+" : ""}${weekDelta.toFixed(1)}kg`} />
      </div>

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Histórico</h3>
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <Button key={p} size="sm" variant={period === p ? "default" : "outline"} onClick={() => setPeriod(p)}>{p}d</Button>
            ))}
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis domain={["auto", "auto"]} stroke="var(--color-muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
              <ReferenceLine y={profile.weight_goal_kg} stroke="var(--color-success)" strokeDasharray="4 4" label={{ value: "Meta", fill: "var(--color-success)", fontSize: 10 }} />
              <Line type="monotone" dataKey="peso" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="media" stroke="var(--color-info)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="mb-4">
        <h3 className="font-semibold mb-2">Progresso do objetivo</h3>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>58kg</span><span>{goalPct.toFixed(0)}% concluído</span><span>{profile.weight_goal_kg}kg</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden relative">
          <div className="h-full bg-primary transition-all" style={{ width: `${goalPct}%` }} />
        </div>
      </Card>

      <MeasuresSection measures={measures} setMeasures={setMeasures} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div className="label-up">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </Card>
  );
}

function MeasuresSection({ measures, setMeasures }: { measures: BodyMeasure[]; setMeasures: (v: BodyMeasure[] | ((p: BodyMeasure[]) => BodyMeasure[])) => void }) {
  const [m, setM] = useState({ chest_cm: "", waist_cm: "", arms_cm: "", thighs_cm: "" });
  const save = () => {
    const entry: BodyMeasure = {
      date: todayISO(),
      chest_cm: parseFloat(m.chest_cm) || undefined,
      waist_cm: parseFloat(m.waist_cm) || undefined,
      arms_cm: parseFloat(m.arms_cm) || undefined,
      thighs_cm: parseFloat(m.thighs_cm) || undefined,
    };
    setMeasures((prev) => [...prev, entry].sort((a, b) => a.date.localeCompare(b.date)));
    setM({ chest_cm: "", waist_cm: "", arms_cm: "", thighs_cm: "" });
    toast.success("Medidas salvas");
  };
  return (
    <Card>
      <h3 className="font-semibold mb-3">Medidas corporais (opcional)</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
        <Input placeholder="Peito (cm)" value={m.chest_cm} onChange={(e) => setM({ ...m, chest_cm: e.target.value })} />
        <Input placeholder="Cintura (cm)" value={m.waist_cm} onChange={(e) => setM({ ...m, waist_cm: e.target.value })} />
        <Input placeholder="Braços (cm)" value={m.arms_cm} onChange={(e) => setM({ ...m, arms_cm: e.target.value })} />
        <Input placeholder="Coxas (cm)" value={m.thighs_cm} onChange={(e) => setM({ ...m, thighs_cm: e.target.value })} />
      </div>
      <Button size="sm" onClick={save}>Salvar medidas</Button>
      {measures.length > 0 && (
        <div className="mt-4 space-y-1 text-sm">
          {measures.slice().reverse().slice(0, 5).map((x, i) => (
            <div key={i} className="flex gap-3 text-xs border-b border-border py-1.5 last:border-0">
              <span className="text-muted-foreground">{x.date}</span>
              {x.chest_cm && <span>Peito {x.chest_cm}</span>}
              {x.waist_cm && <span>Cint. {x.waist_cm}</span>}
              {x.arms_cm && <span>Braço {x.arms_cm}</span>}
              {x.thighs_cm && <span>Coxa {x.thighs_cm}</span>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
