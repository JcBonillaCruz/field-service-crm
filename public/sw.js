// BrightPro · alertas en el teléfono y la computadora (Web Push)
const OFFLINE = "bp-offline-v1";
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(OFFLINE).then((c) => c.add("/offline.html")).catch(() => undefined));
});
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Necesario para que Chrome ofrezca "Instalar app". Solo se encarga de abrir páginas:
// todo se pide a internet como siempre; si no hay conexión, muestra un aviso bonito.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html")));
});

self.addEventListener("push", (event) => {
  let d = { title: "BrightPro", body: "You have a new notification", url: "/dashboard", tag: undefined };
  try { d = { ...d, ...event.data.json() }; } catch (_) { /* texto simple */ }
  event.waitUntil(self.registration.showNotification(d.title, {
    body: d.body, icon: "/icon-192.png", badge: "/icon-192.png", tag: d.tag, renotify: true,
    vibrate: [200, 100, 200], data: { url: d.url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ("focus" in c) { c.navigate(url); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
