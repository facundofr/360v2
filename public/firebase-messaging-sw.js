// ─── Firebase Messaging Service Worker ───────────────────────────────────────
// Maneja notificaciones push en background (tab cerrada / segundo plano)

// Sin importScripts a propósito: este worker maneja el push con el listener
// nativo (abajo) y no usa el SDK de Firebase en ningún lado. Antes cargaba
// firebase-app-compat y firebase-messaging-compat desde el CDN de gstatic sin
// llegar a usarlos; el costo real de eso no era el peso sino que un
// importScripts fallido (CDN bloqueado, red corporativa, primer arranque sin
// conexión) aborta la instalación entera del service worker y deja al usuario
// sin notificaciones en segundo plano. Producción tampoco importa nada.

// ─── Push: notificaciones en background ──────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return
  try {
    const data = event.data.json()
    const options = {
      body:             data.notification?.body ?? "Nueva notificación",
      icon:             "/icons/icon-192x192.png",
      badge:            "/icons/icon-192x192.png",
      tag:              data.data?.tipo ?? "cober360",
      data:             data.data ?? {},
      vibrate:          [200, 100, 200],
      requireInteraction: false,
      actions: [
        { action: "open",  title: "Abrir" },
        { action: "close", title: "Cerrar" },
      ],
    }
    event.waitUntil(
      self.registration.showNotification(data.notification?.title ?? "Cober360", options)
    )
  } catch (err) {
    console.error("[FCM-SW] Error procesando push:", err)
  }
})

// ─── Click en notificación ────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  if (event.action === "close") return

  event.waitUntil(
    verificarSesionActiva().then((tieneSesion) => {
      const url = tieneSesion ? "/vendedor/prospectos" : "/"
      return clients.matchAll({ type: "window" }).then((list) => {
        for (const client of list) {
          if ("focus" in client) {
            client.focus()
            client.postMessage({
              type: "NOTIFICATION_CLICKED",
              data: event.notification.data,
              action: event.action,
              destinoUrl: url,
            })
            return client
          }
        }
        if (clients.openWindow) return clients.openWindow(url)
      })
    }).catch(() => clients.openWindow?.("/"))
  )
})

// ─── Mensajes desde la app ────────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting()
  if (event.data?.type === "INIT_FCM") console.log("[FCM-SW] FCM inicializado")
})

// ─── Helpers ──────────────────────────────────────────────────────────────────
function verificarSesionActiva() {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => resolve(false), 2000)
    try {
      const req = indexedDB.open("firebaseLocalStorageDb")
      req.onerror = () => { clearTimeout(timeoutId); resolve(false) }
      req.onsuccess = () => {
        try {
          const db = req.result
          const tx = db.transaction(["firebaseLocalStorage"], "readonly")
          const store = tx.objectStore("firebaseLocalStorage")
          const count = store.count()
          count.onsuccess = () => { clearTimeout(timeoutId); resolve(count.result > 0) }
          count.onerror  = () => { clearTimeout(timeoutId); resolve(false) }
        } catch {
          clearTimeout(timeoutId); resolve(false)
        }
      }
    } catch {
      clearTimeout(timeoutId); resolve(false)
    }
  })
}
