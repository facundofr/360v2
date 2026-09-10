// Sirve el build de producción para inspección visual local.
import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");
const app = express();
const BASE = "/afiliaciones";

app.use(BASE, express.static(raiz));
/* Fallback de SPA. Express 5 cambió la sintaxis de comodines, así que va como
   middleware y no como ruta con patrón. */
app.use((req, res, next) => {
  if (req.method !== "GET" || !req.path.startsWith(BASE)) return next();
  res.sendFile(path.join(raiz, "index.html"));
});
app.use((_req, res) => res.redirect(`${BASE}/`));

app.listen(4175, () => console.log(`build → http://localhost:4175${BASE}/`));
