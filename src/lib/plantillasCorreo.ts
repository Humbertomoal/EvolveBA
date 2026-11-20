import { getConfigEmpresa } from "@/src/config/empresa";
import { plantillasCorreo, type TipoCorreo } from "@/src/config/plantillasCorreo";
import { formatFechaDia } from "@/src/lib/dateUtils";
import {
  agruparPartidas,
  domicilioDeGrupo,
  ETIQUETA_SIN_GRUPO,
  type GrupoLectura,
} from "@/src/lib/agruparPartidas";
import { formatImporte } from "@/src/lib/monedas";

export type { TipoCorreo };

/**
 * Variables disponibles en TODOS los tipos de correo, se llenan
 * automáticamente desde getConfigEmpresa(codigoCliente) — no hace
 * falta pasarlas en `variables`.
 */
export const VARIABLES_COMUNES = [
  "nombreEmpresa",
  "nombreComercial",
  "nombreAsistente",
  "tituloAsistente",
  "telefonoContacto",
  "urlPortal",
  "firmaCorreo",
] as const;

/**
 * Variables específicas por tipo de correo (además de las comunes).
 * Estas SÍ hay que pasarlas explícitamente en `variables` al llamar
 * a renderizarPlantilla — vienen del proveedor/licitación/resultado
 * involucrado en cada envío, no de la config de empresa. La lista de
 * cada tipo refleja exactamente los {placeholders} que aparecen en su
 * plantilla (src/config/plantillasCorreo.ts).
 *
 * Grupos de origen:
 * - Proveedor:   nombreProveedor, nombreContacto, usuarioAcceso, passwordTemporal
 * - Licitación:  numeroLicitacion, nombreComprador, correoComprador,
 *                telefonoComprador, fechaInicio, fechaFin, fechaAnterior,
 *                cantidadMateriales, tablaMateriales, instruccionesLicitacion
 * - Resultado:   tablaGanadores, ahorroTotal, presupuestoObjetivo,
 *                totalPrimeraRonda, mejorCostoTotal, adherenciaPrecio
 */
/**
 * Variables del correo de licitación. Las comparten INVITACION_LICITACION y
 * AJUSTE_LICITACION, que son el mismo cuerpo con distinto primer párrafo.
 */
const VARIABLES_LICITACION = [
  "numeroLicitacion",
  "fechaInicio",
  "fechaFin",
  "cantidadMateriales",
  "tablaMateriales",
  // Fichas técnicas que no cupieron como adjunto; vacío si todas se
  // adjuntaron (y entonces la línea de la plantilla se colapsa).
  "enlacesFichas",
  "instruccionesLicitacion",
  "nombreComprador",
  "telefonoComprador",
  "correoComprador",
] as const;

export const VARIABLES_POR_TIPO: Record<TipoCorreo, readonly string[]> = {
  ALTA_PROVEEDOR: ["nombreContacto", "usuarioAcceso", "passwordTemporal"],
  RESPUESTA_PROVEEDOR: [
    "nombreComprador",
    "nombreProveedor",
    "numeroLicitacion",
    "tablaAceptados",
    "tablaRechazados",
    "totalAceptados",
    "totalRechazados",
    "enlaceSeguimiento",
  ],
  RECORDATORIO_PRODUCTOS: ["nombreContacto", "usuarioAcceso", "passwordTemporal"],
  INVITACION_LICITACION: VARIABLES_LICITACION,
  // Mismo cuerpo con otra intro ⇒ exactamente las mismas variables. Se
  // comparte la lista para que no puedan divergir.
  AJUSTE_LICITACION: VARIABLES_LICITACION,
  CAMBIO_FECHA: [
    "numeroLicitacion",
    "fechaAnterior",
    "fechaInicio",
    "nombreComprador",
    "telefonoComprador",
    "correoComprador",
  ],
  RESULTADO_INTERNO: [
    "numeroLicitacion",
    "nombreComprador",
    "presupuestoObjetivo",
    "totalPrimeraRonda",
    "mejorCostoTotal",
    "adherenciaPrecio",
    "ahorroTotal",
    "tablaGanadores",
  ],
  NOTIFICACION_GANADOR_TENTATIVO: [
    "nombreProveedor",
    "numeroLicitacion",
    "tablaMateriales",
    "fechaLimiteValidacion",
  ],
  NOTIFICACION_GANADORES: ["nombreProveedor", "numeroLicitacion", "tablaMateriales"],
  NOTIFICACION_NO_GANADORES: ["nombreProveedor", "numeroLicitacion"],
  CONFIRMACION_CIERRE: [
    "nombreProveedor",
    "numeroLicitacion",
    "tablaMateriales",
    "nombreComprador",
    "telefonoComprador",
    "correoComprador",
  ],
};

