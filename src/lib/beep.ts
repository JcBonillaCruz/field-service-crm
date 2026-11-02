// Sonido de "beep" al leer un código (como las pistolas de las tiendas). Sin archivos: lo genera el navegador.
let ctx: AudioContext | null = null;
function getCtx() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}
// iPhone solo deja sonar después de que la persona tocó algo: esto "despierta" el audio en el primer toque
export function primeBeep() {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}
export function playBeep(ok = true) {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const o = c.createOscillator(), g = c.createGain();
  o.type = "square";
  o.frequency.value = ok ? 1850 : 420;
  const t = c.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (ok ? 0.13 : 0.3));
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + (ok ? 0.15 : 0.32));
}
