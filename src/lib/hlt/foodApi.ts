// Banco de alimentos dinâmico com cache local de 24 h.
// Ordem de tentativa:
//  1) br.openfoodfacts.org  — catálogo brasileiro (nomes em pt-BR)
//  2) world.openfoodfacts.org/search — Search-a-licious filtrado por pt e pt-BR
//  3) world.openfoodfacts.org/cgi   — legado mundial (fallback final)
import type { FoodDb } from "./types";
import { kvGetRow, kvWrite } from "./db";

const TIMEOUT = 9000;
const FIELDS = "product_name,product_name_pt,brands,nutriments,lang";

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
  const kcal =
    num(n["energy-kcal_100g"]) ??
    (num(n["energy_100g"]) != null ? +(Number(n["energy_100g"]) / 4.184).toFixed(0) : null);
  // Prioridade: nome em pt → nome em pt-BR → nome genérico
  const name = (p.product_name_pt as string | undefined) || (p.product_name as string | undefined);
  if (!name || kcal == null) return null;
  const brand =
    typeof p.brands === "string" && p.brands
      ? ` (${(p.brands as string).split(",")[0].trim()})`
      : "";
  return {
    name: `${name}${brand}`,
    kcal,
    protein_g: num(n["proteins_100g"]) ?? 0,
    carbs_g: num(n["carbohydrates_100g"]) ?? 0,
    fat_g: num(n["fat_100g"]) ?? 0,
  };
}

/** Filtra nomes que parecem espanhol. Atenção: usa apenas palavras que NÃO
 *  existem em português ("arroz" e "para" são PT também — não entram!). */
export function ptOnly(foods: FoodDb[]): FoodDb[] {
  return foods.filter((f) => {
    const n = " " + f.name.toLowerCase() + " ";
    const hasMarcaPt = /[ãõç]|ção|ções|eiro|eira|inho|inha/.test(n);
    const looksEs =
      !hasMarcaPt &&
      /\b(pollo|leche|queso|jamon|jamón|galletas|azucar|azúcar|harina|mantequilla|frijoles|cebolla|manzana|fresa|yogur|huevo|helado|con|sin|los|las|del|una)\b/.test(
        n,
      );
    return !looksEs;
  });
}

export async function searchOpenFoodFacts(query: string): Promise<FoodDb[]> {
  const q = encodeURIComponent(query.trim());
  const endpoints: { url: string; key: "hits" | "products" }[] = [
    // 1) catálogo br — resultados já em pt-BR
    {
      url: `https://br.openfoodfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=15&fields=${FIELDS}`,
      key: "products",
    },
    // 2) Search-a-licious filtrado por idioma pt
    {
      url: `https://search.openfoodfacts.org/search?q=${q}&lang=pt&page_size=12&fields=${FIELDS}`,
      key: "hits",
    },
    // 3) fallback mundial
    {
      url: `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=12&fields=${FIELDS}`,
      key: "products",
    },
  ];

  let lastErr: Error | null = null;
  for (const ep of endpoints) {
    try {
      const data = (await fetchJson(ep.url)) as Record<string, unknown>;
      const items = (data[ep.key] ?? []) as Record<string, unknown>[];
      const foods = ptOnly(items.map(toFood).filter((f): f is FoodDb => f !== null));
      if (foods.length) return foods;
      lastErr = new Error("vazio");
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (lastErr.message === "rate")
        throw new Error(
          "Limite de buscas da Open Food Facts atingido — aguarde ~1 minuto e tente de novo.",
        );
    }
  }
  if (lastErr?.message === "vazio") return [];
  throw new Error(
    lastErr?.name === "AbortError"
      ? "A Open Food Facts demorou demais para responder — tente novamente."
      : "Não foi possível conectar à Open Food Facts — verifique a internet.",
  );
}

// ── cache local de buscas (24 h) ──
const CACHE_KEY = "hlt_food_cache";
const CACHE_TTL = 24 * 3600 * 1000;
type CacheMap = Record<string, { at: number; foods: FoodDb[] }>;

async function readCache(): Promise<CacheMap> {
  const row = await kvGetRow(CACHE_KEY);
  return (row?.value as CacheMap) ?? {};
}
async function writeCache(map: CacheMap) {
  const entries = Object.entries(map)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, 80);
  await kvWrite(CACHE_KEY, Object.fromEntries(entries), { clean: true });
}

export interface FoodSearchResult {
  foods: FoodDb[];
  fromCache: boolean;
}

export async function searchFoodsOnline(query: string): Promise<FoodSearchResult> {
  const key = query.trim().toLowerCase();
  const cache = await readCache();
  const hit = cache[key];
  if (hit && Date.now() - hit.at < CACHE_TTL && hit.foods.length)
    return { foods: hit.foods, fromCache: true };

  const foods = await searchOpenFoodFacts(query);
  if (foods.length) {
    cache[key] = { at: Date.now(), foods };
    await writeCache(cache);
  }
  return { foods, fromCache: false };
}
