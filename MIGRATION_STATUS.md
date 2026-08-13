# Estado de Migración

> Fecha: 2026-06-25
> Origen: `cober360-main/frontend`
> Destino: `Cober360frontshadcn`

---

## Funcionalidades Migradas

### Autenticación
- [x] Login (login-form.tsx + login-page.tsx)
- [x] Register/Signup (signup-form.tsx + signup-page.tsx)
- [x] Forgot Password (forgot-password-form.tsx + forgot-password.tsx)
- [x] Reset Password (reset-password.tsx)
- [x] Verify Email (verify-email.tsx)
- [x] AuthContext (AuthContext.tsx) - **FIXED**: usa cober_token prefix
- [x] Protected Routes (RequireAuth.tsx)
- [x] reCAPTCHA integration (login-page.tsx)

### Vendedor
- [x] Prospectos Dashboard (prospectos-dashboard.tsx)
- [x] Prospecto Detalle (prospecto-detalle.tsx)
- [x] PolizaForm (6 pasos completo)
- [x] WhatsApp Vista
- [x] Chat Vendedor
- [x] Polizas Dashboard
- [x] Enviar Cotizacion Modal
- [x] Ley 19032 Modal
- [x] Promociones Modal
- [x] Editar Poliza Modal
- [ ] Subir Documentos Libres Modal - **FALTANTE**
- [ ] Boton Eliminar Poliza - **FALTANTE**

### Supervisor
- [x] Supervisor Dashboard (SupervisorDashboardPage.tsx)
- [x] Supervisor Polizas View
- [x] Supervisor Documentos View
- [x] Supervisor Promociones View
- [x] Supervisor Vendedores View
- [x] Metricas Vendedor View
- [x] Supervisor Cotizaciones View
- [x] Supervisor Resumen (dashboard tab incluye stats equivalentes)

### Admin
- [x] Admin Dashboard (AdminDashboardPage.tsx)
- [x] Dashboard Metricas Admin
- [x] Usuarios Admin
- [x] Vendedores Admin
- [x] Supervisores Admin
- [x] Prospectos Admin
- [x] Polizas Admin
- [x] Promociones Admin
- [x] Refritos Admin
- [x] Reasignacion Automatica Admin
- [x] Monotributo Admin
- [x] Lista Precios Admin
- [x] Prestadores Admin
- [x] Active Users Monitor
- [x] Gestion Categorias
- [x] Security Dashboard
- [x] Metricas Avanzadas
- [x] Monitoring Dashboard
- [ ] Mapa Prospectos Buenos Aires (Leaflet) - **FALTANTE**
- [ ] Mapa Coropleta - **FALTANTE**

### Backoffice
- [x] Backoffice Dashboard (BackofficeDashboardPage.tsx)
- [x] Backoffice Prospectos View
- [x] Backoffice Polizas View
- [x] Backoffice Supervisores View
- [x] Backoffice Vendedores View
- [x] Backoffice Promociones View
- [x] Backoffice Metricas View
- [x] Detalle Supervisor View

### Hooks
- [x] useUserActivity
- [x] usePageVisibility
- [x] useNavigationProtection
- [x] useHeartbeat
- [x] useEstadoFirmaPoliza
- [x] useEnviarPolizaFirma
- [x] useEliminarDocumentoFirma
- [x] useDeviceDetection
- [x] use-mobile

### Servicios / Utilidades
- [x] notificationsService (con FCM register/unregister)
- [x] nacionalidadService
- [x] refritosService
- [x] sessionExpiredManager
- [x] estadosHelper
- [x] getAuthToken / getAuthHeaders (NUEVO)

