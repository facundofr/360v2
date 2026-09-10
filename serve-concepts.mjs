// Servidor estático para el set de concepto de diseño.
// No usa el vite.config del proyecto: estas páginas son autónomas y no
// comparten base path, plugins ni alias con la app.
import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "design-concepts");
const app = express();

app.use(express.static(raiz, { extensions: ["html"] }));
app.get("/", (_req, res) => res.sendFile(path.join(raiz, "index.html")));

const PORT = 4173;
app.listen(PORT, () => {
  console.log(`\n  El Padrón — set de concepto`);
  console.log(`  http://localhost:${PORT}\n`);
});
