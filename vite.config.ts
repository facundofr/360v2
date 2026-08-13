import path from "path"
import { copyFileSync, readFileSync } from "fs"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8"))

// El service worker de FCM tiene que quedar en la RAÍZ del dominio, no bajo
// /afiliaciones/, porque su scope determina qué páginas reciben push en
// background. Mismo comportamiento que `frontend/vite.config.js`.
function copyFirebaseSwPlugin(): Plugin {
  return {
    name: "copy-firebase-sw",
    closeBundle() {
      const source = path.resolve(__dirname, "public/firebase-messaging-sw.js")

      try {
        copyFileSync(source, path.resolve(__dirname, "dist/firebase-messaging-sw.js"))
        console.log("✅ firebase-messaging-sw.js copiado a dist/")
      } catch (error) {
        console.warn("⚠️ No se pudo copiar firebase-messaging-sw.js a dist/:", (error as Error).message)
      }

      // Sólo aplica en el servidor de despliegue; en local falla y no importa.
      try {
        copyFileSync(source, "/var/www/360/firebase-messaging-sw.js")
        console.log("✅ firebase-messaging-sw.js copiado a /var/www/360/")
      } catch {
        // Silencioso: en build local ese path no existe.
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), copyFirebaseSwPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  /*
    Path bajo el que se sirve la app.
    ─────────────────────────────────────────────────────────────────────────
    Producción vive en `360.cober.online/afiliaciones/`, que es el default.
    Vercel sirve desde la raíz del subdominio, así que ahí hay que buildear con
    VITE_BASE_PATH=/

    Si no coincide con dónde se sirve realmente, el navegador pide
    `/afiliaciones/assets/…`, el rewrite del SPA devuelve el index.html y el
    módulo llega con MIME `text/html`. Es el error clásico de "Expected a
    JavaScript module but the server responded with text/html".
  */
  base: process.env.VITE_BASE_PATH ?? "/afiliaciones/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 5173,
    hmr: { host: "localhost", port: 5173, protocol: "ws" },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor":    ["react", "react-dom", "react-router-dom"],
          "recharts-vendor": ["recharts"],
          "ui-vendor":       ["radix-ui", "class-variance-authority"],
        },
      },
    },
  },
  assetsInclude: ["**/*.png", "**/*.ico"],
})
