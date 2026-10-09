const CACHE_NAME = "islv2-public-shell-v2";
const APP_SHELL = [
  "/painel-v2/",
  "/painel-v2/manifest.webmanifest",
  "/painel-v2/icons/isl-v2-192.png",
  "/icons/isl-v2-512.png",
  "/icons/apple-touch-icon.png",
];
const STATIC_DESTINATIONS = new Set(["script", "style", "image", "font"]);

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("islv2-public-shell-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (["/api", "/auth", "/rest", "/rpc", "/functions"].some((prefix) =>
    url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
  )) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(APP_ROOT, response.clone());
        }
        return response;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(APP_ROOT)) || Response.error();
      }
    })());
    return;
  }

  if (STATIC_DESTINATIONS.has(request.destination)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      const cacheControl = response.headers.get("cache-control") || "";
      if (
        response.ok &&
        response.type === "basic" &&
        !/private|no-store/i.test(cacheControl)
      ) {
        await cache.put(request, response.clone());
      }
      return response;
    })());
  }
});
