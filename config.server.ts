// Fotos de evolução corporal: comprimidas no aparelho (canvas) e salvas
// no IndexedDB. Upload para bucket na nuvem entra na Fase 2 (com contas).
import { getDb, type PhotoRow } from "./db";

const MAX_DIM = 1000,
  QUALITY = 0.82;

async function compress(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", QUALITY);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function savePhoto(file: File, angle: PhotoRow["angle"]): Promise<PhotoRow | null> {
  const db = getDb();
  if (!db) return null;
  const row: PhotoRow = {
    id: `ph-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    date: new Date().toISOString().slice(0, 10),
    angle,
    dataUrl: await compress(file),
    created_at: new Date().toISOString(),
  };
  await db.photos.put(row);
  return row;
}
export async function listPhotos(): Promise<PhotoRow[]> {
  const db = getDb();
  if (!db) return [];
  return (await db.photos.toArray()).sort((a, b) => b.date.localeCompare(a.date));
}
export async function removePhoto(id: string) {
  const db = getDb();
  if (db) await db.photos.delete(id);
}
export type { PhotoRow };
