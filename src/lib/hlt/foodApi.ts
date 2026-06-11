// Banco de alimentos dinâmico via Open Food Facts (grátis, sem chave),
// complementando a tabela local. Pronto para plugar TACO/USDA no futuro.
import type { FoodDb } from "./types";

export async function searchOpenFoodFacts(query: string): Promise<FoodDb[]> {
  const url =
    "https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=12" +
    "&fields=product_name,brands,nutriments&search_terms=" + encodeURIComponent(query);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Busca online indisponível");
  const data = (await res.json()) as { products?: Array<Record<string, unknown>> };
  return (data.products ?? [])
    .map((p) => {
      const n = (p.nutriments ?? {}) as Record<string, unknown>;
      const num = (v: unknown) => (v == null || isNaN(Number(v)) ? null : +Number(v).toFixed(1));
      const kcal = num(n["energy-kcal_100g"]);
      if (!p.product_name || kcal == null) return null;
      const brand = typeof p.brands === "string" && p.brands ? ` (${(p.brands as string).split(",")[0].trim()})` : "";
      return {
        name: `${p.product_name}${brand}`,
        kcal,
        protein_g: num(n["proteins_100g"]) ?? 0,
        carbs_g: num(n["carbohydrates_100g"]) ?? 0,
        fat_g: num(n["fat_100g"]) ?? 0,
      } as FoodDb;
    })
    .filter((f): f is FoodDb => f !== null);
}
