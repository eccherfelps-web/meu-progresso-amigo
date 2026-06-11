import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ??
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string | undefined;
  client = url && key ? createClient(url, key) : null;
  return client;
}
export function remoteEnabled(): boolean { return getSupabase() !== null; }

export function deviceId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = window.localStorage.getItem("hlt_device_id");
  if (!id) {
    id = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(16).slice(2);
    window.localStorage.setItem("hlt_device_id", id);
  }
  return id;
}
