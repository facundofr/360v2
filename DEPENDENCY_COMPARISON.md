# Comparación de dependencias — frontend vs cober360vite

Fecha: 27/03/2026

Resumen: este documento lista las dependencias y devDependencies de ambos proyectos, las comunes y las exclusivas.

---

## 1) `frontend` (origen) — dependencias

- @chatscope/chat-ui-kit-react: ^2.1.1
- @emotion/react: ^11.14.0
- @emotion/styled: ^11.14.0
- @fortawesome/fontawesome-free: ^6.7.2
- @mui/icons-material: ^7.1.0
- @mui/material: ^7.1.0
- @mui/x-charts: ^8.11.2
- @mui/x-data-grid: ^8.3.0
- axios: ^1.9.0
- bootstrap: ^5.3.6
- chart.js: ^4.5.0
- firebase: ^12.4.0
- js-cookie: ^3.0.5
- jwt-decode: ^4.0.0
- lucide-react: ^0.543.0
- react: ^19.0.0
- react-bootstrap: ^2.10.10
- react-bootstrap-icons: ^1.11.6
- react-chartjs-2: ^5.3.0
- react-dom: ^19.0.0
- react-google-recaptcha: ^3.1.0
- react-google-recaptcha-v3: ^1.11.0
- react-icons: ^5.5.0
- react-pdf: ^10.0.1
- react-router-dom: ^7.4.1
- recharts: ^2.15.4
- socket.io-client: ^4.8.1
- styled-components: ^6.1.19
- sweetalert2: ^11.6.13

### devDependencies (`frontend`)
- @eslint/js: ^9.21.0
- @types/react: ^19.0.10
- @types/react-dom: ^19.0.4
- @vitejs/plugin-react: ^4.3.4
- eslint: ^9.21.0
- eslint-plugin-react-hooks: ^5.1.0
- eslint-plugin-react-refresh: ^0.4.19
- globals: ^15.15.0
- sass: ^1.89.2
- sharp: ^0.34.3
- vite: ^6.2.0

---

## 2) `cober360vite` (destino) — dependencias

- @dnd-kit/core: ^6.3.1
- @dnd-kit/modifiers: ^9.0.0
- @dnd-kit/sortable: ^10.0.0
- @dnd-kit/utilities: ^3.2.2
- @fontsource-variable/inter: ^5.2.8
- @tailwindcss/vite: ^4.1.17
- @tanstack/react-table: ^8.21.3
- axios: ^1.13.6
- class-variance-authority: ^0.7.1
- clsx: ^2.1.1
- lucide-react: ^0.577.0
- next-themes: ^0.4.6
- radix-ui: ^1.4.3
- react: ^19.2.0
- react-dom: ^19.2.0
- react-router-dom: ^7.13.1
- recharts: 2.15.4
- shadcn: ^4.0.6
- socket.io-client: ^4.8.3
- sonner: ^2.0.7
- tailwind-merge: ^3.5.0
- tailwindcss: ^4.1.17
- tw-animate-css: ^1.4.0
- vaul: ^1.1.2
- zod: ^4.3.6

### devDependencies (`cober360vite`)
- @eslint/js: ^9.39.1
- @types/node: ^24.10.1
- @types/react: ^19.2.5
- @types/react-dom: ^19.2.3
- @vitejs/plugin-react: ^5.1.1
- eslint: ^9.39.1
- eslint-plugin-react-hooks: ^7.0.1
- eslint-plugin-react-refresh: ^0.4.24
- globals: ^16.5.0
- prettier: ^3.8.1
- prettier-plugin-tailwindcss: ^0.7.2
- typescript: ~5.9.3
- typescript-eslint: ^8.46.4
- vite: ^7.2.4

---

## 3) Dependencias comunes (aparecen en ambos)

- axios
- lucide-react
- react
- react-dom
- react-router-dom
- recharts
- socket.io-client

(Nota: versiones pueden diferir ligeramente — ver listas arriba.)

---

## 4) Exclusivas del `frontend` (posible UI/estilos o no necesarias en destino)

- @chatscope/chat-ui-kit-react
- @emotion/react
- @emotion/styled
- @fortawesome/fontawesome-free
- @mui/* (icons-material, material, x-charts, x-data-grid)
- bootstrap, react-bootstrap, react-bootstrap-icons
- chart.js, react-chartjs-2
- js-cookie, jwt-decode
- react-google-recaptcha (v2), react-google-recaptcha-v3
- react-icons
- react-pdf
- styled-components
- sweetalert2
- sharp (dev), sass (dev)

> Muchas de estas son librerías de UI/estilos que en `cober360vite` se reemplazan por `shadcn` + `tailwind`. Solo algunas (como `firebase` o `reCAPTCHA`) son funcionales y pueden necesitar ser migradas.

---

## 5) Exclusivas de `cober360vite` (funcionalidades/plataforma)

- @dnd-kit/* (drag & drop)
- @tailwindcss/vite, tailwindcss, tailwind-merge, tw-animate-css
- @tanstack/react-table
- class-variance-authority, clsx
- next-themes
- radix-ui
- shadcn, sonner
- vaul
- zod
- prettier & plugins, typescript, typescript-eslint

---

## 6) Acciones tomadas / recomendaciones

- Instalé en `cober360vite` las dos dependencias funcionales requeridas del `frontend`: `firebase` y `react-google-recaptcha-v3`.

- Recomendación: evitar traer librerías UI del `frontend` (MUI, Bootstrap, styled-components) porque `cober360vite` utiliza `shadcn` + Tailwind. Traer solo utilidades no-UI que realmente se usen en código compartido.

- Si quieres que traiga utilidades específicas no-UI (por ejemplo `js-cookie`, `jwt-decode`, `react-pdf`), indícame cuáles y las instalo.

---

## 7) Archivo generado por el agente
- Archivo creado: `DEPENDENCY_COMPARISON.md` (este archivo)

---

Si quieres que genere un `package.json` combinado sugerido o ejecute instalaciones adicionales, dime qué dependencias no-UI quieres incluir y las instalo.