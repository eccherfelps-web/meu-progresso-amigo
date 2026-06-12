// Banco de alimentos dinâmico — Open Food Facts.
// Usa dois endpoints em cadeia (o novo Search-a-licious e o legado cgi),
// porque o legado é lento e tem limite de ~10 buscas/min.
import type { FoodDb } from "./types";

const TIMEOUT = 9000;

async function fetchJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (res.status === 429) throw new Error("rate");
    if (!res.ok) throw new Error("http" + res.status);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

const num = (v: unknown) => (v == null || isNaN(Number(v)) ? null : +Number(v).toFixed(1));

function toFood(p: Record<string, unknown>): FoodDb | null {
  const n = (p.nutriments ?? {}) as Record<string, unknown>;
  const kcal = num(n["energy-kcal_100g"]) ?? (num(n["energy_100g"]) != null ? +(Number(n["energy_100g"]) / 4.184).toFixed(0) : null);
  const name = (p.product_name_pt || p.product_name) as string | undefined;
  if (!name || kcal == null) return null;
  const brand = typeof p.brands === "string" && p.brands ? ` (${(p.brands as string).split(",")[0].trim()})` : "";
  return {
    name: `${name}${brand}`,
    kcal,
    protein_g: num(n["proteins_100g"]) ?? 0,
    carbs_g: num(n["carbohydrates_100g"]) ?? 0,
    fat_g: num(n["fat_100g"]) ?? 0,
  };
}

export async function searchOpenFoodFacts(query: string): Promise<FoodDb[]> {
  const q = encodeURIComponent(query.trim());
  const fields = "product_name,product_name_pt,brands,nutriments";
  const endpoints = [
    // 1) Search-a-licious (novo, rápido, CORS liberado)
    `https://search.openfoodfacts.org/search?q=${q}&page_size=12&fields=${fields}`,
    // 2) Legado (mais lento, limite ~10/min)
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=12&fields=${fields}`,
  ];

  let lastErr: Error | null = null;
  for (const url of endpoints) {
    try {
      const data = (await fetchJson(url)) as { hits?: unknown[]; products?: unknown[] };
      const items = (data.hits ?? data.products ?? []) as Record<string, unknown>[];
      const foods = items.map(toFood).filter((f): f is FoodDb => f !== null);
      if (foods.length) return foods;
      // endpoint respondeu mas sem resultados úteis: tenta o próximo
      lastErr = new Error("vazio");
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (lastErr.message === "rate") {
        throw new Error("Limite de buscas da Open Food Facts atingido — aguarde ~1 minuto e tente de novo.");
      }
    }
  }
  if (lastErr?.message === "vazio") return [];
  throw new Error(
    lastErr?.name === "AbortError"
      ? "A Open Food Facts demorou demais para responder — tente novamente."
      : "Não foi possível conectar à Open Food Facts — verifique a internet.",
  );
}
