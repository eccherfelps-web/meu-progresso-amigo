import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, PageHeader } from "@/components/hlt/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useLocalStorage, KEYS, exportAll, importAll, resetAll } from "@/lib/hlt/storage";
import { DEFAULT_PROFILE } from "@/lib/hlt/defaults";
import type { Profile } from "@/lib/hlt/types";
import { dailyMacros, tdee } from "@/lib/hlt/calc";
import { toast } from "sonner";
import { Download, Upload, Trash2 } from "lucide-react";

export const Route = createFileRoute("/perfil")({
  head: () => ({ meta: [{ title: "Perfil & Configurações" }] }),
  component: PerfilPage,
});

function PerfilPage() {
  const [profile, setProfile] = useLocalStorage<Profile>(KEYS.profile, DEFAULT_PROFILE);
  const [form, setForm] = useState<Profile>(profile);

  const save = () => {
    setProfile(form);
    toast.success("Metas atualizadas!");
  };

  const macros = dailyMacros(form);

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <PageHeader title="Perfil & Configurações" />

      <Card className="mb-4 space-y-3">
        <h3 className="font-semibold">Dados pessoais</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Idade"><Input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: +e.target.value })} /></Field>
          <Field label="Altura (cm)"><Input type="number" value={form.height_cm} onChange={(e) => setForm({ ...form, height_cm: +e.target.value })} /></Field>
          <Field label="Peso atual (kg)"><Input type="number" step="0.1" value={form.weight_current_kg} onChange={(e) => setForm({ ...form, weight_current_kg: +e.target.value })} /></Field>
          <Field label="Peso meta (kg)"><Input type="number" step="0.1" value={form.weight_goal_kg} onChange={(e) => setForm({ ...form, weight_goal_kg: +e.target.value })} /></Field>
          <Field label="Limite gordura/dia (g)"><Input type="number" value={form.fat_daily_limit_g} onChange={(e) => setForm({ ...form, fat_daily_limit_g: +e.target.value })} /></Field>
          <Field label="Objetivo">
            <Select value={form.goal_type} onValueChange={(v: Profile["goal_type"]) => setForm({ ...form, goal_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="clean_bulk">Clean Bulk</SelectItem>
                <SelectItem value="cut">Cut</SelectItem>
                <SelectItem value="maintain">Manutenção</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Nível de atividade">
            <Select value={form.activity_level} onValueChange={(v: Profile["activity_level"]) => setForm({ ...form, activity_level: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sedentary">Sedentário</SelectItem>
                <SelectItem value="light">Leve</SelectItem>
                <SelectItem value="moderate">Moderado</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="very_active">Muito ativo (5x+ por semana)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-xs">
          <strong>Pré-visualização:</strong> TDEE {tdee(form)} kcal · Meta {macros.kcal} kcal · P {macros.protein_g}g · C {macros.carbs_g}g · G {macros.fat_g}g
        </div>
        <Button onClick={save} className="w-full">Salvar e recalcular</Button>
      </Card>

      <Card className="mb-4 flex items-center justify-between">
        <div>
          <div className="font-semibold">Tema escuro</div>
          <div className="text-xs text-muted-foreground">Alternar entre claro e escuro</div>
        </div>
        <Switch checked={form.theme !== "light"} onCheckedChange={(c) => { const t = c ? "dark" : "light"; setForm({ ...form, theme: t }); setProfile({ ...form, theme: t }); }} />
      </Card>

      <Card className="mb-4 space-y-2">
        <h3 className="font-semibold">Backup & dados</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            const blob = new Blob([exportAll()], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `hlt-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
            URL.revokeObjectURL(url);
          }}><Download className="size-4 mr-1" /> Exportar JSON</Button>
          <label className="inline-flex">
            <input type="file" accept="application/json" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0]; if (!f) return;
              f.text().then((t) => { try { importAll(t); toast.success("Dados importados — recarregue"); setTimeout(() => location.reload(), 600); } catch { toast.error("Arquivo inválido"); } });
            }} />
            <Button variant="outline" size="sm" asChild><span><Upload className="size-4 mr-1" /> Importar JSON</span></Button>
          </label>
          <Button variant="outline" size="sm" className="text-danger" onClick={() => {
            if (!confirm("Tem certeza? Isso apaga TODOS os dados.")) return;
            if (!confirm("Confirme novamente: apagar tudo?")) return;
            resetAll(); toast.success("Tudo apagado"); setTimeout(() => location.reload(), 600);
          }}><Trash2 className="size-4 mr-1" /> Resetar tudo</Button>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold mb-2">Sobre</h3>
        <div className="text-xs text-muted-foreground space-y-1">
          <div>Healthy Life Tracker · v1.0</div>
          <div>100% offline · todos os dados ficam no seu navegador.</div>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="label-up block mb-1">{label}</label>{children}</div>;
}
