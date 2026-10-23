// Pantalla de bienvenida: SOLO después de iniciar sesión (nunca antes del login)
const KEY = "bp-splash";
export function showSplash() {
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* */ }
  window.dispatchEvent(new Event("bp-splash:show"));
}
export function hideSplash() {
  try { sessionStorage.removeItem(KEY); } catch { /* */ }
  window.dispatchEvent(new Event("bp-splash:hide"));
}
export function splashPending() {
  try { const t = Number(sessionStorage.getItem(KEY) || 0); return t > 0 && Date.now() - t < 15000; } catch { return false; }
}
