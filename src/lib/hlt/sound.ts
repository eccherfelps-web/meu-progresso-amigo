// Alertas sonoros sintetizados via Web Audio — sem arquivos de áudio.
// O contexto precisa ser "destravado" por um gesto do usuário (regra dos
// navegadores); fazemos isso ao tocar em "Concluir Série".
export type AlertSound = "beep" | "sino" | "digital";

export const SOUND_OPTIONS: { value: AlertSound; label: string }[] = [
  { value: "beep", label: "Beep clássico" },
  { value: "sino", label: "Sino" },
  { value: "digital", label: "Digital" },
];

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

/** Chamar dentro de um clique/toque para liberar o áudio (inclusive em segundo plano). */
export function unlockAudio() {
  const c = getCtx();
  if (c && c.state === "suspended") void c.resume();
}

function tone(
  c: AudioContext,
  freq: number,
  start: number,
  dur: number,
  vol: number,
  type: OscillatorType = "sine",
) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, c.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), c.currentTime + start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + dur + 0.05);
}

/** Toca o alerta escolhido. volume: 0–1. */
export function playAlert(sound: AlertSound = "beep", volume = 0.7) {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  const v = Math.min(1, Math.max(0, volume));
  if (v === 0) return;
  switch (sound) {
    case "beep":
      tone(c, 880, 0.0, 0.18, v);
      tone(c, 880, 0.28, 0.18, v);
      tone(c, 1175, 0.56, 0.3, v);
      break;
    case "sino":
      tone(c, 1318.5, 0, 1.4, v * 0.9);
      tone(c, 2637, 0, 0.9, v * 0.35);
      tone(c, 1318.5, 0.5, 1.2, v * 0.5);
      break;
    case "digital":
      tone(c, 660, 0.0, 0.1, v, "square");
      tone(c, 880, 0.15, 0.1, v, "square");
      tone(c, 660, 0.3, 0.1, v, "square");
      tone(c, 1100, 0.45, 0.25, v, "square");
      break;
  }
}
