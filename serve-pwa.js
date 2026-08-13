// serve-pwa.js
// Servidor HTTPS local para testear la PWA en mobile real (requiere HTTPS)
// Uso: npm run serve-pwa
//
// Para generar certificados autofirmados (solo una vez):
//   openssl req -x509 -newkey rsa:4096 -keyout server.key -out server.crt -days 365 -nodes \
//     -subj "/C=AR/ST=CABA/L=Buenos Aires/O=Cober360/CN=localhost"

import { createServer } from "https"
import { readFileSync, existsSync } from "fs"
import { fileURLToPath } from "url"
import path from "path"
import express from "express"

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const app  = express()
const port = 3443

// Servir archivos estáticos desde dist/
app.use(express.static(path.join(__dirname, "dist")))

// SPA fallback — siempre devolver index.html
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"))
})

// Verificar certificados
if (!existsSync("./server.key") || !existsSync("./server.crt")) {
  console.log("🔒 Certificados HTTPS no encontrados.")
  console.log("\n📋 Generá los certificados con este comando (solo una vez):")
  console.log(
    '   openssl req -x509 -newkey rsa:4096 -keyout server.key -out server.crt -days 365 -nodes -subj "/C=AR/ST=CABA/L=Buenos Aires/O=Cober360/CN=localhost"'
  )
  console.log("\n▶️  Luego volvé a ejecutar: npm run serve-pwa")
  console.log("⚠️  Aceptá el certificado en el navegador cuando aparezca la advertencia.")
  process.exit(1)
}

const httpsOptions = {
  key:  readFileSync("./server.key"),
  cert: readFileSync("./server.crt"),
}

const server = createServer(httpsOptions, app)

server.listen(port, () => {
  // Detectar IP local para QR / mobile
  const { networkInterfaces } = await import("os").catch(() => ({ networkInterfaces: () => ({}) }))
  const nets   = networkInterfaces()
  let localIP  = "tu-ip-local"
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        localIP = iface.address
        break
      }
    }
  }

  console.log("\n🚀 Servidor PWA iniciado (HTTPS)")
  console.log(`   Desktop: https://localhost:${port}`)
  console.log(`   Mobile:  https://${localIP}:${port}`)
  console.log("\n✅ Funcionalidades PWA disponibles:")
  console.log("   • Service Worker (cache offline)")
  console.log("   • Instalación como app móvil")
  console.log("   • Notificaciones push (FCM)")
  console.log("\n💡 DevTools → Application → Manifest / Service Workers")
})

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Puerto ${port} en uso. Usá otro puerto.`)
  } else {
    console.error("❌ Error del servidor:", err.message)
  }
})
