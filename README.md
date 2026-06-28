// Banco local em IndexedDB (Dexie) — substitui o localStorage como
// armazenamento permanente, mantendo o formato de dados existente.
// Cada chave antiga (hlt_*) vira uma linha na tabela kv, com carimbo
// de atualização e flag "dirty" para a sincronização com a nuvem.
import Dexie, { type Table } from "dexie";

export interface KvRow {
  key: string;
  value: unknown;
  updated_at: string; // ISO
  dirty: number; // 1 = ainda não subiu para o servidor
}
export interface PhotoRow {
  id: string;
  date: string; // YYYY-MM-DD
  angle: "frontal" | "lateral" | "traseira";
  dataUrl: string; // imagem comprimida
  created_at: string;
}

class HltDb extends Dexie {
  kv!: Table<KvRow, string>;
  photos!: Table<PhotoRow, string>;
  constructor() {
    super("hlt-db");
    this.version(1).stores({ kv: "key, dirty", photos: "id, date" });
  }
}

let _db: HltDb | null = null;
export function getDb(): HltDb | null {
  if (typeof window === "undefined") return null; // SSR: sem IndexedDB
  if (!_db) _db = new HltDb();
  return _db;
}

// ── migração única: localStorage (app antigo) → IndexedDB ──
const LEGACY_KEYS = [
  "hlt_profile",
  "hlt_exercises",
  "hlt_workout_sessions",
  "hlt_weight_logs",
  "hlt_food_logs",
  "hlt_hydration_logs",
  "hlt_assessment",
  "hlt_body_measures",
];
let migration: Promise<void> | null = null;
export function ensureMigrated(): Promise<void> {
  const db = getDb();
  if (!db) return Promise.resolve();
  if (!migration) {
    migration = (async () => {
      const done = await db.kv.get("__migrated");
      if (done) return;
      const now = new Date().toISOString();
      for (const k of LEGACY_KEYS) {
        try {
          const raw = window.localStorage.getItem(k);
          if (raw != null) {
            await db.kv.put({ key: k, value: JSON.parse(raw), updated_at: now, dirty: 1 });
          }
        } catch {
          /* valor corrompido: ignora */
        }
      }
      await db.kv.put({ key: "__migrated", value: true, updated_at: now, dirty: 0 });
      // os dados antigos permanecem no localStorage como cópia de segurança
    })();
  }
  return migration;
}

export async function kvGetRow(key: string): Promise<KvRow | undefined> {
  const db = getDb();
  if (!db) return undefined;
  await ensureMigrated();
  return db.kv.get(key);
}
export async function kvWrite(
  key: string,
  value: unknown,
  opts?: { clean?: boolean; updated_at?: string },
) {
  const db = getDb();
  if (!db) return;
  await ensureMigrated();
  await db.kv.put({
    key,
    value,
    updated_at: opts?.updated_at ?? new Date().toISOString(),
    dirty: opts?.clean ? 0 : 1,
  });
}
export async function kvDirtyRows(): Promise<KvRow[]> {
  const db = getDb();
  if (!db) return [];
  await ensureMigrated();
  return (await db.kv.where("dirty").equals(1).toArray()).filter((r) => !r.key.startsWith("__"));
}
export async function kvMarkClean(keys: string[]) {
  const db = getDb();
  if (!db) return;
  await db.transaction("rw", db.kv, async () => {
    for (const k of keys) {
      const row = await db.kv.get(k);
      if (row) await db.kv.put({ ...row, dirty: 0 });
    }
  });
}
export async function kvAllData(): Promise<Record<string, unknown>> {
  const db = getDb();
  if (!db) return {};
  await ensureMigrated();
  const rows = await db.kv.toArray();
  const out: Record<string, unknown> = {};
  for (const r of rows) if (!r.key.startsWith("__")) out[r.key] = r.value;
  return out;
}
export async function kvReset() {
  const db = getDb();
  if (!db) return;
  await db.kv.clear();
  await db.photos.clear();
  for (const k of LEGACY_KEYS) window.localStorage.removeItem(k);
  // impede que a migração reimporte dados antigos
  await db.kv.put({
    key: "__migrated",
    value: true,
    updated_at: new Date().toISOString(),
    dirty: 0,
  });
  migration = Promise.resolve();
}