/** Variables válidas para un tipo de correo: comunes + específicas. */
export function listarVariablesDisponibles(tipo: TipoCorreo): string[] {
  return [...VARIABLES_COMUNES, ...VARIABLES_POR_TIPO[tipo]];
}

/**
 * Firma estándar (nombreAsistente, tituloAsistente, nombreEmpresa) ya
 * renderizada — para anteponerla en correos libres que no parten de una
 * plantilla (ver ModalCorreo en modo libre).
 */
export function renderizarFirma(codigoCliente: string): string {
  const empresa = getConfigEmpresa(codigoCliente);
  return `${empresa.nombreAsistente}\n${empresa.tituloAsistente} - ${empresa.nombreEmpresa}`;
}

function reemplazarVariables(
  texto: string,
  variables: Record<string, string>
): string {
  return texto.replace(/\{(\w+)\}/g, (_match, nombre: string) => {
    return variables[nombre] ?? "";
  });
}

/**
 * Renderiza una plantilla de correo: combina las variables comunes
 * (tomadas de getConfigEmpresa) con las variables específicas dadas,
 * y reemplaza todos los {placeholders} en asunto y cuerpo. Cualquier
 * variable sin valor se deja vacía (nunca queda el {placeholder} crudo).
 */
export function renderizarPlantilla(
  tipo: TipoCorreo,
  variables: Record<string, string>,
  codigoCliente: string
): { asunto: string; cuerpo: string } {
  const plantilla = plantillasCorreo[tipo];
  const empresa = getConfigEmpresa(codigoCliente);

  const variablesComunes: Record<string, string> = {
    nombreEmpresa: empresa.nombreEmpresa,
    nombreComercial: empresa.nombreComercial,
    nombreAsistente: empresa.nombreAsistente,
    tituloAsistente: empresa.tituloAsistente,
    telefonoContacto: empresa.telefonoContacto,
    urlPortal: empresa.urlPortal,
    firmaCorreo: empresa.firmaCorreo,
  };

  const todasLasVariables = { ...variablesComunes, ...variables };

  return {
    asunto: reemplazarVariables(plantilla.asunto, todasLasVariables),
    cuerpo: reemplazarVariables(plantilla.cuerpo, todasLasVariables),
  };
}

// ── Tablas en texto plano para {tablaMateriales} / {tablaGanadores} ────────────
// Formato de lista (no tabla HTML): se ve limpio tanto en texto plano como
// una vez pasado por convertirTextoAHtml (saltos de línea → <br>).

export type ItemTablaMaterial = {
  /**
   * Producto de la partida: es la llave del resumen consolidado. Sin él se
   * consolida por nombre + unidad (dos productos homónimos con la misma
   * unidad se sumarían; por eso los llamadores lo pasan siempre).
   */
  productoId?: string | null;
  producto: string;
  cantidad: number;
  unidad: string;
  fechaRequerida: Date | string | null;
  /** Grupo (sitio de entrega). Ausente o null = sin grupo. */
  grupo?: GrupoLectura | null;
};

function lineaMaterial(item: ItemTablaMaterial): string {
  return `- ${item.producto}: ${formatCantidad(item.cantidad)} ${item.unidad} · Fecha requerida: ${formatFechaDia(item.fechaRequerida)}`;
}

function formatCantidad(n: number): string {
  // Redondeo a 6 decimales: la suma de cantidades con decimales (0.1 + 0.2)
  // no debe asomar como 0.30000000000000004 en el correo.
  return (Math.round(n * 1e6) / 1e6).toLocaleString("es-MX");
}

export const TITULO_RESUMEN_MATERIALES = "RESUMEN POR MATERIAL (total de todos los sitios de entrega)";
export const TITULO_DESGLOSE_GRUPOS = "DESGLOSE POR SITIO DE ENTREGA";

/**
 * Cada material una sola vez, con la cantidad sumada de todos sus grupos, en
 * el orden de su PRIMERA aparición (o sea, el mismo orden de `items`). Las
 * fechas no se consolidan: pueden variar por sitio y están en el desglose.
 */
export function resumenPorMaterial(
  items: ItemTablaMaterial[]
): { producto: string; unidad: string; cantidad: number; sitios: number }[] {
  const porLlave = new Map<
    string,
    { producto: string; unidad: string; cantidad: number; grupos: Set<string> }
  >();
  for (const item of items) {
    const llave = item.productoId ? `id:${item.productoId}` : `nombre:${item.producto}|${item.unidad}`;
    let fila = porLlave.get(llave);
    if (!fila) {
      fila = { producto: item.producto, unidad: item.unidad, cantidad: 0, grupos: new Set() };
      porLlave.set(llave, fila);
    }
    fila.cantidad += item.cantidad;
    fila.grupos.add(item.grupo?.id ?? "");
  }
  return [...porLlave.values()].map(({ grupos, ...resto }) => ({ ...resto, sitios: grupos.size }));
}

