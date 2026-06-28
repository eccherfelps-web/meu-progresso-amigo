// Alertas sonoros sintetizados via Web Audio — sem arquivos de áudio.
// O contexto precisa ser "destravado" por um gesto do usuário (regra dos
// navegadores). Detalhe crítico: ao tocar depois de um tempo (fim do
// descanso), o contexto pode ter voltado a "suspended" — por isso o disparo
// dos tons SEMPRE espera o resume() concluir antes de agendar o áudio.
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

/** Liga o áudio num gesto do usuário. Mantém o contexto "aquecido" tocando um
 *  buffer silencioso — isso melhora muito a chance de tocar em segundo plano. */
export function unlockAudio() {
  const c = getCtx();
  if (!c) return;
  void c.resume();
  try {
    const buffer = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.connect(c.destination);
    src.start(0);
  } catch {
    /* ignore */
  }
}

function tone(
  c: AudioContext,
  freq: number,
  start: number,
  dur: number,
  vol: number,
  type: OscillatorType = "sine",
) {
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function emit(c: AudioContext, sound: AlertSound, v: number) {
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

/** Toca o alerta. Espera o contexto retomar (caso suspenso) antes de emitir,
 *  o que conserta o caso "não toca ao fim do descanso". */
export function playAlert(sound: AlertSound = "beep", volume = 0.7) {
  const c = getCtx();
  if (!c) return;
  const v = Math.min(1, Math.max(0, volume));
  if (v === 0) return;
  if (c.state === "suspended") {
    // agenda os tons só depois do resume — senão saem mudos
    c.resume()
      .then(() => emit(c, sound, v))
      .catch(() => {});
  } else {
    emit(c, sound, v);
  }
}
