// Sincronização do armazenamento local com a tabela kv_store do Supabase.
// PUSH: envia chaves com dirty=1 · PULL: baixa chaves mais novas que o
// último pull · Conflito: vence o updated_at mais recente (LWW).
import { kvDirtyRows, kvMarkClean, kvGetRow, kvWrite } from "./db";
import { getSupabase, deviceId, remoteEnabled } from "./supabase";
import { applyRemote } from "./storage";

export type SyncState = "disabled" | "offline" | "idle" | "syncing" | "error";
let state: SyncState = "disabled";
const listeners = new Set<(s: SyncState) => void>();
function setState(s: SyncState) { state = s; listeners.forEach((fn) => fn(s)); }
export function getSyncState() { return state; }
export function onSyncState(fn: (s: SyncState) => void) {
  listeners.add(fn); fn(state);
  return () => { listeners.delete(fn); };
}

let lastError: string | null = null;
export function getLastSyncError() { return lastError; }

let running = false;
export async function syncNow(): Promise<void> {
  if (typeof window === "undefined" || running) return;
  if (!remoteEnabled()) { setState("disabled"); return; }
  if (!navigator.onLine) { setState("offline"); return; }
  const sb = getSupabase()!;
  running = true; setState("syncing");
  try {
    const dev = deviceId();
    // PUSH
    const dirty = await kvDirtyRows();
    if (dirty.length) {
      const { error } = await sb.from("kv_store").upsert(
        dirty.map((r) => ({ device_id: dev, key: r.key, value: r.value, updated_at: r.updated_at })),
        { onConflict: "device_id,key" },
      );
      if (error) throw error;
      await kvMarkClean(dirty.map((r) => r.key));
    }
    // PULL
    const lastRow = await kvGetRow("__lastPull");
    const since = (lastRow?.value as string) ?? "1970-01-01T00:00:00Z";
    const { data, error } = await sb.from("kv_store")
      .select("key,value,updated_at")
      .eq("device_id", dev)
      .gt("updated_at", since)
      .order("updated_at", { ascending: true })
      .limit(500);
    if (error) throw error;
    for (const remote of data ?? []) {
      const local = await kvGetRow(remote.key);
      if (!local || new Date(remote.updated_at) >= new Date(local.updated_at)) {
        await applyRemote(remote.key, remote.value, remote.updated_at);
      }
    }
    lastError = null;
    if (data?.length) await kvWrite("__lastPull", data[data.length - 1].updated_at, { clean: true });
    setState("idle");
  } catch (err) {
    console.error("[hlt-sync]", err);
    const msg = err instanceof Error ? err.message : String(err);
    lastError = /kv_store|42P01|relation/i.test(msg)
      ? "Tabela kv_store não existe no Supabase — rode o supabase/schema.sql no SQL Editor."
      : msg;
    setState("error");
  } finally {
    running = false;
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
export function scheduleSync() {
  if (typeof window === "undefined" || !remoteEnabled()) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void syncNow(), 4000);
}

let started = false;
export function startAutoSync() {
  if (typeof window === "undefined" || started) return;
  started = true;
  if (!remoteEnabled()) { setState("disabled"); return; }
  window.addEventListener("online", () => void syncNow());
  setInterval(() => void syncNow(), 3 * 60 * 1000);
  void syncNow();
}
