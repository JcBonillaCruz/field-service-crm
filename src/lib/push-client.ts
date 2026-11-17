// Al cerrar sesión: este teléfono/navegador deja de estar ligado a la cuenta que sale,
// para que no le sigan llegando las alertas de esa cuenta a quien entre después.
// (El permiso del navegador se queda; al entrar con otra cuenta se liga solo a la nueva.)
export async function releasePushDevice() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/push/subscribe", { method: "DELETE", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
  } catch { /* sin conexión: al entrar otra cuenta se reasigna de todos modos */ }
}
