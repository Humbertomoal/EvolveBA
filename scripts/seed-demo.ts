/**
 * Datos dummy para el Tablero de Indicadores — 12 proveedores + 48 licitaciones
 * repartidas en 12 meses, coherentes entre sí, para que TODOS los indicadores
 * (Grupos 1, 2 y 3) se vean poblados en una demo comercial.
 *
 * Correr:
 *   npx tsx scripts/seed-demo.ts            → DRY RUN (no escribe nada)
 *   npx tsx scripts/seed-demo.ts --apply    → escribe (pide confirmación)
 *   npx tsx scripts/seed-demo.ts --apply --yes  → escribe sin preguntar
 *
 * Limpieza:  npx tsx scripts/limpiar-demo.ts --apply
 *
 * ── Garantías ──────────────────────────────────────────────────────────────
 * · SOLO hace `create`. No hay una sola llamada a update/delete/upsert sobre
 *   datos existentes: no existe ruta de código que pueda tocar una fila real.
 * · No crea productos, roles ni catálogos: usa los que ya están.
 * · DETERMINISTA: PRNG con semilla fija, cero Math.random(). Dos corridas
 *   producen exactamente los mismos datos (salvo las fechas, que son relativas
 *   al día en que se corre — a propósito, para que la demo siempre luzca
 *   "reciente").
 * · IDEMPOTENTE: si ya hay licitaciones DMY-, aborta y pide limpiar primero.
 * · Transacción POR LICITACIÓN, no global: 48 licitaciones con sus hijos son
 *   miles de filas y una transacción interactiva única se arriesga a timeout.
 *   Si truena a la mitad, limpiar-demo.ts deja todo como estaba.
 */
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from ".prisma/client/default";
import {
  CLIENTE_ID,
  PASSWORD_DEMO,
  PREFIJO_LICITACION,
  PREFIJO_ORDEN,
  PREFIJO_RAZON_SOCIAL,
  PREFIJO_RFC,
  correoContactoProveedor,
  correoLoginProveedor,
} from "./demo-marcadores";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const APLICAR = process.argv.includes("--apply");
const SIN_PREGUNTAR = process.argv.includes("--yes");

// ── PRNG determinista ────────────────────────────────────────────────────────
// mulberry32 con semilla fija. Nunca Math.random(): si hay que regenerar tras
// un ajuste, deben salir exactamente los mismos datos.
const SEMILLA = 20260805;
function mulberry32(semilla: number) {
  let a = semilla;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEMILLA);

const entre = (min: number, max: number) => min + rnd() * (max - min);
const entero = (min: number, max: number) => Math.floor(entre(min, max + 1));
const chance = (p: number) => rnd() < p;
const elegir = <T>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)];
function elegirVarios<T>(xs: T[], n: number): T[] {
  const copia = [...xs];
  const out: T[] = [];
  while (out.length < n && copia.length > 0) {
    out.push(copia.splice(Math.floor(rnd() * copia.length), 1)[0]);
  }
  return out;
}
const redondear = (n: number, dec = 2) => Math.round(n * 10 ** dec) / 10 ** dec;

// ── Fechas ───────────────────────────────────────────────────────────────────
const DIA_MS = 86_400_000;
const masDias = (d: Date, dias: number) => new Date(d.getTime() + dias * DIA_MS);
const masHoras = (d: Date, h: number) => new Date(d.getTime() + h * 3_600_000);

const HOY = new Date();

/** Rango [inicio, fin] del mes calendario `offset` meses atrás (0 = mes actual). */
function mesCalendario(offset: number): { inicio: Date; fin: Date } {
  const inicio = new Date(HOY.getFullYear(), HOY.getMonth() - offset, 1, 0, 0, 0);
  const fin = new Date(HOY.getFullYear(), HOY.getMonth() - offset + 1, 0, 23, 59, 59);
  return { inicio, fin };
}

/** Fecha aleatoria dentro de un mes calendario, sin pasarse de hoy. */
function fechaEnMes(offset: number): Date {
  const { inicio, fin } = mesCalendario(offset);
  const tope = Math.min(fin.getTime(), HOY.getTime() - DIA_MS);
  const desde = inicio.getTime();
  if (tope <= desde) return new Date(desde);
  return new Date(desde + rnd() * (tope - desde));
}

