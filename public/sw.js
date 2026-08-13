// ─── Service Worker PWA — Cober360 v1.0 ──────────────────────────────────────
// Adaptado desde frontend/public/sw.js

const STATIC_CACHE  = "cober360-static-v2.0"
const DYNAMIC_CACHE = "cober360-dynamic-v2.0"
const API_CACHE     = "cober360-api-v2.0"

const ALL_CACHES = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE]

const TIMEOUTS = {
  FAST_API: 10000,
  SLOW_API: 20000,
  STATIC:   15000,
}

const CRITICAL_RESOURCES = ["/", "/index.html", "/manifest.json", "/offline.html"]

const API_PATTERNS = [/\/api\//, /\/auth\//]

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(CRITICAL_RESOURCES.map((url) => new Request(url, { cache: "reload" })))
    ).then(() => {
      console.log("[SW] Instalado. Activando inmediatamente...")
      return self.skipWaiting()
    }).catch((err) => {
      console.warn("[SW] Error cacheando recursos críticos:", err)
    })
  )
})

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !ALL_CACHES.includes(k))
          .map((k) => caches.delete(k))
      )
    ).then(() => {
      console.log("[SW] Activado. Cachés antiguas eliminadas.")
      return self.clients.claim()
    })
  )
})

// ─── Helpers de estrategia ────────────────────────────────────────────────────
async function networkFirstWithTimeout(request, cacheName, timeout = TIMEOUTS.FAST_API) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(request.clone(), { signal: controller.signal })
    clearTimeout(id)
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName)
      cache.put(request.clone(), response.clone())
    }
    return response
  } catch {
    clearTimeout(id)
    const cached = await caches.match(request)
    if (cached) return cached
    if (request.destination === "document") return caches.match("/offline.html")
    throw new Error("Network and cache both failed")
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const fetchPromise = fetch(request.clone())
    .then((res) => { if (res && res.status === 200) cache.put(request.clone(), res.clone()); return res })
    .catch(() => undefined)
  return cached || fetchPromise
}

async function cacheFirstWithUpdate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) {
    const date = new Date(cached.headers.get("date") || 0)
    if (date > new Date(Date.now() - 60 * 60 * 1000)) return cached
    fetch(request.clone()).then((res) => { if (res && res.status === 200) cache.put(request.clone(), res.clone()) }).catch(() => {})
    return cached
  }
  const response = await fetch(request.clone())
  if (response && response.status === 200) cache.put(request.clone(), response.clone())
  return response
}

function getStrategy(request) {
  const url = new URL(request.url)

  // Bypass: PDFs, documentos binarios
  if (
    url.pathname.endsWith(".pdf") || url.pathname.endsWith(".doc") ||
    url.pathname.endsWith(".xls") || url.pathname.includes("/pdf/") ||
    url.pathname.includes("/download/") || url.pathname.includes("documentos/") ||
    request.headers.get("accept")?.includes("application/pdf") ||
    request.headers.get("accept")?.includes("application/octet-stream")
  ) {
    return fetch(request)
  }

  // Bypass: endpoints de sesión (evita loops de re-render)
  if (url.pathname.includes("/sessions/status") || url.pathname.includes("/sessions/renew")) {
    return fetch(request)
  }

  // APIs
  if (API_PATTERNS.some((p) => p.test(url.pathname))) {
    const isSlow = url.pathname.includes("/polizas") || url.pathname.includes("/prospectos") ||
      url.pathname.includes("/estadisticas") || url.pathname.includes("/reportes")
    return networkFirstWithTimeout(request, API_CACHE, isSlow ? TIMEOUTS.SLOW_API : TIMEOUTS.FAST_API)
  }

  // HTML
  if (request.destination === "document" || url.pathname.endsWith(".html")) {
    return staleWhileRevalidate(request, DYNAMIC_CACHE)
  }

  // Estáticos (js, css, imágenes, assets)
  if (["script", "style", "image"].includes(request.destination) ||
      url.pathname.includes("/assets/") || url.pathname.includes("/icons/")) {
    return cacheFirstWithUpdate(request, STATIC_CACHE)
  }

  return networkFirstWithTimeout(request, DYNAMIC_CACHE, TIMEOUTS.STATIC)
}

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  if (!event.request.url.startsWith("http")) return
  if (event.request.url.includes("chrome-extension")) return

  const url = new URL(event.request.url)
  if (
    url.pathname.includes("/sessions/status") ||
    url.pathname.includes("/sessions/renew") ||
    url.pathname.startsWith("/poliza-documentos/public/")
  ) return

  event.respondWith(
    getStrategy(event.request).catch(() => {
      if (event.request.destination === "document") {
        return caches.match("/offline.html") ||
          new Response("Página no disponible offline", { status: 503, headers: { "Content-Type": "text/html" } })
      }
      if (API_PATTERNS.some((p) => p.test(url.pathname))) {
        return new Response(JSON.stringify({ error: "Sin conexión" }), {
          status: 503, headers: { "Content-Type": "application/json" }
        })
      }
      return new Response("Recurso no disponible", { status: 503 })
    })
  )
})

// ─── Messages ─────────────────────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "PAGE_VISIBLE") return // silencioso
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting()
  if (event.data?.type === "CLEAR_CACHE") {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => event.ports[0]?.postMessage({ cleared: true }))
  }
})
