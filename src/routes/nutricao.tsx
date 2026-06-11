import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, PageHeader } from "@/components/hlt/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLocalStorage, KEYS } from "@/lib/hlt/storage";
import { DEFAULT_PROFILE, FOOD_DB } from "@/lib/hlt/defaults";
import type { FoodItem, FoodLog, HydrationLog, MealKey, Profile } from "@/lib/hlt/types";
import { dailyMacros, todayISO } from "@/lib/hlt/calc";
import { Plus, Trash2, Droplet, Search, Globe, Loader2 } from "lucide-react";
import { searchOpenFoodFacts } from "@/lib/hlt/foodApi";
import type { FoodDb } from "@/lib/hlt/types";
import { toast } from "sonner";

export const Route = createFileRoute("/nutricao")({
  head: () => ({ meta: [{ title: "Nutrição" }] }),
  component: NutricaoPage,
});

const MEALS: { key: MealKey; label: string; icon: string }[] = [
  { key: "breakfast", label: "Café da manhã", icon: "☀️" },
  { key: "lunch", label: "Almoço", icon: "🌤️" },
  { key: "preworkout", label: "Pré-treino", icon: "⚡" },
  { key: "dinner", label: "Jantar", icon: "🌙" },
  { key: "snacks", label: "Lanches", icon: "🍎" },
];

function emptyLog(date: string): FoodLog {
  return { date, meals: { breakfast: [], lunch: [], preworkout: [], dinner: [], snacks: [] } };
}

