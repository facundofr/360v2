---
name: IA-Migracion-Frontend
description: "Instrucciones estructuradas para que otra IA analice, reorganice y migre este frontend (Vite + React). Contiene pasos, mapping, heurísticas, y comprobaciones automáticas para entender la funcionalidad y reubicar archivos/carpeta a una nueva arquitectura."
version: 1.0
---

# Guía para IA: Organización y migración del proyecto (frontend)

Propósito: Este archivo debe ser importado por otra IA. Define cómo analizar la base de código, cómo inferir la funcionalidad, y pasos concretos para reorganizar carpetas/archivos y migrar el proyecto a otra arquitectura (monorepo, nuevo layout, o distinta infraestructura de despliegue).

## 1) Resumen automático (extraer primero)
- Ejecutar: leer `package.json` para obtener scripts (`dev`, `build`, `preview`, `lint`) y dependencias.
- Tecnologías clave detectadas: React (v19), Vite, MUI, Axios, Firebase, Socket.IO, Styled Components, Sass.

Acciones iniciales que debe hacer la IA al importar este archivo:
- Parsear `package.json` y registrar `scripts`, `dependencies` y `devDependencies`.
- Identificar `vite.config.js`, `index.html` y `public/`.

## 2) Estructura actual (puntos relevantes)
Basado en el repositorio presente, fichas importantes:
- `src/components/` — UI y vistas: `common`, `admin`, `badges`, `buttons`, `features`, `layout`, `modals`, `supervisor`, `utils`.
- `src/contexts/` — contextos React (ej. `NotificationContext.jsx`).
- `src/hooks/` — hooks personalizados (ej. `useDeviceDetection.js`, `useHeartbeat.js`).
- `src/services/` — clientes de API (ej. `notificationsService.js`, `refritosService.js`).
- `src/styles/` y `src/assets/` — estilos y recursos.
- `public/` — archivos estáticos y service workers.

Nota: la IA debe recorrer estos directorios y generar un mapa `{ruta -> tipo -> breve descripción}` para cada archivo.

## 3) Objetivo de la reorganización (convenciones sugeridas)
- Mantener semántica: separar `ui` (componentes visuales reutilizables) de `features` (lógica por dominio/route).
- Adoptar structure feature-first o monorepo (según target):

  Opción A — Aplicación monolítica (estructura recomendada):

  - src/
    - app/ (entry, rutas, layouts)
    - features/{featureName}/ (componentes, hooks, tests, styles)
    - ui/ (componentes atómicos, botones, modals)
    - services/ (API clients, adapters)
    - contexts/
    - hooks/
    - assets/
    - styles/

  Opción B — Monorepo (si migras a packages):
  - packages/
    - ui/ (biblioteca de componentes)
    - app/ (aplicación web)
    - shared/ (utils, services, types)

## 4) Regla general para mover archivos
1. Identificar la responsabilidad del archivo (UI, lógica de negocio, API, state, test).
2. Si es puramente visual y reutilizable: mover a `ui` o `packages/ui`.
3. Si pertenece a un flujo de negocio (p. ej. `features/admin`): mover a `features/admin` dentro de la app o paquete correspondiente.
4. Servicios (`src/services/*.js`) deben ubicarse en `services` o `shared/services` y exponerse como API puras (sin side-effects directos de UI).
5. Contextos globales y providers → `contexts` en la app principal o `shared/context`.

Al mover: actualizar imports con transformadores AST (no sólo regex). Recomendado: usar `jscodeshift` o `ts-morph` para reescribir `import` de forma segura.

## 5) Plantilla de mapping (ejemplo)
Use un CSV/JSON con columnas: `old_path`, `new_path`, `action`, `notes`.

Ejemplo (JSON):

```json
[
  {"old_path":"src/components/common/AccessDenied.jsx","new_path":"src/ui/components/AccessDenied/AccessDenied.jsx","action":"move+update-imports","notes":"Componente UI reutilizable"},
  {"old_path":"src/services/notificationsService.js","new_path":"src/services/notifications/index.js","action":"move+refactor","notes":"Convertir a cliente sin side-effects"}
]
```

