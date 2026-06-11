import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Projeto Supabase do Felps (healthy-life). A chave "anon" é pública por
// design (vai ao navegador em qualquer app web); o acesso por usuário será
// travado com Auth + RLS na Fase 2. Variáveis de ambiente, se definidas,
// têm prioridade sobre estes valores.
const DEFAULT_URL = "https://wmqnlgpqoqvznsnxcrhe.supabase.co";
const DEFAULT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtcW5sZ3Bxb3F2em5zbnhjcmhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNTM4ODQsImV4cCI6MjA5NjcyOTg4NH0.7Kgp0Q8_iuDQ7OSKEyDMqjc_QACS6nMZ6wyx2tyOMAQ";

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_URL;
  const key =
    ((import.meta.env.VITE_SUPABASE_ANON_KEY ??
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string | undefined) || DEFAULT_ANON_KEY;
  client = url && key ? createClient(url, key) : null;
  return client;
}
export function remoteEnabled(): boolean { return getSupabase() !== null; }

// Namespace fixo do usuário: todos os aparelhos do Felps leem/escrevem o
// mesmo conjunto de chaves → sincronização real entre celular e PC.
// (Na Fase 2, com contas, isto vira o user_id do Supabase Auth.)
const USER_NAMESPACE = "felps-principal";

export function deviceId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = window.localStorage.getItem("hlt_device_id");
  if (!id || id !== USER_NAMESPACE) {
    id = USER_NAMESPACE;
    window.localStorage.setItem("hlt_device_id", id);
  }
  return id;
}