/**
 * Lista de materiales del correo. Sin grupos, idéntica a la de siempre: una
 * línea por material. Con grupos, un bloque por grupo encabezado por su nombre
 * y domicilio de entrega, separado por una línea en blanco, y "Sin grupo" al
 * final si hace falta. `items` debe venir en ORDEN_PARTIDAS (y, si se filtró
 * por catálogo, conservando ese orden): aquí no se reordena.
 *
 * Con DOS o más secciones, antes del desglose va un resumen consolidado por
 * material (para cotizar por volumen). Con una sola sección el resumen
 * repetiría el desglose, así que no se pone.
 */
export function generarTablaMateriales(items: ItemTablaMaterial[]): string {
  if (items.length === 0) return "Sin materiales.";
  const { hayGrupos, secciones } = agruparPartidas(items, (i) => i.grupo);
  if (!hayGrupos) return items.map(lineaMaterial).join("\n");
  const desglose = secciones
    .map(({ grupo, items: delGrupo }) => {
      const domicilio = domicilioDeGrupo(grupo);
      const encabezado = grupo
        ? `${grupo.nombre}${domicilio ? ` — Entrega en: ${domicilio}` : ""}`
        : `${ETIQUETA_SIN_GRUPO} (sin domicilio de entrega)`;
      // Si todo el sitio comparte la fecha, va una vez en el encabezado y no
      // en cada línea. Con fechas distintas dentro del sitio, por línea.
      const fechas = new Set(delGrupo.map((i) => formatFechaDia(i.fechaRequerida)));
      if (fechas.size === 1) {
        const [fecha] = fechas;
        return [
          `${encabezado} · Fecha requerida: ${fecha}`,
          ...delGrupo.map((i) => `- ${i.producto}: ${formatCantidad(i.cantidad)} ${i.unidad}`),
        ].join("\n");
      }
      return [encabezado, ...delGrupo.map(lineaMaterial)].join("\n");
    })
    .join("\n\n");
  if (secciones.length < 2) return desglose;
  const resumen = resumenPorMaterial(items).map(
    (m) =>
      `- ${m.producto}: ${formatCantidad(m.cantidad)} ${m.unidad}` +
      (m.sitios > 1 ? ` (${m.sitios} sitios)` : "")
  );
  return [TITULO_RESUMEN_MATERIALES, ...resumen, "", TITULO_DESGLOSE_GRUPOS, desglose].join("\n");
}

/**
 * Bloque {enlacesFichas} de la invitación: las fichas técnicas que NO cupieron
 * como adjunto, ofrecidas como enlaces de descarga (las URLs de Storage son
 * públicas). Devuelve "" cuando todas se adjuntaron, para que la línea de la
 * plantilla se colapse y el correo no muestre un encabezado vacío.
 */
export function generarEnlacesFichas(urls: string[]): string {
  if (urls.length === 0) return "";
  const lineas = urls.map((url) => {
    let nombre = url;
    try {
      nombre = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? url);
    } catch {
      // URL malformada: se muestra tal cual.
    }
    return `- ${nombre}: ${url}`;
  });
  return `\nFichas técnicas de los materiales (descarga directa):\n${lineas.join("\n")}\n`;
}

export type ItemTablaGanador = {
  material: string;
  proveedor: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  moneda: string;
};

export function generarTablaGanadores(asignaciones: ItemTablaGanador[]): string {
  if (asignaciones.length === 0) return "Sin asignaciones.";
  return asignaciones
    .map((a) => {
      const subtotal = a.cantidad * a.precioUnitario;
      return `- ${a.material} → ${a.proveedor} · ${a.cantidad.toLocaleString("es-MX")} ${a.unidad} × ${formatImporte(a.precioUnitario, a.moneda)} = ${formatImporte(subtotal, a.moneda)}`;
    })
    .join("\n");
}

export type ItemMaterialGanado = {
  material: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  moneda: string;
};

/**
 * Tabla (texto plano) de los materiales que ganó UN proveedor — para el correo
 * NOTIFICACION_GANADORES, que ya va dirigido a ese proveedor (por eso, a
 * diferencia de generarTablaGanadores, no incluye la columna "proveedor").
 * Muestra material, cantidad y precio asignado; respeta multi-moneda por línea.
 */
export function generarTablaMaterialesGanados(items: ItemMaterialGanado[]): string {
  if (items.length === 0) return "Sin materiales.";
  return items
    .map((i) => {
      const subtotal = i.cantidad * i.precioUnitario;
      return `- ${i.material}: ${i.cantidad.toLocaleString("es-MX")} ${i.unidad} × ${formatImporte(i.precioUnitario, i.moneda)} = ${formatImporte(subtotal, i.moneda)}`;
    })
    .join("\n");
}