## 6) Heurísticas para entender funcionalidad de archivos
- Buscar palabras clave en archivo: `export default`, `useEffect`, `useState`, `fetch`, `axios`, `socket`, `firebase`, `Provider`, `Context`, `route`, `ProtectedRoute`, `NavBar`.
- Archivos con `*Modal.jsx`, `*Modal.css` → UI modal.
- `*Service.js` → interacción con APIs o adapters.
- `*Monitor.jsx`, `Dashboard.jsx`, `Admin` → pantallas de administración.
- `AuthContext.jsx`, `ProtectedRoute.jsx` → auth + control de acceso.

Para cada archivo, la IA debe generar un pequeño resumen (1-2 líneas): "rol", "entradas", "efectos secundarios", "dependencias internas".

## 7) Pasos automatizados que la IA debe ejecutar
1. Parsear `package.json` y `vite.config.js` para registrar scripts y paths.
2. Generar `mapping.json` inicial según heurísticas y reglas de negocio.
3. Crear rama `migration/auto-YYYYMMDD` y preparar estructura destino (carpetas vacías + package manifests si aplica).
4. Ejecutar movimientos file-by-file según `mapping.json`:
   - Copiar archivo a `new_path`.
   - Reescribir imports relativos usando AST (actualizar extensiones si necesario: .jsx → .jsx).
   - Ajustar exports default/named si cambia ubicación.
5. Actualizar configuraciones (vite, paths, aliases): añadir `resolve.alias` o `jsconfig.json`/`tsconfig.json` con paths.
6. Ejecutar `npm run lint` y corregir fallos automáticos (`eslint --fix`).
7. Ejecutar `npm run build` para verificar que build funciona.
8. Ejecutar revisión manual asistida: listar archivos con errores no resueltos.

## 8) Herramientas y comandos sugeridos
- Use `jscodeshift` con transformadores personalizados para actualizar imports.
- Para renombrados masivos y refactor AS T: `ts-morph` (Node) o `babel` + `@babel/parser`.
- Para pruebas rápidas: `npm run dev` y `npm run build`.
- Para validaciones estáticas: `eslint .` y `npm run lint`.

Ejemplo de codemod (concepto):
1. Detectar `import X from '../../components/common/X'`.
2. Reescribir a `import X from 'ui/components/X'` si se mueve a `ui` package.

## 9) Comprobaciones post-migración (lista mínima)
- `npm ci` / `npm install` se completa sin errores.
- `npm run lint` → 0 errores (o sólo warnings aceptables).
- `npm run build` finaliza con exit code 0.
- Revisar bundles para assets faltantes.
- Ejecutar navegación manual automática: iniciar `dev` y verificar rutas principales (login, dashboard admin, monitor) mediante una serie de checks automáticos (puede usar Playwright/puppeteer minimal).

## 10) Manejo de variables de entorno y secretos
- Extraer uso de `process.env.*` y crear `env.spec.json` con claves encontradas.
- No migrar secretos en texto plano — marcar para intervención humana.

## 11) Reporte final que debe generar la IA
- `migration-report.md` que incluya:
  - Resumen de cambios (mappings aplicados)
  - Lista de archivos con fallos y por qué
  - Comandos ejecutados y outputs relevantes
  - Recomendaciones manuales (refactor deeper, tests to write)

## 12) Consideraciones de código y calidad
- Preferir transformaciones AST para evitar romper imports.
- Mantener commits pequeños y atómicos por paquete o feature para revisión.
- Añadir `README.md` en la raíz de la nueva estructura explicando cómo ejecutar localmente.

## 13) Checklist final (para la IA)
- [ ] Generar `mapping.json` inicial.
- [ ] Crear rama de migración.
- [ ] Ejecutar movimientos y transformaciones AST.
- [ ] Actualizar `vite.config.js` y `package.json` scripts si aplica.
- [ ] Ejecutar `lint` y `build`.
- [ ] Generar `migration-report.md`.

---

Si necesitas, puedo:
- Generar el `mapping.json` inicial automáticamente escaneando el repo.
- Ejecutar un codemod de ejemplo para actualizar imports.

Fin de la guía.
