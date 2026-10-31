let ctx: AudioContext | null = null;
const KEY = "zgamelib-bp-sound";

export function isSoundEnabled() {
  try { return localStorage.getItem(KEY) !== "0"; } catch { return true; }
}

export function setSoundEnabled(v: boolean) {
  try { localStorage.setItem(KEY, v ? "1" : "0"); } catch {}
}

function audio() {
  if (!ctx) {
    try { ctx = new AudioContext(); } catch { return null; }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq: number, dur: number, gain: number, type: OscillatorType = "sine", delay = 0, slideTo?: number) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export type SoundKind = "move" | "select" | "back" | "tab" | "launch" | "error";

export function playSound(kind: SoundKind) {
  if (!isSoundEnabled()) return;
  switch (kind) {
    case "move": tone(1500, 0.035, 0.035, "triangle"); break;
    case "tab": tone(900, 0.06, 0.05, "triangle", 0, 1300); break;
    case "select": tone(880, 0.07, 0.06, "sine"); tone(1320, 0.09, 0.05, "sine", 0.05); break;
    case "back": tone(700, 0.08, 0.05, "sine", 0, 420); break;
    case "launch": tone(523, 0.12, 0.06, "sine"); tone(659, 0.12, 0.06, "sine", 0.08); tone(1046, 0.25, 0.06, "sine", 0.16); break;
    case "error": tone(220, 0.15, 0.06, "square"); break;
  }
}