// ── Catálogo de proveedores dummy ────────────────────────────────────────────
const NOMBRES_PROVEEDOR = [
  "Solaris del Norte",
  "Fotovoltaica Peninsular",
  "Enerlink Industrial",
  "Grupo Voltaico del Sureste",
  "Suministros Helios",
  "Conductores y Charolas MX",
  "Inversores del Pacífico",
  "TecnoSolar Integradores",
  "Estructuras Andamio Solar",
  "Distribuidora Fotón",
  "Cablesa Energía",
  "Componentes Solares del Bajío",
];
const SUFIJOS = ["SA de CV", "S de RL de CV", "SAPI de CV"];
const CIUDADES = [
  "Cancún, Q. Roo",
  "Mérida, Yuc.",
  "Monterrey, N.L.",
  "Guadalajara, Jal.",
  "Querétaro, Qro.",
  "Puebla, Pue.",
  "CDMX",
  "León, Gto.",
];
const NOMBRES_PILA = [
  "Ana", "Luis", "Carmen", "Jorge", "Patricia", "Ricardo",
  "Mónica", "Fernando", "Alejandra", "Héctor", "Rosa", "Miguel",
];
const APELLIDOS = [
  "Ramírez", "Delgado", "Cordero", "Vázquez", "Peña", "Solís",
  "Ibarra", "Montes", "Cabrera", "Zamora", "Rentería", "Aguilar",
];

/** Precio base por familia, en MXN. El schema no guarda precio de lista, así
 *  que se inventa uno verosímil por familia y se fija por producto. */
const RANGO_PRECIO: Record<string, [number, number]> = {
  "Panales Solares": [2500, 4500],
  Inversores: [15000, 85000],
  Estructura: [800, 3500],
  Canalización: [45, 650],
  "Sistema de Charola Portacables": [200, 1800],
  "Material Eléctrico de Corriente Directa": [80, 2200],
  "Material Eléctrico de Corriente Alterna": [90, 2400],
  "Material Consumible para Instalación de SFV": [25, 400],
  "Servicios Profesionales": [8000, 45000],
};
const RANGO_DEFAULT: [number, number] = [100, 1500];

// ── Plan de las 48 licitaciones ──────────────────────────────────────────────
// El tipo describe QUÉ debe poblar cada licitación; las fechas se derivan de
// `mesCierre` para que las gráficas mensuales tengan puntos en los 12 meses.
type EstadoDemo =
  | "Finalizada"
  | "Cerrada"
  | "Esperando Validación"
  | "EnProcesoDecision" // En Proceso + esperandoDecision = true
  | "EnProceso" // En Proceso + esperandoDecision = false
  | "Programada"
  | "Borrador"
  | "Cancelada";

type PlanLicitacion = {
  estado: EstadoDemo;
  /** Meses hacia atrás donde cae el cierre/creación (0 = mes actual). */
  mes: number;
  /** Solo Finalizada: qué hacer con su orden de compra. */
  oc?: "pendiente" | "entregada" | "ninguna";
};

function construirPlan(): PlanLicitacion[] {
  const plan: PlanLicitacion[] = [];

  // 22 Finalizadas repartidas en 12 meses. 6 con OC Pendiente ("sin OC
  // enviada"), 12 Entregada/Recibida (on-time), 4 sin OC.
  const mesesFin = [11, 10, 10, 9, 8, 8, 7, 6, 6, 5, 4, 4, 3, 3, 2, 2, 1, 1, 1, 1, 0, 0];
  const ocFin: PlanLicitacion["oc"][] = [
    "entregada", "entregada", "entregada", "entregada", "entregada", "entregada",
    "entregada", "entregada", "entregada", "entregada", "entregada", "entregada",
    "pendiente", "pendiente", "pendiente", "pendiente", "pendiente", "pendiente",
    "ninguna", "ninguna", "ninguna", "ninguna",
  ];
  mesesFin.forEach((mes, i) => plan.push({ estado: "Finalizada", mes, oc: ocFin[i] }));

  // En Cierre/Selección — en vuelo, así que meses recientes.
  // 2 de las Cerradas caen en el mes anterior para reforzar esa ventana.
  [1, 1, 0, 0, 2].forEach((mes) => plan.push({ estado: "Cerrada", mes }));
  [0, 1, 2].forEach((mes) => plan.push({ estado: "Esperando Validación", mes }));
  [0, 0, 1].forEach((mes) => plan.push({ estado: "EnProcesoDecision", mes }));

  // En Licitación / Por Lanzar / En Construcción — abiertas, muy recientes.
  [0, 0, 0, 1, 1].forEach((mes) => plan.push({ estado: "EnProceso", mes }));
  [0, 0, 1, 1].forEach((mes) => plan.push({ estado: "Programada", mes }));
  [0, 0, 1].forEach((mes) => plan.push({ estado: "Borrador", mes }));

  // Canceladas repartidas.
  [9, 5, 2].forEach((mes) => plan.push({ estado: "Cancelada", mes }));

  return plan;
}