function NutricaoPage() {
  const [profile] = useLocalStorage<Profile>(KEYS.profile, DEFAULT_PROFILE);
  const [foods, setFoods] = useLocalStorage<FoodLog[]>(KEYS.foods, []);
  const [hydration, setHydration] = useLocalStorage<HydrationLog[]>(KEYS.hydration, []);
  const today = todayISO();
  const macros = dailyMacros(profile);
  const todayLog = foods.find((f) => f.date === today) ?? emptyLog(today);

  const totals = useMemo(() => {
    const t = { kcal: 0, p: 0, c: 0, f: 0 };
    for (const m of MEALS) for (const i of todayLog.meals[m.key]) {
      t.kcal += i.kcal; t.p += i.protein_g; t.c += i.carbs_g; t.f += i.fat_g;
    }
    return t;
  }, [todayLog]);

  const addItem = (meal: MealKey, item: FoodItem) => {
    setFoods((prev) => {
      const idx = prev.findIndex((f) => f.date === today);
      if (idx === -1) return [...prev, { ...emptyLog(today), meals: { ...emptyLog(today).meals, [meal]: [item] } }];
      const updated = [...prev];
      updated[idx] = { ...updated[idx], meals: { ...updated[idx].meals, [meal]: [...updated[idx].meals[meal], item] } };
      return updated;
    });
    toast.success("Alimento adicionado");
  };
  const removeItem = (meal: MealKey, i: number) => {
    setFoods((prev) => prev.map((f) => f.date === today ? { ...f, meals: { ...f.meals, [meal]: f.meals[meal].filter((_, j) => j !== i) } } : f));
  };

  const cups = hydration.find((h) => h.date === today)?.cups ?? 0;
  const waterGoalMl = Math.round(35 * profile.weight_current_kg);
  const adjustCups = (delta: number) => {
    setHydration((prev) => {
      const idx = prev.findIndex((h) => h.date === today);
      if (idx === -1) return [...prev, { date: today, cups: Math.max(0, delta) }];
      const u = [...prev]; u[idx] = { ...u[idx], cups: Math.max(0, u[idx].cups + delta) }; return u;
    });
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader title="Nutrição" subtitle="Diário do dia • metas automáticas" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MacroCard label="Calorias" value={totals.kcal} goal={macros.kcal} unit="kcal" />
        <MacroCard label="Proteína" value={totals.p} goal={macros.protein_g} unit="g" />
        <MacroCard label="Carbos" value={totals.c} goal={macros.carbs_g} unit="g" />
        <MacroCard label="Gordura" value={totals.f} goal={macros.fat_g} unit="g" hardLimit />
      </div>

      <Card className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Droplet className="size-5 text-info" />
            <div>
              <div className="font-semibold">Hidratação</div>
              <div className="text-xs text-muted-foreground">{cups} copos · {(cups * 250 / 1000).toFixed(2)}L / {(waterGoalMl / 1000).toFixed(2)}L</div>
            </div>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => adjustCups(-1)}>−</Button>
            <Button size="sm" onClick={() => adjustCups(1)}><Plus className="size-4" /></Button>
          </div>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-info" style={{ width: `${Math.min(100, (cups * 250 * 100) / waterGoalMl)}%` }} />
        </div>
      </Card>

      <div className="space-y-4">
        {MEALS.map((m) => {
          const items = todayLog.meals[m.key];
          const sub = items.reduce((a, i) => ({ kcal: a.kcal + i.kcal, p: a.p + i.protein_g }), { kcal: 0, p: 0 });
          return (
            <Card key={m.key}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">{m.icon} {m.label}</div>
                <div className="text-xs text-muted-foreground">{Math.round(sub.kcal)} kcal · {Math.round(sub.p)}g prot.</div>
              </div>
              <div className="space-y-1 mb-2">
                {items.map((i, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm py-1 border-b border-border last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{i.name} <span className="text-muted-foreground text-xs">({i.grams}g)</span></div>
                      <div className="text-xs text-muted-foreground">{Math.round(i.kcal)} kcal · P {i.protein_g.toFixed(1)} · C {i.carbs_g.toFixed(1)} · G {i.fat_g.toFixed(1)}</div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeItem(m.key, idx)}><Trash2 className="size-4 text-danger" /></Button>
                  </div>
                ))}
                {items.length === 0 && <div className="text-xs text-muted-foreground italic py-2">Nenhum alimento ainda.</div>}
              </div>
              <AddFoodDialog onAdd={(it) => addItem(m.key, it)} />
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function MacroCard({ label, value, goal, unit, hardLimit }: { label: string; value: number; goal: number; unit: string; hardLimit?: boolean }) {
  const pct = (value / goal) * 100;
  const color = hardLimit
    ? value >= 50 ? "bg-danger" : value >= 40 ? "bg-warning" : "bg-success"
    : pct > 100 ? "bg-danger" : pct > 85 ? "bg-warning" : "bg-success";
  return (
    <Card>
      <div className="label-up">{label}</div>
      <div className="text-2xl font-bold mt-1">{Math.round(value)}<span className="text-xs font-normal text-muted-foreground"> / {goal}{unit}</span></div>
      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </Card>
  );
}

function AddFoodDialog({ onAdd }: { onAdd: (i: FoodItem) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [grams, setGrams] = useState("100");
  const [custom, setCustom] = useState({ name: "", kcal: "", protein_g: "", carbs_g: "", fat_g: "" });
  const [online, setOnline] = useState<FoodDb[]>([]);
  const [searching, setSearching] = useState(false);
  const [onlineMsg, setOnlineMsg] = useState<string | null>(null);

  const filtered = FOOD_DB.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));

  const searchOnline = async () => {
    if (!search.trim() || searching) return;
    setSearching(true); setOnlineMsg(null); setOnline([]);
    try {
      const results = await searchOpenFoodFacts(search.trim());
      setOnline(results);
      if (!results.length) setOnlineMsg("Nada encontrado online para essa busca.");
    } catch {
      setOnlineMsg("Busca online indisponível — verifique a conexão.");
    } finally {
      setSearching(false);
    }
  };

  const pickDb = (f: typeof FOOD_DB[0]) => {
    const g = parseFloat(grams) || 100;
    const factor = g / 100;
    onAdd({ name: f.name, grams: g, kcal: f.kcal * factor, protein_g: f.protein_g * factor, carbs_g: f.carbs_g * factor, fat_g: f.fat_g * factor });
    setOpen(false); setSearch("");
  };

  const addCustom = () => {
    const g = parseFloat(grams) || 100;
    if (!custom.name) return;
    onAdd({
      name: custom.name, grams: g,
      kcal: parseFloat(custom.kcal) || 0, protein_g: parseFloat(custom.protein_g) || 0,
      carbs_g: parseFloat(custom.carbs_g) || 0, fat_g: parseFloat(custom.fat_g) || 0,
    });
    setOpen(false); setCustom({ name: "", kcal: "", protein_g: "", carbs_g: "", fat_g: "" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full"><Plus className="size-4 mr-1" /> Adicionar alimento</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Adicionar alimento</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_100px] gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
              <Input placeholder="Buscar alimento" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
            </div>
            <Input type="number" placeholder="gramas" value={grams} onChange={(e) => setGrams(e.target.value)} />
          </div>
          <div className="max-h-60 overflow-y-auto border border-border rounded-md">
            {filtered.map((f) => (
              <button key={f.name} onClick={() => pickDb(f)} className="block w-full text-left px-3 py-2 hover:bg-accent border-b border-border last:border-0">
                <div className="text-sm font-medium">{f.name}</div>
                <div className="text-xs text-muted-foreground">{f.kcal} kcal/100g · P {f.protein_g} · C {f.carbs_g} · G {f.fat_g}</div>
              </button>
            ))}
            {filtered.length === 0 && <div className="p-3 text-sm text-muted-foreground text-center">Nenhum resultado local</div>}
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={searchOnline} disabled={searching || !search.trim()}>
            {searching ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Globe className="size-4 mr-1" />}
            Buscar online (Open Food Facts)
          </Button>
          {onlineMsg && <div className="text-xs text-muted-foreground text-center">{onlineMsg}</div>}
          {online.length > 0 && (
            <div className="max-h-48 overflow-y-auto border border-info/40 rounded-md">
              {online.map((f, i) => (
                <button key={i} onClick={() => pickDb(f)} className="block w-full text-left px-3 py-2 hover:bg-accent border-b border-border last:border-0">
                  <div className="text-sm font-medium flex items-center gap-1.5"><Globe className="size-3 text-info shrink-0" /><span className="truncate">{f.name}</span></div>
                  <div className="text-xs text-muted-foreground">{f.kcal} kcal/100g · P {f.protein_g} · C {f.carbs_g} · G {f.fat_g}</div>
                </button>
              ))}
            </div>
          )}
          <div className="pt-3 border-t border-border">
            <div className="label-up mb-2">Ou cadastre manualmente (por porção)</div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Nome" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} className="col-span-2" />
              <Input type="number" placeholder="kcal" value={custom.kcal} onChange={(e) => setCustom({ ...custom, kcal: e.target.value })} />
              <Input type="number" placeholder="proteína g" value={custom.protein_g} onChange={(e) => setCustom({ ...custom, protein_g: e.target.value })} />
              <Input type="number" placeholder="carbs g" value={custom.carbs_g} onChange={(e) => setCustom({ ...custom, carbs_g: e.target.value })} />
              <Input type="number" placeholder="gordura g" value={custom.fat_g} onChange={(e) => setCustom({ ...custom, fat_g: e.target.value })} />
            </div>
            <Button onClick={addCustom} className="w-full mt-2" size="sm">Adicionar customizado</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
