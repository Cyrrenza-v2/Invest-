/* Installable shell only. The app remains network-backed; no financial or auth data is cached. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
