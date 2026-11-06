/* Service worker del pannello: riceve le push e apre la pagina giusta al tocco. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let items = [];
      try {
        const res = await fetch("/api/admin/notifications/latest", { credentials: "same-origin", cache: "no-store" });
        if (res.ok) items = (await res.json()).items || [];
      } catch (_) {}
      const n = items[0];
      await self.registration.showNotification(n ? n.title : "Nuova attività", {
        body: n ? n.body : "Apri il pannello per i dettagli.",
        tag: n ? n.id : "generic",
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        data: { url: (n && n.url) || "/admin" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/admin", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if (c.url.startsWith(self.location.origin + "/admin")) {
          await c.focus();
          return c.navigate(url);
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
