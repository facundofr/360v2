import * as React from "react"
import {
  Search, Phone, MessageCircle, History, Tag, Eye, Trash2, FileText,
  Inbox, WifiOff, Stethoscope, Plus, Sun, Moon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog"

import { Registro, RegistroHead, RegistroRow, RegistroAcciones } from "@/components/common/Registro"
import { Lectura, LecturaItem } from "@/components/common/Lectura"
import { EstadoVacio } from "@/components/common/EstadoVacio"
import { StatCard } from "@/components/common/StatCard"
import { getBadgeEstado } from "@/utils/estadosHelper"
import { useTheme } from "@/components/common/theme-provider"

/* ═══════════════════════════════════════════════════════════════════════════
   EL PADRÓN — la galería del sistema
   ───────────────────────────────────────────────────────────────────────────
   Referencia viva: cada primitiva de shadcn vestida con el mundo, más los tres
   componentes que el mundo agrega (registro, lectura, estado vacío).

   Modo Read: la página existe para que alguien ENTIENDA el sistema, no para
   persuadir a nadie. Por eso está estructurada para comprensión — secciones
   regladas y muestras rotuladas — y no como una grilla de tarjetas, que es
   justo la trampa a la que tiende una galería de componentes.
   ═══════════════════════════════════════════════════════════════════════════ */

const SECCIONES = [
  { id: "sellos", nombre: "Sellos" },
  { id: "botones", nombre: "Botones" },
  { id: "campos", nombre: "Campos" },
  { id: "secciones", nombre: "Secciones regladas" },
  { id: "lecturas", nombre: "Lecturas" },
  { id: "registro", nombre: "Registro" },
  { id: "modales", nombre: "Modales" },
  { id: "tablas", nombre: "Tablas" },
  { id: "navegacion", nombre: "Navegación" },
  { id: "avisos", nombre: "Avisos" },
  { id: "estados", nombre: "Estados" },
]

function Seccion({ id, titulo, bajada, children }: {
  id: string
  titulo: string
  bajada: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-8 border-t-2 border-rule-heavy pt-5 pb-2">
      <h2 className="text-[14px] leading-snug font-bold tracking-[-0.01em]">{titulo}</h2>
      <p className="mt-1 mb-2 max-w-[62ch] text-[12.5px] leading-relaxed text-muted-foreground">
        {bajada}
      </p>
      <dl className="m-0">{children}</dl>
    </section>
  )
}

function Muestra({ rotulo, nota, children }: {
  rotulo: string
  nota?: string
  children: React.ReactNode
}) {
  return (
    <div className="muestra">
      <dt>{rotulo}</dt>
      <dd>
        {children}
        {nota && <p>{nota}</p>}
      </dd>
    </div>
  )
}

export default function DesignSystemPage() {
  const { theme, setTheme } = useTheme()
  const oscuro = theme === "dark"

  return (
    <div className="mx-auto flex max-w-[1180px] gap-10 px-6 py-10">
      {/* Índice lateral: la página es larga y su trabajo es servir de referencia. */}
      <nav aria-label="Secciones" className="sticky top-8 hidden h-fit w-[168px] shrink-0 lg:block">
        <p className="mb-2 text-[10.5px] font-bold tracking-[0.09em] text-muted-foreground uppercase">
          El Padrón
        </p>
        <ul className="m-0 list-none space-y-0.5 p-0">
          {SECCIONES.map(s => (
            <li key={s.id}>
              <a
                href={"#" + s.id}
                className="block rounded-md px-2 py-1 text-[12.5px] text-muted-foreground hover:bg-paper-sunk hover:text-foreground"
              >
                {s.nombre}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <main className="min-w-0 flex-1">
        <header className="mb-8 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[21px] leading-snug font-bold tracking-[-0.025em]">
              Sistema de componentes
            </h1>
            <p className="mt-1.5 max-w-[62ch] text-[12.5px] leading-relaxed text-muted-foreground">
              Cada primitiva de shadcn vestida con El Padrón, más los tres componentes que el mundo
              agrega. Es la referencia de lo que existe: si algo no está acá, no está en el sistema.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-[30px] shrink-0"
            onClick={() => setTheme(oscuro ? "light" : "dark")}
            title={oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            aria-label={oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
          >
            {oscuro ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </header>

        {/* ── Sellos ─────────────────────────────────────────────────────── */}
        <Seccion
          id="sellos"
          titulo="Sellos"
          bajada="Un estado es un sello estampado, no una pastilla flotante. El medidor de cuatro segmentos dice el grado de carga contando, sin depender del color: el color sólo confirma lo que el conteo ya dijo."
        >
          <Muestra
            rotulo="Grados de carga"
            nota="Se lee contando segmentos. El grado 0 lleva el trazo cortado: la carga se soltó."
          >
            <Badge variant="destructive" grade={0}>Descartado</Badge>
            <Badge variant="secondary" grade={1}>Lead</Badge>
            <Badge variant="warn" grade={2}>Cotización</Badge>
            <Badge variant="firme" grade={3}>Póliza</Badge>
            <Badge variant="ok" grade={4}>Venta</Badge>
          </Muestra>

          <Muestra
            rotulo="Variantes"
            nota="La variante default es el único violeta, y por eso no la usa ningún estado: en esta app el violeta significa acción, y un estado es dato."
          >
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="firme">Firme</Badge>
            <Badge variant="ok">Ok</Badge>
            <Badge variant="warn">Warn</Badge>
            <Badge variant="risk">Risk</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </Muestra>

          <Muestra rotulo="Tamaños" nota="El chico no baja de 10.5px, que es el piso del ramp tipográfico.">
            <Badge variant="ok">Normal · 11px</Badge>
            <Badge variant="ok" size="sm">Chico · 10.5px</Badge>
          </Muestra>

          <Muestra
            rotulo="Con ícono"
            nota="Dibujado, nunca un emoji: un emoji cambia de forma según el sistema operativo y no comparte trazo con el resto."
          >
            <Badge variant="warn" size="sm"><Stethoscope aria-hidden="true" />Auditoría</Badge>
            <Badge variant="secondary" size="sm"><MessageCircle aria-hidden="true" />WhatsApp</Badge>
          </Muestra>

          <Muestra
            rotulo="Estados reales"
            nota="Los 26 estados de prospecto salen de estadosHelper y ya traen su grado."
          >
            {getBadgeEstado("Lead")}
            {getBadgeEstado("1º Contacto")}
            {getBadgeEstado("Calificado Póliza")}
            {getBadgeEstado("Póliza firmada")}
            {getBadgeEstado("Fuera de zona")}
          </Muestra>
        </Seccion>

        {/* ── Botones ────────────────────────────────────────────────────── */}
        <Seccion
          id="botones"
          titulo="Botones"
          bajada="Violeta significa acción: una acción primaria por pantalla. Todo lo demás es neutro. Si hay que preguntarse de qué color va un botón, va neutro."
        >
          <Muestra rotulo="Variantes">
            <Button>Primaria</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Destructive</Button>
          </Muestra>

          <Muestra rotulo="Tamaños">
            <Button size="sm">Chico</Button>
            <Button>Normal</Button>
            <Button size="lg">Grande</Button>
            <Button size="icon" aria-label="Agregar"><Plus className="size-4" /></Button>
          </Muestra>

          <Muestra
            rotulo="Estados"
            nota="El deshabilitado dice por qué en su title: un botón apagado sin razón es un callejón."
          >
            <Button disabled>Deshabilitado</Button>
            <Button variant="outline" disabled title="Cargá el correo para habilitar">Con razón</Button>
            <Button variant="ghost" disabled>Ghost apagado</Button>
          </Muestra>

          <Muestra rotulo="Con ícono">
            <Button><Plus className="size-4" />Nuevo asiento</Button>
            <Button variant="outline"><FileText className="size-4" />Exportar</Button>
          </Muestra>
        </Seccion>

        {/* ── Campos ─────────────────────────────────────────────────────── */}
        <Seccion
          id="campos"
          titulo="Campos"
          bajada="El foco corre el borde a violeta y agrega un halo; el error lo pone rojo y su mensaje vuelve a caja baja, porque un error es prosa y no un rótulo."
        >
          <Muestra rotulo="Texto">
            <div className="grid w-full max-w-sm gap-1.5">
              <Label htmlFor="ds-nombre">Apellido y nombre</Label>
              <Input id="ds-nombre" placeholder="Quiroga, Bruno" />
            </div>
          </Muestra>

          <Muestra rotulo="Con error">
            <div className="grid w-full max-w-sm gap-1.5">
              <Label htmlFor="ds-mail">Correo</Label>
              <Input id="ds-mail" type="email" aria-invalid defaultValue="sin-arroba" aria-describedby="ds-mail-err" />
              <p id="ds-mail-err" className="text-[11.5px] font-semibold text-state-risk-text">
                Falta el arroba. Escribilo como nombre@correo.com
              </p>
            </div>
          </Muestra>

          <Muestra rotulo="Deshabilitado">
            <Input className="max-w-sm" disabled defaultValue="40.118.552" />
          </Muestra>

          <Muestra rotulo="Búsqueda" nota="La tecla que la enfoca se anuncia en el propio campo.">
            <div className="relative w-full max-w-sm">
              <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input className="pr-9 pl-8" placeholder="Documento, apellido, teléfono…" />
              <kbd className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-xs border border-rule px-1 text-[10.5px] font-semibold text-muted-foreground">
                /
              </kbd>
            </div>
          </Muestra>

          <Muestra rotulo="Área de texto">
            <Textarea className="max-w-sm" placeholder="Qué se habló y qué quedó pendiente." />
          </Muestra>

          <Muestra rotulo="Selección">
            <Select defaultValue="1">
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1º Contacto</SelectItem>
                <SelectItem value="2">Calificado Cotización</SelectItem>
                <SelectItem value="3">Calificado Póliza</SelectItem>
              </SelectContent>
            </Select>
          </Muestra>

          <Muestra rotulo="Casilla e interruptor">
            <label className="flex items-center gap-2 text-[12.5px]">
              <Checkbox defaultChecked /> Mantener la sesión
            </label>
            <label className="flex items-center gap-2 text-[12.5px]">
              <Switch defaultChecked /> Notificaciones push
            </label>
          </Muestra>
        </Seccion>

        {/* ── Secciones regladas ─────────────────────────────────────────── */}
        <Seccion
          id="secciones"
          titulo="Secciones regladas"
          bajada="Card dejó de ser una caja con sombra: es una sección de filete de 1px, radio del sistema y cero elevación. Nada levita sobre el papel."
        >
          <Muestra rotulo="Sección">
            <Card className="w-full max-w-md">
              <CardHeader className="border-b">
                <CardTitle>Documentación de la póliza</CardTitle>
                <CardDescription>Tres de cinco documentos cargados.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <Progress value={60} />
              </CardContent>
              <CardFooter>
                <Button size="sm" variant="outline">Cargar faltantes</Button>
              </CardFooter>
            </Card>
          </Muestra>
        </Seccion>

        {/* ── Lecturas ───────────────────────────────────────────────────── */}
        <Seccion
          id="lecturas"
          titulo="Lecturas"
          bajada="Una regla horizontal continua de cifras, no seis tarjetas con hueco entre ellas. El filete se dibuja con gap, así que las divisiones aparecen también donde la grilla envuelve."
        >
          <Muestra rotulo="Regla de lectura">
            <Lectura className="w-full">
              <LecturaItem rotulo="Altas del mes" valor="38" tendencia={{ valor: 12, positiva: true }} />
              <LecturaItem rotulo="En curso" valor="61" tendencia={{ valor: 0, positiva: true }} />
              <LecturaItem rotulo="Pendientes de firma" valor="14" tendencia={{ valor: 5, positiva: false }} nota="5 vencidas" />
              <LecturaItem rotulo="Conversión" valor="9,2%" tendencia={{ valor: 1, positiva: true }} />
            </Lectura>
          </Muestra>

          <Muestra rotulo="Celda suelta" nota="StatCard, para cuando la lectura vive dentro de otra grilla.">
            <StatCard icon={FileText} label="Pólizas generadas" value="147" trend={{ value: 9, positive: true }} />
            <StatCard icon={WifiOff} label="Sin trabajar" value="312" tone="warn" trend={{ value: 48, positive: false }} />
          </Muestra>
        </Seccion>

        {/* ── Registro ───────────────────────────────────────────────────── */}
        <Seccion
          id="registro"
          titulo="Registro"
          bajada="Una fila por persona, el documento como eje. Las acciones aparecen en la fila enfocada; en pantalla táctil se muestran siempre, porque ahí no hay hover."
        >
          <Muestra rotulo="Registro">
            <Registro variante="demo" className="w-full">
              <RegistroHead>
                <span>Documento</span>
                <span>Apellido y nombre</span>
                <span>Estado</span>
                <span />
              </RegistroHead>

              {[
                { dni: "40.118.552", ap: "Quiroga", no: "Bruno Ezequiel", estado: "Lead" },
                { dni: "35.612.788", ap: "Sosa Bravo", no: "Julieta", estado: "1º Contacto" },
                { dni: "37.902.145", ap: "Godoy", no: "Ana Laura", estado: "Calificado Póliza" },
              ].map(p => (
                <RegistroRow key={p.dni}>
                  <span className="text-[13.5px] font-semibold tabular-nums">{p.dni}</span>
                  <span className="truncate text-[13px]">
                    <b className="font-semibold">{p.ap}</b>
                    <span className="text-muted-foreground">, {p.no}</span>
                  </span>
                  <span className="min-w-0">{getBadgeEstado(p.estado)}</span>
                  <RegistroAcciones>
                    <Tooltip><TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="size-7"><Phone className="size-3.5" /></Button>
                    </TooltipTrigger><TooltipContent>Registrar llamada</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="size-7"><History className="size-3.5" /></Button>
                    </TooltipTrigger><TooltipContent>Historial</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="size-7"><Tag className="size-3.5" /></Button>
                    </TooltipTrigger><TooltipContent>Promociones</TooltipContent></Tooltip>
                  </RegistroAcciones>
                </RegistroRow>
              ))}

              <RegistroRow atenuada>
                <span className="text-[13.5px] font-semibold tabular-nums">18.442.309</span>
                <span className="truncate text-[13px]">
                  <b className="font-semibold">Domínguez</b>
                  <span className="text-muted-foreground">, Raúl</span>
                </span>
                <span className="min-w-0">{getBadgeEstado("Fuera de edad")}</span>
                <RegistroAcciones>
                  <Tooltip><TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="size-7"><Eye className="size-3.5" /></Button>
                  </TooltipTrigger><TooltipContent>Ver detalle</TooltipContent></Tooltip>
                </RegistroAcciones>
              </RegistroRow>
            </Registro>
          </Muestra>

          <Muestra
            rotulo="Cargando"
            nota="El esqueleto toma la forma de la fila: lo que se carga es un registro, no una tarjeta."
          >
            <Registro variante="demo" className="w-full" aria-busy>
              <RegistroHead>
                <span>Documento</span>
                <span>Apellido y nombre</span>
                <span>Estado</span>
                <span />
              </RegistroHead>
              {[0, 1, 2].map(i => (
                <div key={i} className="reg-row">
                  <Skeleton className="h-3.5 w-20 rounded-xs" />
                  <Skeleton className="h-3.5 w-40 rounded-xs" />
                  <Skeleton className="h-[22px] w-24 rounded-stamp" />
                  <span />
                </div>
              ))}
            </Registro>
          </Muestra>
        </Seccion>

        {/* ── Modales ────────────────────────────────────────────────────── */}
        <Seccion
          id="modales"
          titulo="Modales"
          bajada="Un modal se gana su interrupción: sólo para tareas que necesitan foco protegido. Entra con un solo movimiento autorado — sube seis píxeles y aparece, sin zoom ni blur decorativo."
        >
          <Muestra rotulo="Formulario">
            <Dialog>
              <DialogTrigger asChild><Button variant="outline">Registrar contacto</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Registrar contacto</DialogTitle>
                  <DialogDescription>Sosa Bravo, Julieta · DNI 35.612.788</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3.5">
                  <div className="grid gap-1.5">
                    <Label htmlFor="ds-via">Vía</Label>
                    <Select defaultValue="tel">
                      <SelectTrigger id="ds-via"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tel">Llamada telefónica</SelectItem>
                        <SelectItem value="wa">WhatsApp</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="ds-com">Comentario</Label>
                    <Textarea id="ds-com" placeholder="Qué se habló y qué quedó pendiente." />
                    <p className="text-[11.5px] text-muted-foreground">
                      Queda en el historial. No se imprime en la póliza.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                  <Button>Guardar contacto</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Muestra>

          <Muestra
            rotulo="Acción bloqueada"
            nota="La acción primaria queda apagada y el aviso dice qué falta para habilitarla."
          >
            <Dialog>
              <DialogTrigger asChild><Button variant="outline">Enviar cotización</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enviar cotización</DialogTitle>
                  <DialogDescription>Maidana, Ricardo Omar · 45 años</DialogDescription>
                </DialogHeader>
                <Alert variant="destructive">
                  <AlertDescription>
                    <b className="block">Falta el correo del prospecto.</b>
                    Sin correo la cotización sólo puede salir por WhatsApp. Cargalo para habilitar el
                    envío por mail.
                  </AlertDescription>
                </Alert>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                  <Button variant="outline" disabled title="Cargá el correo para habilitar">
                    Enviar por mail
                  </Button>
                  <Button><MessageCircle className="size-4" />Enviar por WhatsApp</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Muestra>

          <Muestra
            rotulo="Confirmación destructiva"
            nota="Lo irreversible se confirma con AlertDialog, que no se cierra con Escape ni con click afuera."
          >
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive"><Trash2 className="size-4" />Eliminar póliza</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar la póliza P-24881</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se borra la póliza y sus documentos cargados. La declaración jurada firmada no se
                    recupera: hay que rehacerla desde cero.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction>Eliminar póliza</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Muestra>
        </Seccion>

        {/* ── Tablas ─────────────────────────────────────────────────────── */}
        <Seccion
          id="tablas"
          titulo="Tablas"
          bajada="Misma gramática que el registro: encabezado con voz de rótulo administrativo, filete firme debajo, hairline entre filas y cero zebra. Para datos ya tabulares que no necesitan acciones por fila."
        >
          <Muestra rotulo="Tabla">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Cartera</TableHead>
                  <TableHead className="text-right">Altas</TableHead>
                  <TableHead>Turno</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-semibold">Fernández, Mariela</TableCell>
                  <TableCell className="text-right">412</TableCell>
                  <TableCell className="text-right">9</TableCell>
                  <TableCell><Badge variant="ok" size="sm">En línea</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-semibold">Ojeda, Cristian</TableCell>
                  <TableCell className="text-right">355</TableCell>
                  <TableCell className="text-right">3</TableCell>
                  <TableCell><Badge variant="warn" size="sm">Inactivo 2 h</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-semibold">Sánchez, Gabriela</TableCell>
                  <TableCell className="text-right">377</TableCell>
                  <TableCell className="text-right">8</TableCell>
                  <TableCell><Badge variant="secondary" size="sm">Franco</Badge></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Muestra>
        </Seccion>

        {/* ── Navegación ─────────────────────────────────────────────────── */}
        <Seccion
          id="navegacion"
          titulo="Navegación"
          bajada="Las pestañas cambian de vista sin cambiar de página; el acordeón guarda lo que no hace falta ver de entrada. Ninguno de los dos reemplaza a una ruta."
        >
          <Muestra rotulo="Pestañas">
            <Tabs defaultValue="reg" className="w-full max-w-lg">
              <TabsList>
                <TabsTrigger value="reg">Registro</TabsTrigger>
                <TabsTrigger value="met">Métricas</TabsTrigger>
                <TabsTrigger value="doc">Documentos</TabsTrigger>
              </TabsList>
              <TabsContent value="reg" className="pt-3 text-[12.5px] text-muted-foreground">
                412 asientos en la cartera.
              </TabsContent>
              <TabsContent value="met" className="pt-3 text-[12.5px] text-muted-foreground">
                Conversión del 9,2% en septiembre.
              </TabsContent>
              <TabsContent value="doc" className="pt-3 text-[12.5px] text-muted-foreground">
                38 documentos cargados.
              </TabsContent>
            </Tabs>
          </Muestra>

          <Muestra rotulo="Acordeón">
            <Accordion type="single" collapsible className="w-full max-w-lg">
              <AccordionItem value="a">
                <AccordionTrigger>¿Qué se imprime en la declaración jurada?</AccordionTrigger>
                <AccordionContent>
                  Las preguntas de salud, la lista de patologías y los datos de cada integrante, tal
                  como se cargaron en el alta.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="b">
                <AccordionTrigger>¿Cuándo caduca una cotización?</AccordionTrigger>
                <AccordionContent>
                  A los 15 días. Pasado ese plazo hay que rehacer la declaración jurada.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Muestra>
        </Seccion>

        {/* ── Avisos ─────────────────────────────────────────────────────── */}
        <Seccion
          id="avisos"
          titulo="Avisos"
          bajada="Un aviso nombra el problema y la salida. El color confirma la gravedad, pero el texto tiene que funcionar sin el color."
        >
          <Muestra rotulo="Informativo">
            <Alert className="max-w-lg">
              <AlertDescription>
                <b className="block">La cotización viaja por WhatsApp.</b>
                El PDF es público a propósito, para que el afiliado pueda abrirlo sin cuenta.
              </AlertDescription>
            </Alert>
          </Muestra>

          <Muestra rotulo="Destructivo">
            <Alert variant="destructive" className="max-w-lg">
              <AlertDescription>
                <b className="block">5 pólizas llevan más de 7 días esperando firma.</b>
                Pasado el día 15 la cotización caduca y hay que rehacer la declaración jurada.
              </AlertDescription>
            </Alert>
          </Muestra>

          <Muestra rotulo="Progreso">
            <Progress value={60} className="max-w-sm" />
          </Muestra>

          <Muestra rotulo="Esqueleto" nota="Toma la forma de lo que viene, no la de un rectángulo genérico.">
            <div className="grid w-full max-w-sm gap-2">
              <Skeleton className="h-3.5 w-40 rounded-xs" />
              <Skeleton className="h-3 w-56 rounded-xs" />
              <Skeleton className="h-[22px] w-28 rounded-stamp" />
            </div>
          </Muestra>

          <Muestra rotulo="Separador">
            <div className="w-full max-w-sm"><Separator /></div>
          </Muestra>
        </Seccion>

        {/* ── Estados ────────────────────────────────────────────────────── */}
        <Seccion
          id="estados"
          titulo="Estados"
          bajada="Un vacío dice tres cosas en orden: qué no hay, por qué, y qué se puede hacer al respecto. Un vacío sin salida es un callejón."
        >
          <Muestra rotulo="Sin resultados">
            <div className="w-full rounded-lg border border-rule">
              <EstadoVacio
                icono={Search}
                titulo="Sin resultados"
                descripcion="Ningún asiento coincide con el documento, apellido o teléfono buscado."
                accion={<Button size="sm" variant="outline">Limpiar filtros</Button>}
              />
            </div>
          </Muestra>

          <Muestra rotulo="Nada pendiente" nota="Un vacío que es buena noticia no necesita botón.">
            <div className="w-full rounded-lg border border-rule">
              <EstadoVacio
                icono={Inbox}
                titulo="Sin reclamos"
                descripcion="Ningún afiliado del equipo tiene un reclamo abierto en los últimos 30 días."
              />
            </div>
          </Muestra>

          <Muestra rotulo="Compacto" nota="Para vacíos dentro de un panel angosto o una celda.">
            <div className="w-full max-w-xs rounded-lg border border-rule">
              <EstadoVacio
                compacto
                icono={FileText}
                titulo="Sin documentos"
                descripcion="Todavía no se cargó ninguno."
              />
            </div>
          </Muestra>
        </Seccion>
      </main>
    </div>
  )
}