// ── Utilidades de dominio ────────────────────────────────────────────────────

type ProductoDemo = {
  id: string;
  codigo: string;
  nombre: string;
  familia: string | null;
  unidadMedida: string;
  precioBaseMXN: number;
};

/** Tipo de cambio congelado, con deriva mensual verosímil (17.20 → 18.60). */
function tipoCambioDelMes(mesesAtras: number): number {
  const base = 18.6 - (mesesAtras / 11) * 1.4;
  return redondear(base + entre(-0.15, 0.15), 2);
}

type EntradaLog = { estadoAnterior: string | null; estadoNuevo: string; at: Date };

/**
 * Cadena de estados coherente: `at` creciente y `estadoAnterior` encadenado.
 * El ÚLTIMO registro siempre corresponde al estado actual de la licitación —
 * de eso depende `entradaAlEstadoActual()` del Grupo 2.
 */
function construirCadena(
  estado: EstadoDemo,
  fechas: {
    creacion: Date;
    lanzamiento: Date | null;
    inicio: Date | null;
    decision: Date | null;
    reapertura: Date | null;
    decision2: Date | null;
    cerrada: Date | null;
    validacion: Date | null;
    finalizada: Date | null;
    cancelada: Date | null;
  }
): EntradaLog[] {
  const pasos: { estadoNuevo: string; at: Date }[] = [
    { estadoNuevo: "Borrador", at: fechas.creacion },
  ];
  if (fechas.lanzamiento) pasos.push({ estadoNuevo: "Programada", at: fechas.lanzamiento });
  if (fechas.inicio) pasos.push({ estadoNuevo: "En Proceso", at: fechas.inicio });
  if (fechas.decision)
    pasos.push({ estadoNuevo: "Esperando Decisión", at: fechas.decision });
  // Ronda extra: el ciclo Esperando Decisión → En Proceso → Esperando Decisión.
  // Es lo que ejercita la suma-por-licitación del tiempo por etapa.
  if (fechas.reapertura) pasos.push({ estadoNuevo: "En Proceso", at: fechas.reapertura });
  if (fechas.decision2)
    pasos.push({ estadoNuevo: "Esperando Decisión", at: fechas.decision2 });
  if (fechas.cerrada) pasos.push({ estadoNuevo: "Cerrada", at: fechas.cerrada });
  if (fechas.validacion)
    pasos.push({ estadoNuevo: "Esperando Validación", at: fechas.validacion });
  if (fechas.finalizada) pasos.push({ estadoNuevo: "Finalizada", at: fechas.finalizada });
  if (fechas.cancelada) pasos.push({ estadoNuevo: "Cancelada", at: fechas.cancelada });

  void estado;
  return pasos.map((p, i) => ({
    estadoAnterior: i === 0 ? null : pasos[i - 1].estadoNuevo,
    estadoNuevo: p.estadoNuevo,
    at: p.at,
  }));
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n══════════ SEED DEMO — Tablero de Indicadores ══════════");
  console.log(APLICAR ? "MODO: --apply (ESCRIBE en la base)" : "MODO: DRY RUN (no escribe nada)");

  // ── Idempotencia ──────────────────────────────────────────────────────────
  const yaExisten = await prisma.licitacion.count({
    where: { numero: { startsWith: PREFIJO_LICITACION } },
  });
  if (yaExisten > 0) {
    console.error(
      `\n✗ Ya existen ${yaExisten} licitaciones ${PREFIJO_LICITACION}… en la base.\n` +
        `  Corre primero:  npx tsx scripts/limpiar-demo.ts --apply\n`
    );
    process.exitCode = 1;
    return;
  }

  // ── Inventario de lo real (se imprime y NO se toca) ───────────────────────
  const [provReales, licReales, ocReales, productos, usuariosReales, rolProveedor, compradores] =
    await Promise.all([
      prisma.proveedor.findMany({
        select: { razonSocial: true, rfc: true },
        orderBy: { razonSocial: "asc" },
      }),
      prisma.licitacion.findMany({ select: { numero: true }, orderBy: { numero: "asc" } }),
      prisma.ordenCompra.findMany({ select: { numero: true }, orderBy: { numero: "asc" } }),
      // No se filtra por unidadMedida: los 5 productos con unidad vacía del
      // catálogo son justamente los 2 paneles solares y 3 inversores — los
      // protagonistas de una demo fotovoltaica. El tablero ya tolera la unidad
      // vacía (ver GraficaRankingUnitario).
      prisma.producto.findMany({
        where: { eliminado: false, activo: true },
        select: { id: true, codigo: true, nombre: true, familia: true, unidadMedida: true },
        orderBy: { codigo: "asc" },
      }),
      prisma.usuario.count(),
      prisma.rol.findFirst({ where: { nombre: "Proveedor", clienteId: CLIENTE_ID } }),
      prisma.licitacion.findMany({ select: { compradorId: true }, distinct: ["compradorId"] }),
    ]);

  if (!rolProveedor) {
    console.error("✗ No existe el rol 'Proveedor' — no se pueden crear usuarios de demo.");
    process.exitCode = 1;
    return;
  }
  if (productos.length < 20) {
    console.error(`✗ Solo hay ${productos.length} productos usables; se esperaban ~69.`);
    process.exitCode = 1;
    return;
  }
  const compradorId = compradores[0]?.compradorId;
  if (!compradorId) {
    console.error("✗ No se pudo determinar un compradorId de las licitaciones existentes.");
    process.exitCode = 1;
    return;
  }

  console.log("\n── DATOS REALES QUE NO SE TOCAN ──");
  console.log(`Proveedores reales (${provReales.length}):`);
  provReales.forEach((p) => console.log(`   · ${p.razonSocial.padEnd(45)} ${p.rfc}`));
  console.log(`Licitaciones reales (${licReales.length}): ${licReales.map((l) => l.numero).join(", ")}`);
  console.log(`Órdenes de compra reales (${ocReales.length}): ${ocReales.map((o) => o.numero).join(", ")}`);
  console.log(
    `Productos (${productos.length} usables) · Usuarios (${usuariosReales}) · Roles · Catálogos` +
      `  →  NO se crean ni se modifican`
  );
  console.log("Este script SOLO ejecuta create(). No hay update/delete sobre datos existentes.");

  // ── Precio base por producto (determinista) ───────────────────────────────
  const productosDemo: ProductoDemo[] = productos.map((p) => {
    const [min, max] = RANGO_PRECIO[p.familia ?? ""] ?? RANGO_DEFAULT;
    return { ...p, precioBaseMXN: redondear(entre(min, max), 2) };
  });

  // 4 productos recurrentes: sin esto, el producto "más comprado" aparece en 2-3
  // meses y la gráfica de VARIACIÓN DE PRECIOS (Grupo 3 #5) sale con dos puntos.
  const recurrentes = [
    productosDemo.find((p) => p.familia === "Panales Solares"),
    productosDemo.find((p) => p.familia === "Inversores"),
    productosDemo.find((p) => p.familia === "Sistema de Charola Portacables"),
    productosDemo.find((p) => p.familia === "Canalización"),
  ].filter((p): p is ProductoDemo => Boolean(p));

  const plan = construirPlan();

  console.log("\n── LO QUE SE VA A CREAR ──");
  console.log(`Proveedores dummy:  12   ${PREFIJO_RAZON_SOCIAL}…  (RFC ${PREFIJO_RFC}…)`);
  console.log(`Usuarios de portal: 12   ${correoLoginProveedor(1)} … (contraseña única)`);
  console.log(`Licitaciones:       ${plan.length}   ${PREFIJO_LICITACION}0001 … ${PREFIJO_LICITACION}${String(plan.length).padStart(4, "0")}`);
  const resumenEstados = plan.reduce<Record<string, number>>((acc, p) => {
    acc[p.estado] = (acc[p.estado] ?? 0) + 1;
    return acc;
  }, {});
  console.log("Por estado:", resumenEstados);
  console.log(`Productos recurrentes (para la gráfica de variación): ${recurrentes.map((r) => r.codigo).join(", ")}`);

  if (!APLICAR) {
    console.log("\nDRY RUN — no se escribió nada. Repite con --apply para aplicar.\n");
    return;
  }

  if (!SIN_PREGUNTAR) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const resp = await rl.question("\n¿Aplicar estos cambios? Escribe SI para continuar: ");
    rl.close();
    if (resp.trim().toUpperCase() !== "SI") {
      console.log("Cancelado. No se escribió nada.\n");
      return;
    }
  }

  // ── 1. Proveedores + usuarios ─────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(PASSWORD_DEMO, 10);
  const proveedoresIds: string[] = [];

  for (let i = 1; i <= 12; i++) {
    const nombre = NOMBRES_PROVEEDOR[i - 1];
    const razonSocial = `${PREFIJO_RAZON_SOCIAL}${nombre} ${elegir(SUFIJOS)}`;
    const pila = NOMBRES_PILA[i - 1];
    const apellido = APELLIDOS[i - 1];

    // primerAcceso: false — el default del schema es true y el proxy mandaría a
    // /cambiar-password en el primer login, que en una demo en vivo estorba.
    const usuario = await prisma.usuario.create({
      data: {
        nombre: pila,
        apellido,
        email: correoLoginProveedor(i),
        password: passwordHash,
        activo: true,
        rolId: rolProveedor.id,
        clienteId: CLIENTE_ID,
        tipoUsuario: "proveedor",
        primerAcceso: false,
        emailVerificado: true,
      },
    });

    const proveedor = await prisma.proveedor.create({
      data: {
        razonSocial,
        vendedorNombre: `${pila} ${apellido}`,
        vendedorCelular: `99${entero(10000000, 99999999)}`,
        vendedorCorreo: correoContactoProveedor(i),
        contactoAdminNombre: `${elegir(NOMBRES_PILA)} ${elegir(APELLIDOS)}`,
        contactoAdminTelefono: `99${entero(10000000, 99999999)}`,
        contactoAdminCorreo: correoContactoProveedor(i),
        tipoPersona: chance(0.75) ? "Moral" : "Física",
        rfc: `${PREFIJO_RFC}${String(i).padStart(2, "0")}${entero(100000, 999999)}`,
        domicilio: `Av. Solar ${entero(100, 999)}, ${elegir(CIUDADES)}`,
        familiasAsignadas: JSON.stringify(
          elegirVarios(Object.keys(RANGO_PRECIO), entero(3, 6))
        ),
        catalogoValidado: chance(0.7),
        estado: "Activo",
        clienteId: CLIENTE_ID,
        usuarioId: usuario.id,
      },
    });
    proveedoresIds.push(proveedor.id);
  }
  console.log(`\n✓ 12 proveedores + 12 usuarios de portal creados`);

  // ── 2. Licitaciones ───────────────────────────────────────────────────────
  let numOrden = 0;
  const conteo = {
    licitaciones: 0,
    items: 0,
    ofertas: 0,
    asignaciones: 0,
    ordenes: 0,
    lineas: 0,
    logs: 0,
    invitados: 0,
  };

  for (let idx = 0; idx < plan.length; idx++) {
    const p = plan[idx];
    const numero = `${PREFIJO_LICITACION}${String(idx + 1).padStart(4, "0")}`;

    // ── Línea de tiempo coherente: creación < lanzamiento < inicio < … ──────
    const esEjecutada =
      p.estado === "Finalizada" || p.estado === "Cerrada" || p.estado === "Esperando Validación";

    // Ancla: para las ejecutadas el ancla es el CIERRE (cae en el mes del plan);
    // para las abiertas, la creación.
    const ancla = fechaEnMes(p.mes);
    const diasProceso = entero(6, 22);
    const creacion = esEjecutada ? masDias(ancla, -diasProceso) : ancla;

    const lanzamiento =
      p.estado === "Borrador" ? null : masDias(creacion, entero(1, 5));
    const inicio =
      lanzamiento && p.estado !== "Programada" ? masDias(lanzamiento, entero(1, 4)) : null;

    // Ronda extra en ~1/3 de las que llegaron a decisión → ejercita el ciclo
    // En Proceso ↔ Esperando Decisión del tiempo por etapa.
    const conRondaExtra = Boolean(inicio) && chance(0.34);
    const decision = inicio ? masDias(inicio, entero(2, 6)) : null;
    const reapertura = conRondaExtra && decision ? masDias(decision, entero(1, 2)) : null;
    const decision2 = reapertura ? masDias(reapertura, entero(2, 4)) : null;
    const ultimaDecision = decision2 ?? decision;

    const cerrada =
      esEjecutada && ultimaDecision ? masDias(ultimaDecision, entero(1, 4)) : null;
    const validacion =
      (p.estado === "Esperando Validación" || p.estado === "Finalizada") && cerrada
        ? masDias(cerrada, entero(1, 3))
        : null;
    const finalizada =
      p.estado === "Finalizada" && validacion ? masDias(validacion, entero(1, 6)) : null;
    const cancelada = p.estado === "Cancelada" ? masDias(creacion, entero(4, 25)) : null;

    // Estado real + flag. "Esperando Decisión" NO es un valor de `estado`:
    // vive como esperandoDecision=true sobre "En Proceso".
    const estadoReal =
      p.estado === "EnProceso" || p.estado === "EnProcesoDecision" ? "En Proceso" : p.estado;
    const esperandoDecision = p.estado === "EnProcesoDecision";

    // La cadena de log tiene que TERMINAR en el estado actual.
    const fechasLog = {
      creacion,
      lanzamiento,
      inicio,
      decision: p.estado === "Borrador" || p.estado === "Programada" ? null : decision,
      reapertura,
      decision2,
      cerrada,
      validacion,
      finalizada,
      cancelada,
    };
    // Para "En Licitación" (En Proceso sin flag) el último paso debe ser
    // "En Proceso", no "Esperando Decisión".
    if (p.estado === "EnProceso") {
      fechasLog.decision = null;
      fechasLog.reapertura = null;
      fechasLog.decision2 = null;
    }
    if (p.estado === "EnProcesoDecision") {
      fechasLog.reapertura = null;
      fechasLog.decision2 = null;
    }
    const cadena = construirCadena(p.estado, fechasLog);

    // ── Moneda ─────────────────────────────────────────────────────────────
    const enUSD = chance(0.25);
    const tc = enUSD ? tipoCambioDelMes(p.mes) : null;
    const moneda = enUSD ? "USD" : "MXN";

    // ── Materiales ─────────────────────────────────────────────────────────
    const nItems = entero(3, 6);
    const usaRecurrente = chance(0.7);
    const seleccion: ProductoDemo[] = [];
    if (usaRecurrente) seleccion.push(elegir(recurrentes));
    seleccion.push(
      ...elegirVarios(
        productosDemo.filter((x) => !seleccion.some((s) => s.id === x.id)),
        nItems - seleccion.length
      )
    );

    // Deriva de precio a lo largo del año (~6% anual) para que la gráfica de
    // variación muestre tendencia y no ruido plano.
    const derivaAnual = 1 + (11 - p.mes) * 0.005;

    const invitados = elegirVarios(proveedoresIds, entero(3, 5));
    const rondasTotales = conRondaExtra ? 3 : entero(2, 3);

    await prisma.$transaction(async (tx) => {
      const lic = await tx.licitacion.create({
        data: {
          numero,
          jerarquia: elegir(["Crítica", "Alta", "Media", "Baja"]),
          tipoLicitacion: elegir(["MTS", "MTO", "COT", "SVC"]),
          fechaCreacion: creacion,
          fechaEjecucion: lanzamiento ? masDias(lanzamiento, 1) : null,
          fechaInicioLicitacion: inicio,
          fechaFinLicitacion: ultimaDecision,
          fechaEsperandoDecision: fechasLog.decision2 ?? fechasLog.decision,
          fechaFinReal: ultimaDecision,
          fechaCerrada: cerrada,
          fechaFinalizada: finalizada,
          fechaCancelada: cancelada,
          costoObjetivo: null,
          tiposCambio: tc ? { USD: tc } : undefined,
          monedaConsolidacion: "MXN",
          maxRondas: rondasTotales,
          rondaActual: inicio ? rondasTotales : 0,
          esperandoDecision,
          estado: estadoReal,
          modoLicitacion: "Proveedores",
          compradorId,
          clienteId: CLIENTE_ID,
        },
      });
      conteo.licitaciones++;

      await tx.licitacionEstadoLog.createMany({
        data: cadena.map((c) => ({ licitacionId: lic.id, ...c, usuarioId: null })),
      });
      conteo.logs += cadena.length;

      await tx.licitacionProveedor.createMany({
        data: invitados.map((proveedorId) => ({
          licitacionId: lic.id,
          proveedorId,
          invitadoEn: lanzamiento ?? creacion,
        })),
      });
      conteo.invitados += invitados.length;

      for (const prod of seleccion) {
        const cantidad = entero(5, 250);
        // Precio final objetivo, en la moneda de la licitación.
        const finalMXN = redondear(prod.precioBaseMXN * derivaAnual * entre(0.94, 1.06), 2);
        const finalMoneda = enUSD && tc ? redondear(finalMXN / tc, 2) : finalMXN;

        // ~65% de los items dentro de objetivo → adherencia realista.
        const objetivo = redondear(finalMoneda * (chance(0.65) ? entre(1.0, 1.1) : entre(0.88, 0.99)), 2);

        const item = await tx.licitacionItem.create({
          data: {
            licitacionId: lic.id,
            productoId: prod.id,
            cantidadSolicitada: cantidad,
            precioObjetivo: objetivo,
            moneda, // FUENTE DE VERDAD de la moneda (OfertaItem.moneda no se usa)
            fechaEntrega: cerrada ? masDias(cerrada, entero(10, 45)) : null,
            createdAt: creacion,
          },
        });
        conteo.items++;

        if (!inicio) continue; // Borrador / Programada: sin ofertas todavía

        // ── Ofertas por ronda, con precio DECRECIENTE ──────────────────────
        // El mejor precio del ganador aterriza en `finalMoneda`; los demás
        // quedan arriba. La ronda 1 arranca 12-18% por encima.
        for (let pi = 0; pi < invitados.length; pi++) {
          const proveedorId = invitados[pi];
          // Algunos proveedores NO ofertan en la ronda 1 y entran en la 2: eso
          // ejercita `primeraRondaConOferta` (primera ronda CON puja ≠ ronda 1).
          const arrancaEn = pi > 0 && chance(0.22) ? 2 : 1;
          const penalizacion = pi === 0 ? 1 : 1 + pi * entre(0.02, 0.06);
          const spreadInicial = entre(1.12, 1.18);

          for (let ronda = arrancaEn; ronda <= rondasTotales; ronda++) {
            const avance = (ronda - arrancaEn) / Math.max(1, rondasTotales - arrancaEn);
            const factor = spreadInicial - (spreadInicial - 1) * avance;
            const precio = redondear(finalMoneda * penalizacion * factor, 2);
            await tx.ofertaItem.create({
              data: {
                licitacionItemId: item.id,
                proveedorId,
                ronda,
                precioUnitario: precio,
                cantidadDisponible: chance(0.85) ? cantidad : Math.floor(cantidad * 0.7),
                puedeCumplirFecha: chance(0.9),
                fechaEstimadaEntrega: cerrada ? masDias(cerrada, entero(12, 50)) : null,
                createdAt: masHoras(inicio, ronda * 24),
                // moneda: se deja en su default. Es columna muerta a propósito.
              },
            });
            conteo.ofertas++;
          }
        }

        // ── Asignaciones (solo ejecutadas) ─────────────────────────────────
        if (!esEjecutada || !cerrada) continue;

        // ~80% al más barato, ~20% al segundo (por fecha de entrega). Esto es
        // deliberado: hace que "Monto asignado" NO cuadre con "Valor mejores
        // precios", que es el comportamiento correcto documentado en Fase 3.
        const ganadorIdx = chance(0.8) ? 0 : Math.min(1, invitados.length - 1);
        const precioGanador = redondear(
          finalMoneda * (ganadorIdx === 0 ? 1 : 1 + entre(0.02, 0.06)),
          2
        );

        const reparte = chance(0.2) && invitados.length > 1;
        const cant1 = reparte ? Math.floor(cantidad * 0.6) : cantidad;

        await tx.asignacionMaterial.create({
          data: {
            licitacionId: lic.id,
            licitacionItemId: item.id,
            proveedorId: invitados[ganadorIdx],
            cantidadAsignada: cant1,
            precioUnitario: precioGanador,
            ronda: rondasTotales,
            orden: 1,
            // ~8% Rechazado → se excluyen de todos los montos del Grupo 3.
            estatusProveedor: chance(0.08)
              ? "Rechazado"
              : p.estado === "Finalizada"
                ? "Confirmado"
                : "Aprobado",
            fechaObjetivo: masDias(cerrada, entero(15, 45)),
            fechaEstimadaProveedor: masDias(cerrada, entero(15, 55)),
            fechaConfirmacion: p.estado === "Finalizada" ? masDias(cerrada, entero(1, 4)) : null,
            moneda, // heredada del item — AsignacionMaterial.moneda SÍ es confiable
            createdAt: cerrada,
          },
        });
        conteo.asignaciones++;

        if (reparte) {
          const otro = invitados[(ganadorIdx + 1) % invitados.length];
          await tx.asignacionMaterial.create({
            data: {
              licitacionId: lic.id,
              licitacionItemId: item.id,
              proveedorId: otro,
              cantidadAsignada: cantidad - cant1,
              precioUnitario: redondear(precioGanador * entre(1.01, 1.05), 2),
              ronda: rondasTotales,
              orden: 2,
              estatusProveedor: "Aprobado",
              fechaObjetivo: masDias(cerrada, entero(15, 45)),
              fechaEstimadaProveedor: masDias(cerrada, entero(15, 55)),
              moneda,
              createdAt: cerrada,
            },
          });
          conteo.asignaciones++;
        }
      }

      // ── Órdenes de compra (solo Finalizadas con oc != "ninguna") ─────────
      if (p.estado !== "Finalizada" || !finalizada || !p.oc || p.oc === "ninguna") return;

      const asignaciones = await tx.asignacionMaterial.findMany({
        where: { licitacionId: lic.id, estatusProveedor: { not: "Rechazado" } },
        include: { licitacionItem: { include: { producto: true } } },
      });
      if (asignaciones.length === 0) return;

      // Una OC por proveedor, como hace ordenesUtils.
      const porProveedor = new Map<string, typeof asignaciones>();
      for (const a of asignaciones) {
        porProveedor.set(a.proveedorId, [...(porProveedor.get(a.proveedorId) ?? []), a]);
      }

      for (const [proveedorId, lineas] of porProveedor) {
        numOrden++;
        const fechaOC = masDias(finalizada, entero(0, 2));
        const estimada = masDias(fechaOC, entero(12, 40));

        // 75% a tiempo / 25% tarde → on-time delivery realista, no 100%.
        const aTiempo = chance(0.75);
        const entregadaEn =
          p.oc === "entregada"
            ? aTiempo
              ? masDias(estimada, -entero(0, 5))
              : masDias(estimada, entero(2, 12))
            : null;
        const recibida = entregadaEn && chance(0.6) ? masDias(entregadaEn, entero(1, 4)) : null;

        const orden = await tx.ordenCompra.create({
          data: {
            numero: `${PREFIJO_ORDEN}${String(numOrden).padStart(4, "0")}`,
            licitacionId: lic.id,
            proveedorId,
            estado: p.oc === "pendiente" ? "Pendiente" : recibida ? "Recibida" : "Entregada",
            fechaCreacion: fechaOC,
            fechaEstimadaEntrega: estimada,
            fechaPendiente: fechaOC,
            fechaEnTransito: entregadaEn ? masDias(fechaOC, entero(1, 5)) : null,
            fechaEntregada: entregadaEn,
            fechaRecibida: recibida,
            clienteId: CLIENTE_ID,
          },
        });
        conteo.ordenes++;

        for (const a of lineas) {
          await tx.ordenCompraLinea.create({
            data: {
              ordenCompraId: orden.id,
              asignacionId: a.id, // @unique — una línea por asignación
              productoNombre: a.licitacionItem.producto.nombre,
              cantidad: a.cantidadAsignada,
              unidadMedida: a.licitacionItem.producto.unidadMedida,
              precioUnitario: a.precioUnitario,
              subtotal: redondear(a.cantidadAsignada * a.precioUnitario, 2),
              moneda: a.moneda,
              fechaEntregaObjetivo: a.fechaObjetivo,
              fechaEstimadaProveedor: a.fechaEstimadaProveedor,
              createdAt: fechaOC,
            },
          });
          conteo.lineas++;
        }
      }
    }, { timeout: 60_000 });

    if ((idx + 1) % 10 === 0) console.log(`   … ${idx + 1}/${plan.length} licitaciones`);
  }

  // ── Verificación de que lo real siguió intacto ────────────────────────────
  const [provDespues, licRealesDespues, ocRealesDespues, usuariosDespues, productosDespues] =
    await Promise.all([
      prisma.proveedor.count({ where: { razonSocial: { not: { startsWith: PREFIJO_RAZON_SOCIAL } } } }),
      prisma.licitacion.count({ where: { numero: { not: { startsWith: PREFIJO_LICITACION } } } }),
      prisma.ordenCompra.count({ where: { numero: { not: { startsWith: PREFIJO_ORDEN } } } }),
      prisma.usuario.count({ where: { email: { not: { contains: "@proveedores-demo.mx" } } } }),
      prisma.producto.count(),
    ]);

  console.log("\n──────────────── RESUMEN ────────────────");
  console.log(conteo);
  console.log("\n── VERIFICACIÓN DE DATOS REALES ──");
  const ok = (a: number, b: number) => (a === b ? "✓" : "✗ CAMBIÓ");
  console.log(`Proveedores reales:  ${provDespues}/${provReales.length}  ${ok(provDespues, provReales.length)}`);
  console.log(`Licitaciones reales: ${licRealesDespues}/${licReales.length}  ${ok(licRealesDespues, licReales.length)}`);
  console.log(`OC reales:           ${ocRealesDespues}/${ocReales.length}  ${ok(ocRealesDespues, ocReales.length)}`);
  console.log(`Usuarios reales:     ${usuariosDespues}/${usuariosReales}  ${ok(usuariosDespues, usuariosReales)}`);
  console.log(`Productos:           ${productosDespues}  (no se tocaron)`);

  console.log("\n── ACCESO AL PORTAL DE LOS PROVEEDORES DEMO ──");
  console.log(`Correo:      ${correoLoginProveedor(1)} … ${correoLoginProveedor(12)}`);
  console.log(`Contraseña:  ${PASSWORD_DEMO}   (la misma para los 12)`);
  console.log(
    `\nOJO: el correo de LOGIN usa ${"@proveedores-demo.mx"}, no @evolveba.com.mx.\n` +
      `El corporativo se enruta a Microsoft SSO (app/login/actions.ts:52) y nunca\n` +
      `aceptaría contraseña. El correo de CONTACTO del proveedor sí es ti+N@evolveba.com.mx.`
  );
  console.log(`\nPara borrar todo:  npx tsx scripts/limpiar-demo.ts --apply\n`);
}

main()
  .catch((e) => {
    console.error("\n✗ ERROR en seed-demo:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