### Componentes Comunes
- [x] SessionManager
- [x] ChatWidget
- [x] ManualWidget
- [x] NotificationsInitializer
- [x] PWAStatus
- [x] RequireAuth (replaces ProtectedRoute)
- [x] ModalExportacion
- [x] DocumentPreviewModal
- [x] CargaDocumentosModal
- [x] ConfirmarDatosProspectoModal
- [x] CargarPolizaFirmadaModal
- [x] BadgeEstadoFirma
- [x] BotonConsultarFirma
- [x] BotonDescargarPolizaFirmada
- [x] BotonEnviarFirma
- [x] BotonesEliminarFirma
- [x] CargaMultipleDocumentos
- [x] PolizaDetalleSupervisor
- [x] TendenciasChart
- [x] data-table (con TanStack Table)
- [x] section-cards
- [x] chart-area-interactive
- [x] theme-provider + theme-toggle
- [ ] SubirDocumentosLibresModal - **FALTANTE**
- [ ] BotonEliminarPoliza - **FALTANTE**
- [ ] WhatsAppChat common - **FALTANTE** (cada feature lo maneja individualmente)
- [ ] PwaUpdateToast - **FALTANTE** (notificación de nueva versión PWA)
- [ ] Footer - **FALTANTE**
- [ ] AccessDenied (info detallada con rol y ruta) - **REEMPLAZADO** por /unauthorized

### Performance
- [x] Code splitting con manualChunks (react-vendor, recharts-vendor, ui-vendor)
- [x] Tailwind CSS (solo estilos usados)
- [x] useMemo/useCallback en componentes pesados
- [ ] Lazy loading de rutas con React.lazy() - **PENDIENTE**
- [ ] Image optimization para assets grandes - **PENDIENTE**

---

## Bugs Corregidos

1. ~~**Auth localStorage key**: AuthContext.tsx usaba `token` en vez de `cober_token`~~ ✅ FIXED
2. ~~**Basename faltante**: BrowserRouter sin `basename="/afiliaciones"`~~ ✅ FIXED
3. ~~**Verify Email sin token param**: falta `/:token`~~ ✅ FIXED
4. ~~**Route `/lead` vs `/formulario-lead`**: falta alias~~ ✅ FIXED
5. ~~**Route `/signup` vs `/register`**: falta alias~~ ✅ FIXED
6. ~~**Route forgot-password**: falta alias `/reset`~~ ✅ FIXED
7. ~~**Route reset-password**: falta alias `/reset-password/:token`~~ ✅ FIXED
8. ~~**Duplicate route in routes.tsx**: `/backoffice/supervisor/:id` duplicada~~ ✅ FIXED
9. ~~**reCAPTCHA no enviado en login**: ya estaba integrado~~ ✅ VERIFICADO
10. ~~**PWA SW path**: registrado en `/sw.js` en vez de `/afiliaciones/sw.js`~~ ✅ FIXED

---

## Diferencias de Comportamiento (aceptables)

1. **Navegación post-logout**: shadcn navega a `/login` en vez de `/` (compatible).
2. **Navegación post-login**: shadcn usa rutas anidadas (`/vendedor/prospectos`), main usa planas (`/prospectos-dashboard`). Ambas funcionan por los alias en routes.tsx.
3. **Auth init**: main valida token contra backend (`/auth/session-status`), shadcn solo decodifica JWT localmente. Mejora performance, menos requests.
4. **Guest routes**: shadcn no tiene GuestRoute wrapper; login-page.tsx redirige si ya autenticado via useEffect. Comportamiento equivalente.
5. **Logout toast**: main muestra Swal toast, shadcn no. Mejora UX (no molesta).
6. **Session renew**: main tiene `renewSession()`, shadcn no. El backend maneja expiración y el interceptor de axios redirige.
7. **UI**: Main usa Bootstrap + MUI, shadcn usa Tailwind + Radix. Mejora visual y performance.

---

## Próximos Pasos

1. ~~Fix CRÍTICO: Auth localStorage keys~~ ✅
2. ~~Fix CRÍTICO: Basename /afiliaciones~~ ✅
3. ~~Fix CRÍTICO: Alinear rutas~~ ✅
4. **FEAT**: Migrar SubirDocumentosLibresModal
5. **FEAT**: Migrar BotonEliminarPoliza
6. **FEAT**: Migrar PwaUpdateToast
7. **FEAT**: Migrar MapaProspectosBuenosAires y MapaCoropleta (Leaflet)
8. **PERF**: Lazy loading de rutas con React.lazy()
9. **QA**: TypeScript build verification
10. **QA**: Revisión de cada página contra main para comportamiento
11. **TEST**: Build y preview
