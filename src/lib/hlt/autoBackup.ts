// Backup automático semanal para o Supabase Storage. Gera um snapshot JSON
// e mantém as últimas cópias (rotativo). Silencioso — roda em segundo plano.
import { kvAllData, kvGetRow, kvWrite } from "./db";
import { getSupabase, deviceId, remoteEnabled } from "./supabase";

const META_KEY = "hlt_backup_meta";
const INTERVAL = 7 * 24 * 3600 * 1000; // 7 dias
const KEEP = 10;

export interface BackupMeta {
  lastAt: string | null;
  lastPath: string | null;
  history: { path: string; at: string }[];
}

export async function getBackupMeta(): Promise<BackupMeta> {
  const row = await kvGetRow(META_KEY);
  return (row?.value as BackupMeta) ?? { lastAt: null, lastPath: null, history: [] };
}

export async function runBackup(force = false): Promise<{ ok: boolean; reason?: string }> {
  if (!remoteEnabled() || typeof window === "undefined" || !navigator.onLine)
    return { ok: false, reason: "offline" };
  const meta = await getBackupMeta();
  if (!force && meta.lastAt && Date.now() - new Date(meta.lastAt).getTime() < INTERVAL)
    return { ok: false, reason: "recent" };

  try {
    const sb = getSupabase()!;
    const data = await kvAllData();
    const now = new Date();
    const path = `${deviceId()}/auto-${now.toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    const blob = new Blob(
      [JSON.stringify({ app: "healthy-life", at: now.toISOString(), data }, null, 2)],
      {
        type: "application/json",
      },
    );
    const { error } = await sb.storage.from("backups").upload(path, blob, { upsert: true });
    if (error) throw error;

    const history = [{ path, at: now.toISOString() }, ...meta.history].slice(0, KEEP);
    // remove backups além do limite
    const toDelete = [{ path, at: now.toISOString() }, ...meta.history]
      .slice(KEEP)
      .map((h) => h.path);
    if (toDelete.length) await sb.storage.from("backups").remove(toDelete);

    await kvWrite(
      META_KEY,
      { lastAt: now.toISOString(), lastPath: path, history },
      { clean: true },
    );
    return { ok: true };
  } catch (e) {
    console.error("[auto-backup]", e);
    return { ok: false, reason: e instanceof Error ? e.message : "erro" };
  }
}

export function startAutoBackup() {
  if (typeof window === "undefined" || !remoteEnabled()) return;
  // tenta ao abrir (respeitando o intervalo) e a cada 6 h
  setTimeout(() => void runBackup(), 8000);
  setInterval(() => void runBackup(), 6 * 3600 * 1000);
}
