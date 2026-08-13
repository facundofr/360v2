// ─────────────────────────────────────────────────────────────────────────────
// Purga de la caché de API del service worker.
//
// POR QUÉ EXISTE
// `public/sw.js` cachea en `cober360-api-*` las respuestas GET de `/api/` y
// `/auth/` (estrategia network-first: si la red falla, sirve lo cacheado).
// Eso incluye prospectos, pólizas y declaraciones juradas de salud.
//
// La CacheStorage es por ORIGEN, no por usuario ni por sesión: sobrevive al
// logout. En un equipo compartido —recepción, un escritorio rotativo— el
// siguiente usuario que entre y se quede sin red vería datos personales del
// anterior. Por eso la caché se vacía en cada cambio de sesión.
//
// Sólo se toca la caché de API. `cober360-static-*` son assets con hash y
// `cober360-dynamic-*` es el shell HTML del SPA (que no lleva datos de usuario,
// todo se renderiza en el cliente): vaciar esas dos sólo empeoraría el arranque.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prefijo, no el nombre completo: `sw.js` versiona sus cachés
 * (`cober360-api-v2.0`) y al subir esa versión un nombre fijo acá quedaría
 * apuntando a una caché que ya no se usa, sin que nada avise.
 */
const PREFIJO_CACHE_API = "cober360-api"

/**
 * Borra toda caché de API del origen. Best-effort: si el navegador no soporta
 * CacheStorage o la operación falla, no interrumpe el flujo de sesión.
 *
 * Se ejecuta desde la página, no desde el service worker: la CacheStorage es
 * compartida por origen, así que funciona igual haya o no un SW controlando —
 * incluida la primera carga, antes de que el worker tome control.
 */
export async function purgarCacheApi(): Promise<void> {
  if (typeof caches === "undefined") return
  try {
    const nombres = await caches.keys()
    await Promise.all(
      nombres
        .filter((n) => n.startsWith(PREFIJO_CACHE_API))
        .map((n) => caches.delete(n))
    )
  } catch {
    // Modo privado de algunos navegadores, cuota agotada, etc. No es crítico:
    // la purga del login siguiente vuelve a intentarlo.
  }
}

/**
 * Versión que no bloquea, para llamar desde código sincrónico.
 *
 * En el logout la purga es best-effort de verdad: si la redirección al login
 * descarga la página antes de que termine el borrado, queda a medias. Por eso
 * `persistSession()` purga TAMBIÉN al iniciar sesión — ese es el momento que
 * realmente garantiza que un usuario no vea la caché del anterior, y no depende
 * de que el anterior haya cerrado sesión correctamente.
 */
export function purgarCacheApiSync(): void {
  void purgarCacheApi()
}
