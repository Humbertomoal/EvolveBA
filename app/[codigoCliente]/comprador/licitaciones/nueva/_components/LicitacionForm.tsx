"use client";

import {
  IconAlertTriangle,
  IconCheck,
  IconFile,
  IconFileText,
  IconInfoCircle,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconUpload,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { Producto } from "@/src/data/productos";
import type { Proveedor } from "@/src/data/proveedores";
import {
  actualizarLicitacionAction,
  crearLicitacionAction,
} from "@/src/lib/licitacionesActions";
import { getClienteByCodigo } from "@/src/lib/getClienteByCodigo";
import { MONEDAS } from "@/src/lib/monedas";
import { usePageTitle } from "@/app/_components/PageHeaderContext";

// ── Types ──────────────────────────────────────────────────────────────────────

export type UnidadDuracion = "minutos" | "horas" | "dias";

export type ItemFila = {
  _id: string;
  productoId: string;
  unidadMedida: string;
  especificacion: string;
  fechaEntrega: string;
  cantidadSolicitada: string;
  precioObjetivo: string;
  moneda: string;
};

export type PreDatos = {
  id: string;
  numero: string;
  jerarquia: string;
  tipoLicitacion: string;
  costoObjetivo: string;
  fechaEjecucion: string;
  fechaFinLicitacion: string;
  fechaInicioRangoEntrega: string;
  fechaFinRangoEntrega: string;
  duracionValor: string;
  duracionUnidad: UnidadDuracion;
  maxRondas: string;
  instrucciones: string;
  estado: string;
  modoLicitacion: string;
  items: ItemFila[];
  proveedoresInvitados: string[];
};

// ── Constants ──────────────────────────────────────────────────────────────────

const BTN_PRIMARIO =
  "rounded-md bg-[var(--color-primario)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-secundario)] transition-colors duration-150";

const BTN_SECUNDARIO =
  "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors";

const INPUT =
  "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30";

function iClass(hasError: boolean) {
  return hasError
    ? "w-full rounded-md border border-red-500 px-3 py-2 text-sm text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-primary/30"
    : INPUT;
}

// Ancho fijo para inputs dentro de la tabla de materiales — evita que se
// estiren y fuercen el overflow horizontal del contenedor del formulario.
function cellInputClass(hasError: boolean, width: string) {
  return `${width} rounded-md border px-2 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/30 ${
    hasError ? "border-red-500 focus:border-red-500" : "border-zinc-300 focus:border-zinc-400"
  }`;
}

let _seq = 0;
function nuevoId() {
  return `fila_${Date.now()}_${_seq++}`;
}

function duracionEnMinutos(valor: string, unidad: UnidadDuracion): number {
  const n = parseInt(valor) || 0;
  if (unidad === "horas") return n * 60;
  if (unidad === "dias") return n * 1440;
  return n;
}

// Suma minutos a un valor de <input type="datetime-local"> ("YYYY-MM-DDTHH:mm")
// y devuelve el resultado en el mismo formato — usado para el "min" del campo
// de fecha fin (debe ser estrictamente posterior a la fecha de inicio).
function sumarMinutos(datetimeLocal: string, minutos: number): string {
  if (!datetimeLocal) return "";
  const d = new Date(datetimeLocal);
  d.setMinutes(d.getMinutes() + minutos);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmt(n: number) {
  return n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtFecha(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function LicitacionForm({
  basePath,
  productos,
  proveedores,
  proveedorMateriales = {},
  inicial,
  siguienteNumero = "0001",
  catalogos,
}: {
  basePath: string;
  productos: Producto[];
  proveedores: Proveedor[];
  proveedorMateriales?: Record<string, string[]>;
  inicial?: PreDatos;
  siguienteNumero?: string;
  catalogos: {
    jerarquias: { codigo: string; nombre: string }[];
    tiposLicitacion: { codigo: string; nombre: string }[];
    monedas: { codigo: string; nombre: string; simbolo?: string | null }[];
  };
}) {
  const modoEdicion = inicial !== undefined;
  usePageTitle(modoEdicion ? `Editar Licitación ${inicial!.numero}` : "Nueva Licitación");
  const router = useRouter();
  const nombreEmpresa =
    getClienteByCodigo(basePath.replace(/^\//, "") || null)?.nombreEmpresa ?? "Evolve";

  // ── Section A state ──────────────────────────────────────────────────────────
  const [numero, setNumero] = useState(inicial?.numero ?? siguienteNumero);
  const [jerarquia, setJerarquia] = useState(inicial?.jerarquia ?? "");
  const [tipoLicitacion, setTipoLicitacion] = useState(inicial?.tipoLicitacion ?? "");
  const [costoObjetivo, setCostoObjetivo] = useState(inicial?.costoObjetivo ?? "");
  const [fechaEjecucion, setFechaEjecucion] = useState(inicial?.fechaEjecucion ?? "");
  const [fechaFinLicitacion, setFechaFinLicitacion] = useState(inicial?.fechaFinLicitacion ?? "");
  const [fechaInicioRango, setFechaInicioRango] = useState(inicial?.fechaInicioRangoEntrega ?? "");
  const [fechaFinRango, setFechaFinRango] = useState(inicial?.fechaFinRangoEntrega ?? "");
  const [duracionValor, setDuracionValor] = useState(inicial?.duracionValor ?? "1440");
  const [duracionUnidad, setDuracionUnidad] = useState<UnidadDuracion>(
    inicial?.duracionUnidad ?? "minutos"
  );
  const [maxRondas, setMaxRondas] = useState(inicial?.maxRondas ?? "3");

  // ── Section B state ──────────────────────────────────────────────────────────
  const [items, setItems] = useState<ItemFila[]>(
    inicial?.items?.map((i) => ({ ...i, moneda: (i as ItemFila & { moneda?: string }).moneda ?? "MXN" })) ?? []
  );

  // ── Modal Proveedores state ──────────────────────────────────────────────────
  const [modalProveedoresAbierto, setModalProveedoresAbierto] = useState(false);
  const [busquedaProveedor, setBusquedaProveedor] = useState("");
  const [filtrosTipo, setFiltrosTipo] = useState<string[]>([]);
  const [filtrosEstado, setFiltrosEstado] = useState<string[]>([]);
  const [preseleccionarMateriales, setPreseleccionarMateriales] = useState(true);
  const [selTemp, setSelTemp] = useState<string[]>([]);
  const [proveedoresSeleccionados, setProveedoresSeleccionados] = useState<string[]>(
    inicial?.proveedoresInvitados ?? []
  );

  // ── Modal Instrucciones state ────────────────────────────────────────────────
  const [modoLicitacion, setModoLicitacion] = useState(inicial?.modoLicitacion ?? "Proveedores");
  const esManual = modoLicitacion === "Manual";
  const [guardando, setGuardando] = useState<"borrador" | "programada" | "proceso" | "edicion" | null>(null);
  const [modalConfirmarFecha, setModalConfirmarFecha] = useState(false);
  const [modalInstruccionesAbierto, setModalInstruccionesAbierto] = useState(false);
  const [instrucciones, setInstrucciones] = useState(inicial?.instrucciones ?? "");
  const [instruccionesTemp, setInstruccionesTemp] = useState("");
  const [confirmarRestablecerInstrucciones, setConfirmarRestablecerInstrucciones] = useState(false);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [archivosTemp, setArchivosTemp] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Validation state ─────────────────────────────────────────────────────────
  const [intentoGuardar, setIntentoGuardar] = useState(false);
  const bannerErrorRef = useRef<HTMLDivElement>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const bannerServerErrorRef = useRef<HTMLDivElement>(null);
  const [bannerInfo, setBannerInfo] = useState<string | null>(null);
  const bannerInfoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Item helpers ─────────────────────────────────────────────────────────────

  function agregarItem() {
    setItems((prev) => [
      ...prev,
      {
        _id: nuevoId(),
        productoId: "",
        unidadMedida: "",
        especificacion: "",
        fechaEntrega: fechaInicioRango || "",
        cantidadSolicitada: "",
        precioObjetivo: "",
        moneda: catalogos?.monedas?.[0]?.codigo ?? MONEDAS[0].codigo,
      },
    ]);
  }

  function cambiarItem(id: string, campo: keyof ItemFila, valor: string) {
    setBannerInfo(null);
    const newItems = items.map((item: any) => {
      if (item._id !== id) return item;
      if (campo === "productoId") {
        const prod = productos.find((p: any)  => p.id === valor);
        return {
          ...item,
          productoId: valor,
          unidadMedida: prod?.unidadMedida ?? "",
          moneda: prod?.monedaPredeterminada || item.moneda,
        };
      }
      return { ...item, [campo]: valor };
    });

    setItems(newItems);

    // Price or qty change → update costoObjetivo from sum of subtotals (unidirectional)
    if (campo === "precioObjetivo" || campo === "cantidadSolicitada") {
      const newTotal = newItems.reduce(
        (sum: any, i: any) =>
          sum + (parseFloat(i.cantidadSolicitada) || 0) * (parseFloat(i.precioObjetivo) || 0),
        0
      );
      setCostoObjetivo(newTotal > 0 ? newTotal.toFixed(2) : "");
    }

    // Auto-extend Fin Rango de Entrega when a product delivery date exceeds it
    if (campo === "fechaEntrega" && valor && fechaFinRango && valor > fechaFinRango) {
      const currentItem = items.find((i) => i._id === id);
      const nombre = currentItem?.productoId
        ? (productos.find((p: any)  => p.id === currentItem.productoId)?.nombre ?? "el producto")
        : "el producto";
      setFechaFinRango(valor);
      setBannerInfo(
        `El Fin del Rango de Entrega fue ajustado a ${fmtFecha(valor)} por la fecha de entrega de ${nombre}`
      );
    }
  }

  function eliminarItem(id: string) {
    const newItems = items.filter((item) => item._id !== id);
    setItems(newItems);
    const newTotal = newItems.reduce(
      (sum: any, i: any) =>
        sum + (parseFloat(i.cantidadSolicitada) || 0) * (parseFloat(i.precioObjetivo) || 0),
      0
    );
    setCostoObjetivo(newTotal > 0 ? newTotal.toFixed(2) : "");
  }

  function handleFechaFinLicitacionChange(valor: string) {
    setFechaFinLicitacion(valor);
    if (!valor) return;
    const p = valor.split("T")[0].split("-");
    const next = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + 1);
    const nuevoMin = [
      next.getFullYear(),
      String(next.getMonth() + 1).padStart(2, "0"),
      String(next.getDate()).padStart(2, "0"),
    ].join("-");
    if (fechaInicioRango && fechaInicioRango < nuevoMin) setFechaInicioRango(nuevoMin);
  }

  function handleCostoObjetivoChange(valor: string) {
    setCostoObjetivo(valor);
    const costo = parseFloat(valor);
    if (!costo || costo <= 0) return;
    // One-time auto-distribution: only when ALL product prices are 0 or empty
    const todosVacios = items.every(
      (i) => !i.precioObjetivo || parseFloat(i.precioObjetivo) <= 0
    );
    if (!todosVacios) return;
    const totalUnidades = items.reduce(
      (sum: any, i: any) => sum + (parseFloat(i.cantidadSolicitada) || 0),
      0
    );
    if (totalUnidades <= 0) return;
    const precioUnit = costo / totalUnidades;
    setItems((prev) =>
      prev.map((item: any) => ({
        ...item,
        precioObjetivo:
          (parseFloat(item.cantidadSolicitada) || 0) > 0
            ? precioUnit.toFixed(2)
            : item.precioObjetivo,
      }))
    );
  }

  function redistribuirPrecios() {
    const costo = parseFloat(costoObjetivo);
    if (!costo || costo <= 0) return;
    const totalUnidades = items.reduce(
      (sum: any, i: any) => sum + (parseFloat(i.cantidadSolicitada) || 0),
      0
    );
    if (totalUnidades <= 0) return;
    const precioUnit = costo / totalUnidades;
    setItems((prev) =>
      prev.map((item: any) => ({
        ...item,
        precioObjetivo:
          (parseFloat(item.cantidadSolicitada) || 0) > 0
            ? precioUnit.toFixed(2)
            : item.precioObjetivo,
      }))
    );
  }

  // ── Proveedores modal helpers ────────────────────────────────────────────────

  const productosEnLicitacion = items.map((i) => i.productoId).filter(Boolean);

  function proveedorTieneMateriales(p: any) {
    return (proveedorMateriales[p.id] ?? []).some((matId) =>
      productosEnLicitacion.includes(matId)
    );
  }

  function abrirModalProveedores() {
    setBusquedaProveedor("");
    setFiltrosTipo([]);
    setFiltrosEstado([]);
    const activarPreseleccion = productosEnLicitacion.length > 0;
    setPreseleccionarMateriales(activarPreseleccion);
    const idsSugeridos = activarPreseleccion
      ? proveedores.filter(proveedorTieneMateriales).map((p: any) => p.id)
      : [];
    setSelTemp([...new Set([...proveedoresSeleccionados, ...idsSugeridos])]);
    setModalProveedoresAbierto(true);
  }

  const proveedoresFiltrados = proveedores.filter((p: any) => {
    const q = busquedaProveedor.toLowerCase();
    const matchQ =
      !q ||
      p.razonSocial.toLowerCase().includes(q) ||
      p.rfc.toLowerCase().includes(q);
    const matchTipo = filtrosTipo.length === 0 || filtrosTipo.includes(p.tipoPersona);
    const matchEstado =
      filtrosEstado.length === 0 || filtrosEstado.includes(p.estado);
    return matchQ && matchTipo && matchEstado;
  });

  function toggleProveedorTemp(id: string) {
    setSelTemp((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function seleccionarTodosVisibles() {
    setSelTemp((prev) => [
      ...new Set([...prev, ...proveedoresFiltrados.map((p: any) => p.id)]),
    ]);
  }

  function deseleccionarTodos() {
    setSelTemp([]);
  }

  function confirmarProveedores() {
    setProveedoresSeleccionados([...selTemp]);
    setModalProveedoresAbierto(false);
  }

  // ── Instrucciones modal helpers ──────────────────────────────────────────────

  function generarPlantilla(): string {
    const numMat = items.filter((i: any) => i.productoId !== "").length;
    const fmtDT = (val: string) => {
      if (!val) return "por definir";
      const [datePart, timePart = "00:00"] = val.split("T");
      const [y, m, d] = datePart.split("-").map(Number);
      const fechaFmt = new Date(y, m - 1, d).toLocaleDateString("es-MX", {
        day: "numeric", month: "long", year: "numeric",
      });
      const [h, min] = timePart.split(":");
      return `${fechaFmt} a las ${h}:${min} hrs`;
    };
    return `Estimado Proveedor,

Por medio del presente le informamos que ha sido invitado a participar en la Licitación ${numero}.

La licitación iniciará el ${fmtDT(fechaEjecucion)} y finalizará el ${fmtDT(fechaFinLicitacion)}. Podrá haber más de una ronda de cotización, por lo que le recomendamos estar pendiente del portal durante el período de licitación.

Se le solicita cotizar ${numMat} material(es) incluidos en esta licitación. Por favor revise el detalle de los materiales solicitados en el portal y registre su mejor oferta de precio y cantidad disponible para cada uno dentro del tiempo establecido.

Cualquier duda o aclaración, comuníquese con el comprador asignado a esta licitación a través del chat disponible en el portal.

Atentamente,
${nombreEmpresa}
Asistente de Inteligencia Artificial`;
  }

  function abrirModalInstrucciones() {
    setInstruccionesTemp(instrucciones || generarPlantilla());
    setArchivosTemp([...archivos]);
    setConfirmarRestablecerInstrucciones(false);
    setModalInstruccionesAbierto(true);
  }

  function quitarArchivoTemp(i: number) {
    setArchivosTemp((prev) => prev.filter((_, idx) => idx !== i));
  }

  function guardarInstrucciones() {
    setInstrucciones(instruccionesTemp);
    setArchivos([...archivosTemp]);
    setConfirmarRestablecerInstrucciones(false);
    setModalInstruccionesAbierto(false);
  }

  // ── Submit helpers ───────────────────────────────────────────────────────────

  function buildDatos(estado: string) {
    return {
      numero,
      jerarquia: jerarquia || null,
      tipoLicitacion: tipoLicitacion || null,
      costoObjetivo: costoObjetivo ? parseFloat(costoObjetivo) : null,
      fechaEjecucion: fechaEjecucion || null,
      fechaFinLicitacion: fechaFinLicitacion || null,
      fechaInicioRangoEntrega: fechaInicioRango || null,
      fechaFinRangoEntrega: fechaFinRango || null,
      duracionRondaMinutos: duracionEnMinutos(duracionValor, duracionUnidad),
      maxRondas: parseInt(maxRondas) || 3,
      instrucciones: instrucciones || null,
      estado,
      modoLicitacion,
      items: items.map(({ _id, ...rest }) => rest),
      proveedoresInvitados: proveedoresSeleccionados,
    };
  }

  async function ejecutarGuardar(estado?: "Borrador" | "Programada" | "En Proceso") {
    setBannerError(null);
    if (modoEdicion) {
      setGuardando(
        estado === "Borrador" ? "borrador" : estado === "Programada" ? "programada" : "edicion"
      );
      try {
        const destino = await actualizarLicitacionAction(
          inicial!.id,
          basePath,
          buildDatos(estado ?? inicial!.estado)
        );
        toast.success("Licitación guardada correctamente");
        router.push(destino);
      } catch (err) {
        setGuardando(null);
        const msg = err instanceof Error ? err.message : String(err);
        setBannerError(`Error al guardar la licitación: ${msg}`);
        toast.error("No se pudo guardar la licitación. Intenta de nuevo.");
        setTimeout(
          () => bannerServerErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
          50
        );
      }
    } else {
      setGuardando(
        estado === "Borrador" ? "borrador" : estado === "Programada" ? "programada" : "proceso"
      );
      try {
        const destino = await crearLicitacionAction(basePath, buildDatos(estado!));
        toast.success("Licitación guardada correctamente");
        router.push(destino);
      } catch (err) {
        setGuardando(null);
        const msg = err instanceof Error ? err.message : String(err);
        setBannerError(`Error al guardar la licitación: ${msg}`);
        toast.error("No se pudo guardar la licitación. Intenta de nuevo.");
        setTimeout(
          () => bannerServerErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
          50
        );
      }
    }
  }

  async function handleIniciarCotizacion() {
    if (!modoEdicion || !esManual) return;
    if (inicial!.estado === "En Proceso") {
      router.push(
        `${basePath}/comprador/licitaciones-proceso/${inicial!.id}/captura-manual`
      );
      return;
    }
    // Borrador → validate then save as En Proceso
    if (hayErrores) {
      setIntentoGuardar(true);
      setTimeout(
        () => bannerErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
        50
      );
      return;
    }
    setBannerError(null);
    setGuardando("proceso");
    try {
      const destino = await actualizarLicitacionAction(
        inicial!.id,
        basePath,
        buildDatos("En Proceso")
      );
      router.push(destino);
    } catch (err) {
      setGuardando(null);
      const msg = err instanceof Error ? err.message : String(err);
      setBannerError(`Error al guardar la licitación: ${msg}`);
      setTimeout(
        () =>
          bannerServerErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        50
      );
    }
  }

  async function guardar(estado?: "Borrador" | "Programada" | "En Proceso") {
    if (hayErrores) {
      setIntentoGuardar(true);
      setTimeout(
        () => bannerErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
        50
      );
      return;
    }
    if (
      modoEdicion &&
      inicial!.estado === "En Proceso" &&
      fechaEjecucion &&
      new Date(fechaEjecucion) > new Date()
    ) {
      setModalConfirmarFecha(true);
      return;
    }
    await ejecutarGuardar(estado);
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  // Price calculations
  const subtotales = items.map(
    (i) => (parseFloat(i.cantidadSolicitada) || 0) * (parseFloat(i.precioObjetivo) || 0)
  );
  const totalProductos = subtotales.reduce((s, v) => s + v, 0);
  const costoObjetivoNum = parseFloat(costoObjetivo) || 0;
  const mismatchTotal =
    costoObjetivoNum > 0 &&
    totalProductos > 0 &&
    Math.abs(totalProductos - costoObjetivoNum) > 0.01;

  // Duration suggestion: uses the licitacion window (ejecución → fin de licitación)
  const minDisponibles = (() => {
    if (!fechaEjecucion || !fechaFinLicitacion) return null;
    const diff =
      (new Date(fechaFinLicitacion).getTime() - new Date(fechaEjecucion).getTime()) / 60000;
    return diff > 0 ? diff : null;
  })();
  const diasDisponibles = minDisponibles !== null ? minDisponibles / (60 * 24) : null;
  const maxRondasNum = parseInt(maxRondas) || 1;
  const duracionSugeridaMin =
    minDisponibles !== null
      ? Math.max(1, Math.round(minDisponibles / maxRondasNum))
      : null;
  const ventanaLabel = (() => {
    if (minDisponibles === null) return "";
    if (minDisponibles < 60) return `${Math.round(minDisponibles)} minutos de licitación`;
    if (minDisponibles < 60 * 24) return `${Math.round(minDisponibles / 60)} horas de licitación`;
    return `${Math.round(diasDisponibles!)} días de licitación`;
  })();
  const sugeridaLabel = (() => {
    if (duracionSugeridaMin === null) return "";
    if (duracionSugeridaMin < 60) return `${duracionSugeridaMin} min por ronda`;
    if (duracionSugeridaMin < 60 * 24) return `${Math.round(duracionSugeridaMin / 60)} horas por ronda`;
    return `${Math.round(duracionSugeridaMin / 1440)} días por ronda`;
  })();
  const durMinutosActual = duracionEnMinutos(duracionValor, duracionUnidad);
  const duracionExcede =
    minDisponibles !== null &&
    durMinutosActual > 0 &&
    durMinutosActual * maxRondasNum > minDisponibles;
  const duracionBajoMinimo = durMinutosActual > 0 && durMinutosActual < 30;

  // Validations
  const itemsValidos =
    items.length > 0 &&
    items.every(
      (i) =>
        i.productoId &&
        i.fechaEntrega &&
        parseFloat(i.cantidadSolicitada) > 0 &&
        i.precioObjetivo !== ""
    );

  const errores: Record<string, string | null> = {
    numero: !numero.trim() ? "Número de Licitación requerido" : null,
    jerarquia: !jerarquia.trim() ? "Criticidad requerida" : null,
    tipoLicitacion: !tipoLicitacion ? "Selecciona un Tipo de Licitación" : null,
    fechaEjecucion: esManual ? null : !fechaEjecucion ? "Fecha Inicio Licitación requerida" : null,
    fechaFinLicitacion: esManual
      ? null
      : !fechaFinLicitacion
        ? "Fecha de Fin de Licitación requerida"
        : fechaEjecucion && new Date(fechaFinLicitacion) <= new Date(fechaEjecucion)
          ? "La fecha fin debe ser posterior a la fecha de inicio"
          : null,
    fechaInicioRango: !fechaInicioRango ? "Inicio del Rango de Entrega requerido" : null,
    fechaFinRango: !fechaFinRango ? "Fin del Rango de Entrega requerido" : null,
    duracionValor: esManual
      ? null
      : !duracionValor || parseInt(duracionValor) <= 0
        ? "Duración de ronda requerida"
        : null,
    maxRondas: esManual
      ? null
      : !maxRondas || parseInt(maxRondas) <= 0
        ? "Máximo de rondas requerido"
        : null,
    items:
      items.length === 0
        ? "Agrega al menos 1 producto a la licitación"
        : !itemsValidos
          ? "Completa todos los campos de los productos antes de guardar"
          : null,
    proveedores:
      proveedoresSeleccionados.length === 0
        ? "Selecciona al menos 1 proveedor participante"
        : null,
    instrucciones: esManual
      ? null
      : !instrucciones.trim()
        ? "Redacta las instrucciones de la licitación"
        : null,
  };
  const hayErrores = Object.values(errores).some(Boolean);

  // Derived min date for Inicio Rango de Entrega (= fechaFinLicitacion date + 1 day)
  const minInicioRango = (() => {
    if (!fechaFinLicitacion) return "";
    const p = fechaFinLicitacion.split("T")[0].split("-");
    const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + 1);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  })();

  const tieneProductos = items.some((i) => i.productoId !== "");
  const tieneProveedores = proveedoresSeleccionados.length > 0;
  const tieneInstrucciones = instrucciones.trim().length > 0 || archivos.length > 0;
  const puedeToggleMateriales = productosEnLicitacion.length > 0;

  // Auto-reset toggle when licitacion has no products (nothing to preselect)
  useEffect(() => {
    if (!puedeToggleMateriales) setPreseleccionarMateriales(false);
  }, [puedeToggleMateriales]);

  // Auto-dismiss info banner after 5 seconds
  useEffect(() => {
    if (!bannerInfo) return;
    if (bannerInfoTimer.current) clearTimeout(bannerInfoTimer.current);
    bannerInfoTimer.current = setTimeout(() => setBannerInfo(null), 5000);
    return () => { if (bannerInfoTimer.current) clearTimeout(bannerInfoTimer.current); };
  }, [bannerInfo]);

  // Auto-fill duration field when both dates and maxRondas are available
  useEffect(() => {
    if (!fechaEjecucion || !fechaFinLicitacion) return;
    const maxR = parseInt(maxRondas) || 1;
    const diffMin =
      (new Date(fechaFinLicitacion).getTime() - new Date(fechaEjecucion).getTime()) / 60000;
    if (diffMin <= 0) return;
    const durPorRondaMin = diffMin / maxR;
    if (durPorRondaMin < 60) {
      setDuracionValor(String(Math.round(durPorRondaMin)));
      setDuracionUnidad("minutos");
    } else if (durPorRondaMin <= 48 * 60) {
      setDuracionValor(String(Math.round(durPorRondaMin / 60)));
      setDuracionUnidad("horas");
    } else {
      setDuracionValor(String(Math.round(durPorRondaMin / 1440)));
      setDuracionUnidad("dias");
    }
  }, [fechaEjecucion, fechaFinLicitacion, maxRondas]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-5xl min-w-0 space-y-8 overflow-x-hidden">

      {/* Informative banner — rango de entrega auto-adjusted */}
      {bannerInfo && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <IconAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <p className="min-w-0 flex-1 text-sm text-amber-700">{bannerInfo}</p>
          <button
            type="button"
            onClick={() => setBannerInfo(null)}
            className="shrink-0 rounded p-0.5 text-amber-400 hover:text-amber-700"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Server error banner */}
      {bannerError && (
        <div
          ref={bannerServerErrorRef}
          className="rounded-lg border border-red-300 bg-red-50 p-4"
        >
          <div className="flex items-start gap-3">
            <IconAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-800">No se pudo guardar la licitación</p>
              <p className="mt-0.5 text-xs text-red-700">{bannerError}</p>
            </div>
            <button
              type="button"
              onClick={() => setBannerError(null)}
              className="shrink-0 rounded p-0.5 text-red-400 hover:text-red-700"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Error banner — appears after first save attempt */}
      {intentoGuardar && hayErrores && (
        <div
          ref={bannerErrorRef}
          className="rounded-lg border border-red-200 bg-red-50 p-4"
        >
          <div className="flex items-start gap-3">
            <IconAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-red-800">
                Completa los campos requeridos antes de guardar:
              </p>
              <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-sm text-red-700">
                {Object.entries(errores)
                  .filter(([, v]) => v !== null)
                  .map(([k, v]) => (
                    <li key={k}>{v}</li>
                  ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-end gap-4">
        <div className="flex flex-wrap gap-2">
          {/* Paso 1: Proveedores — desbloqueado cuando hay ≥1 producto */}
          <span
            title={!tieneProductos ? "Primero agrega al menos un producto a la licitación" : undefined}
          >
            <button
              type="button"
              onClick={tieneProductos ? abrirModalProveedores : undefined}
              className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                tieneProductos
                  ? intentoGuardar && errores.proveedores
                    ? "border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
                    : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                  : "pointer-events-none cursor-not-allowed border-zinc-200 text-zinc-400 opacity-50"
              }`}
            >
              <IconUsers className="h-4 w-4 shrink-0" />
              Proveedores participantes
              {proveedoresSeleccionados.length > 0 && (
                <span className="rounded-full bg-[var(--color-primario)] px-1.5 py-0.5 text-xs font-medium leading-none text-white">
                  {proveedoresSeleccionados.length}
                </span>
              )}
            </button>
          </span>

          {/* Paso 2: Instrucciones — desbloqueado cuando hay ≥1 proveedor */}
          <span
            title={!tieneProveedores ? "Primero selecciona al menos un proveedor participante" : undefined}
          >
            <button
              type="button"
              onClick={tieneProveedores ? abrirModalInstrucciones : undefined}
              className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                !tieneProveedores
                  ? "pointer-events-none cursor-not-allowed border-zinc-200 text-zinc-400 opacity-50"
                  : tieneInstrucciones
                    ? "border-[var(--color-primario)] bg-[var(--color-primario)]/5 text-[var(--color-primario)]"
                    : intentoGuardar && errores.instrucciones
                      ? "border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
                      : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {tieneInstrucciones ? (
                <IconCheck className="h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <IconFileText className="h-4 w-4 shrink-0" />
              )}
              {tieneInstrucciones ? "Instrucciones redactadas" : "Redactar instrucciones"}
            </button>
          </span>

        </div>
      </div>

      {/* Mode toggle */}
      {!modoEdicion && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-zinc-700">Modo de licitación</span>
          <div className="flex rounded-lg border border-zinc-200 p-0.5">
            {(["Proveedores", "Manual"] as const).map((modo) => (
              <button
                key={modo}
                type="button"
                onClick={() => setModoLicitacion(modo)}
                className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-all duration-150 ${
                  modoLicitacion === modo
                    ? "bg-[var(--color-primario)] text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                {modo === "Proveedores" ? "Licitación a Proveedores" : "Cotización Manual"}
              </button>
            ))}
          </div>
          {esManual && (
            <span className="text-xs text-zinc-400">
              El comprador captura las cotizaciones directamente
            </span>
          )}
        </div>
      )}

      {/* Section A – Datos generales */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-zinc-900">Datos generales</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo
            label="Número de Licitación"
            required
            error={intentoGuardar ? errores.numero : null}
          >
            <input
              type="text"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              className={iClass(intentoGuardar && !!errores.numero)}
            />
          </Campo>
          <Campo
            label="Criticidad"
            required
            error={intentoGuardar ? errores.jerarquia : null}
          >
            {catalogos?.jerarquias && catalogos.jerarquias.length > 0 ? (
              <select
                value={jerarquia}
                onChange={(e) => setJerarquia(e.target.value)}
                className={iClass(intentoGuardar && !!errores.jerarquia)}
              >
                <option value="">Seleccionar...</option>
                {catalogos.jerarquias.map((j) => (
                  <option key={j.codigo} value={j.nombre}>{j.nombre}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={jerarquia}
                onChange={(e) => setJerarquia(e.target.value)}
                placeholder="Ej. Crítica, Alta, Media…"
                className={iClass(intentoGuardar && !!errores.jerarquia)}
              />
            )}
          </Campo>
          <Campo
            label="Tipo de Licitación"
            required
            error={intentoGuardar ? errores.tipoLicitacion : null}
          >
            <select
              value={tipoLicitacion}
              onChange={(e) => setTipoLicitacion(e.target.value)}
              className={iClass(intentoGuardar && !!errores.tipoLicitacion)}
            >
              <option value="">Sin especificar</option>
              {(catalogos?.tiposLicitacion && catalogos.tiposLicitacion.length > 0
                ? catalogos.tiposLicitacion
                : [{ codigo: "MTS", nombre: "Made to Stock" }, { codigo: "MTO", nombre: "Made to Order" }]
              ).map((t) => (
                <option key={t.codigo} value={t.nombre}>{t.nombre}</option>
              ))}
            </select>
          </Campo>

          {!esManual && (
            <>
              <Campo
                label="Fecha Inicio Licitación"
                required
                error={intentoGuardar ? errores.fechaEjecucion : null}
              >
                <input
                  type="datetime-local"
                  value={fechaEjecucion}
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={(e) => setFechaEjecucion(e.target.value)}
                  className={iClass(intentoGuardar && !!errores.fechaEjecucion)}
                />
              </Campo>
              <Campo
                label="Fecha de Fin de Licitación"
                required
                error={
                  // El error de "posterior a la fecha de inicio" se muestra de
                  // inmediato (no espera al intento de guardar); el de "requerida"
                  // sigue el patrón del resto del formulario.
                  errores.fechaFinLicitacion === "La fecha fin debe ser posterior a la fecha de inicio"
                    ? errores.fechaFinLicitacion
                    : intentoGuardar
                      ? errores.fechaFinLicitacion
                      : null
                }
              >
                <input
                  type="datetime-local"
                  value={fechaFinLicitacion}
                  min={fechaEjecucion ? sumarMinutos(fechaEjecucion, 1) : undefined}
                  onChange={(e) => handleFechaFinLicitacionChange(e.target.value)}
                  className={iClass(
                    (intentoGuardar || errores.fechaFinLicitacion === "La fecha fin debe ser posterior a la fecha de inicio") &&
                      !!errores.fechaFinLicitacion
                  )}
                />
              </Campo>
            </>
          )}
          <Campo label="Presupuesto Objetivo (opcional)">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-zinc-400">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={costoObjetivo}
                  onChange={(e) => handleCostoObjetivoChange(e.target.value)}
                  className={`${INPUT} pl-7`}
                />
              </div>
              {parseFloat(costoObjetivo) > 0 && items.length > 0 && (
                <button
                  type="button"
                  title={`Redistribuir $${fmt(parseFloat(costoObjetivo))} entre todos los productos según sus cantidades`}
                  onClick={() => {
                    if (
                      window.confirm(
                        `¿Redistribuir el Presupuesto Objetivo ($${fmt(parseFloat(costoObjetivo))}) entre todos los productos? Esto sobreescribirá los precios actuales.`
                      )
                    ) {
                      redistribuirPrecios();
                    }
                  }}
                  className="flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-300 px-2.5 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
                >
                  <IconRefresh className="h-3.5 w-3.5" />
                  Redistribuir
                </button>
              )}
            </div>
          </Campo>

          <Campo
            label="Inicio Rango de Entrega"
            required
            error={intentoGuardar ? errores.fechaInicioRango : null}
          >
            <input
              type="date"
              value={fechaInicioRango}
              min={minInicioRango || undefined}
              onChange={(e) => setFechaInicioRango(e.target.value)}
              className={iClass(intentoGuardar && !!errores.fechaInicioRango)}
            />
          </Campo>
          <Campo
            label="Fin Rango de Entrega"
            required
            error={intentoGuardar ? errores.fechaFinRango : null}
          >
            <input
              type="date"
              value={fechaFinRango}
              min={fechaInicioRango || undefined}
              onChange={(e) => setFechaFinRango(e.target.value)}
              className={iClass(intentoGuardar && !!errores.fechaFinRango)}
            />
          </Campo>

          {!esManual && (
            <>
              {/* Duración de cada ronda — custom layout (no Campo wrapper) */}
              <div className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-zinc-700">
                  Duración de cada ronda
                  <span className="text-red-500"> *</span>
                </span>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    value={duracionValor}
                    onChange={(e) => setDuracionValor(e.target.value)}
                    className={iClass(intentoGuardar && !!errores.duracionValor)}
                  />
                  <select
                    value={duracionUnidad}
                    onChange={(e) => setDuracionUnidad(e.target.value as UnidadDuracion)}
                    className="rounded-md border border-zinc-300 px-2 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="minutos">min</option>
                    <option value="horas">hrs</option>
                    <option value="dias">días</option>
                  </select>
                </div>
                {intentoGuardar && errores.duracionValor && (
                  <p className="mt-0.5 text-xs text-red-500">{errores.duracionValor}</p>
                )}
              </div>

              <Campo
                label="Máximo de rondas"
                required
                error={intentoGuardar ? errores.maxRondas : null}
              >
                <input
                  type="number"
                  min="1"
                  value={maxRondas}
                  onChange={(e) => setMaxRondas(e.target.value)}
                  className={iClass(intentoGuardar && !!errores.maxRondas)}
                />
              </Campo>
            </>
          )}

          {/* Duration hints — full-width row */}
          {!esManual && (duracionSugeridaMin !== null || duracionExcede || duracionBajoMinimo) && (
            <div className="sm:col-span-3 space-y-2">
              {duracionSugeridaMin !== null && !duracionExcede && (
                <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  <IconInfoCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Sugerido: <strong>{sugeridaLabel}</strong>
                    <span className="ml-1 text-blue-500">
                      ({ventanaLabel} ÷ {maxRondasNum} ronda{maxRondasNum !== 1 ? "s" : ""})
                    </span>
                  </span>
                </div>
              )}
              {duracionExcede && (
                <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <IconAlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Con esta duración, las rondas exceden el rango de entrega
                    {duracionSugeridaMin !== null && (
                      <span className="ml-1">(sugerido: {sugeridaLabel})</span>
                    )}
                  </span>
                </div>
              )}
              {duracionBajoMinimo && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <IconAlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    <strong>Recomendación:</strong> con las fechas seleccionadas, cada ronda
                    duraría <strong>{durMinutosActual} min</strong>. Se recomienda un mínimo de
                    30 minutos por ronda para que los proveedores tengan tiempo suficiente para
                    cotizar. Considera ajustar las fechas o reducir el número de rondas.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </fieldset>

      {/* Section B – Productos */}
      <fieldset className="min-w-0 space-y-3">
        <legend className="text-sm font-semibold text-zinc-900">
          Productos de la licitación
        </legend>

        {intentoGuardar && errores.items && (
          <p className="text-xs text-red-500">{errores.items}</p>
        )}

        {items.length === 0 ? (
          <p
            className={`rounded-lg border border-dashed py-10 text-center text-sm ${
              intentoGuardar && errores.items
                ? "border-red-300 text-red-400"
                : "border-zinc-300 text-zinc-400"
            }`}
          >
            Sin productos. Usa el botón de abajo para agregar el primero.
          </p>
        ) : (
          <div className="w-full overflow-x-auto rounded-card border border-border bg-white shadow-card">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                  <th className="px-2 py-2.5 w-44">Producto</th>
                  <th className="px-2 py-2.5 w-40">Especificación</th>
                  <th className="px-2 py-2.5 w-36">Fecha de entrega</th>
                  <th className="px-2 py-2.5 w-20">Unidad</th>
                  <th className="px-2 py-2.5 w-28">Moneda</th>
                  <th className="px-2 py-2.5 w-24">Cantidad</th>
                  <th className="px-2 py-2.5 w-28">Precio obj.</th>
                  <th className="px-2 py-2.5 w-28 text-right">Subtotal</th>
                  <th className="px-2 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {items.map((item: any) => {
                  const subtotal =
                    (parseFloat(item.cantidadSolicitada) || 0) *
                    (parseFloat(item.precioObjetivo) || 0);
                  const rowHasError =
                    intentoGuardar &&
                    (!item.productoId ||
                      !item.fechaEntrega ||
                      !item.cantidadSolicitada ||
                      item.precioObjetivo === "");
                  const nombreProducto = productos.find((p: any) => p.id === item.productoId)?.nombre;
                  return (
                    <tr key={item._id} className={`hover:bg-zinc-50/50 transition-colors duration-150 ${rowHasError ? "bg-red-50/40" : ""}`}>
                      <td className="px-2 py-2">
                        <select
                          value={item.productoId}
                          onChange={(e) =>
                            cambiarItem(item._id, "productoId", e.target.value)
                          }
                          title={nombreProducto}
                          className={cellInputClass(intentoGuardar && !item.productoId, "w-44 max-w-44 truncate")}
                        >
                          <option value="">Seleccionar…</option>
                          {productos.map((p: any)=> (
                            <option key={p.id} value={p.id}>
                              {p.nombre}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={item.especificacion}
                          onChange={(e) =>
                            cambiarItem(item._id, "especificacion", e.target.value)
                          }
                          placeholder="Detalles adicionales…"
                          title={item.especificacion || undefined}
                          className={cellInputClass(false, "w-40")}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="date"
                          value={item.fechaEntrega}
                          min={fechaInicioRango || undefined}
                          onChange={(e) =>
                            cambiarItem(item._id, "fechaEntrega", e.target.value)
                          }
                          className={cellInputClass(intentoGuardar && !item.fechaEntrega, "w-36")}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <span className="block w-20 truncate rounded-md bg-zinc-100 px-2 py-2 text-zinc-500">
                          {item.unidadMedida || "—"}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={item.moneda}
                          onChange={(e) =>
                            cambiarItem(item._id, "moneda" as keyof ItemFila, e.target.value)
                          }
                          className={cellInputClass(false, "w-28")}
                        >
                          {(catalogos?.monedas && catalogos.monedas.length > 0
                            ? catalogos.monedas
                            : MONEDAS
                          ).map((m) => (
                            <option key={m.codigo} value={m.codigo}>{m.codigo}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.cantidadSolicitada}
                          onChange={(e) =>
                            cambiarItem(item._id, "cantidadSolicitada", e.target.value)
                          }
                          className={cellInputClass(intentoGuardar && !item.cantidadSolicitada, "w-24")}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <div className="relative w-28">
                          <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-zinc-400">
                            $
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.precioObjetivo}
                            onChange={(e) =>
                              cambiarItem(item._id, "precioObjetivo", e.target.value)
                            }
                            className={`${cellInputClass(intentoGuardar && item.precioObjetivo === "", "w-28")} pl-6`}
                          />
                        </div>
                      </td>
                      <td className="w-28 px-2 py-2 text-right tabular-nums text-zinc-500">
                        {item.cantidadSolicitada && item.precioObjetivo !== ""
                          ? `$${fmt(subtotal)}`
                          : "—"}
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => eliminarItem(item._id)}
                          aria-label="Eliminar fila"
                          className="rounded-md p-1.5 text-zinc-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-500"
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Add row button + price summary */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {(() => {
            const ultimaFila = items[items.length - 1];
            const bloqueado =
              !!ultimaFila &&
              (!ultimaFila.productoId ||
                !ultimaFila.fechaEntrega ||
                !(parseFloat(ultimaFila.cantidadSolicitada) > 0) ||
                !(parseFloat(ultimaFila.precioObjetivo) > 0));
            return (
              <span title={bloqueado ? "Completa todos los campos del producto anterior antes de agregar uno nuevo" : undefined}>
                <button
                  type="button"
                  onClick={agregarItem}
                  disabled={bloqueado}
                  className="flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <IconPlus className="h-4 w-4" />
                  Agregar producto
                </button>
              </span>
            );
          })()}

          {items.length > 0 && totalProductos > 0 && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-zinc-500">
                Total de productos:{" "}
                <span className="font-semibold text-zinc-900">${fmt(totalProductos)}</span>
              </span>
              {costoObjetivoNum > 0 && (
                mismatchTotal ? (
                  <span className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
                    <IconAlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Difiere del Costo Objetivo (${fmt(costoObjetivoNum)})
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-green-600">
                    <IconCheck className="h-3.5 w-3.5 shrink-0" />
                    Coincide con el Costo Objetivo
                  </span>
                )
              )}
            </div>
          )}
        </div>
      </fieldset>

      {/* Bottom action buttons */}
      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-6">
        {modoEdicion ? (
          <>
            {esManual ? (
              <button
                type="button"
                onClick={() => guardar()}
                disabled={guardando !== null}
                className={`${BTN_PRIMARIO} disabled:cursor-not-allowed disabled:opacity-60 ${
                  hayErrores ? "cursor-not-allowed opacity-50" : ""
                }`}
              >
                {guardando === "edicion" ? "Guardando…" : "Guardar Cambios"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => guardar("Borrador")}
                  disabled={guardando !== null}
                  className={`${BTN_PRIMARIO} disabled:cursor-not-allowed disabled:opacity-60 ${
                    hayErrores ? "cursor-not-allowed opacity-50" : ""
                  }`}
                >
                  {guardando === "borrador" ? "Guardando…" : "Guardar como Borrador"}
                </button>
                <button
                  type="button"
                  onClick={() => guardar("Programada")}
                  disabled={guardando !== null}
                  className={`rounded-md border border-[var(--color-primario)] px-4 py-2 text-sm font-medium text-[var(--color-primario)] transition-colors hover:bg-[var(--color-primario)]/5 disabled:cursor-not-allowed disabled:opacity-60 ${
                    hayErrores ? "cursor-not-allowed opacity-50" : ""
                  }`}
                >
                  {guardando === "programada" ? "Guardando…" : "Guardar y Notificar Participantes"}
                </button>
              </>
            )}
            {esManual && (
              <button
                type="button"
                onClick={handleIniciarCotizacion}
                disabled={guardando !== null}
                className="flex items-center gap-2 rounded-md border border-[var(--color-primario)] px-4 py-2 text-sm font-medium text-[var(--color-primario)] transition-colors hover:bg-[var(--color-primario)]/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <IconPencil className="h-4 w-4 shrink-0" />
                {guardando === "proceso" ? "Guardando…" : "Iniciar cotización manual"}
              </button>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => guardar("Borrador")}
              disabled={guardando !== null}
              className={`${BTN_PRIMARIO} disabled:cursor-not-allowed disabled:opacity-60 ${
                hayErrores ? "cursor-not-allowed opacity-50" : ""
              }`}
            >
              {guardando === "borrador" ? "Guardando…" : "Guardar como Borrador"}
            </button>
            {esManual ? (
              <button
                type="button"
                onClick={() => guardar("En Proceso")}
                disabled={guardando !== null}
                className={`rounded-md border border-[var(--color-primario)] px-4 py-2 text-sm font-medium text-[var(--color-primario)] transition-colors hover:bg-[var(--color-primario)]/5 disabled:cursor-not-allowed disabled:opacity-60 ${
                  hayErrores ? "cursor-not-allowed opacity-50" : ""
                }`}
              >
                {guardando === "proceso" ? "Guardando…" : "Iniciar Cotización Manual"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => guardar("Programada")}
                disabled={guardando !== null}
                className={`rounded-md border border-[var(--color-primario)] px-4 py-2 text-sm font-medium text-[var(--color-primario)] transition-colors hover:bg-[var(--color-primario)]/5 disabled:cursor-not-allowed disabled:opacity-60 ${
                  hayErrores ? "cursor-not-allowed opacity-50" : ""
                }`}
              >
                {guardando === "programada" ? "Guardando…" : "Guardar y Notificar Participantes"}
              </button>
            )}
          </>
        )}
        <Link
          href={`${basePath}/comprador/licitaciones/lanzamiento`}
          className={BTN_SECUNDARIO}
        >
          Cancelar
        </Link>
      </div>

      {/* ── Modal: Proveedores participantes ──────────────────────────────────── */}
      {modalProveedoresAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="flex w-full max-w-lg flex-col rounded-xl bg-white shadow-xl"
            style={{ maxHeight: "85vh" }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-5 py-4">
              <h2 className="text-base font-semibold text-zinc-900">
                Proveedores participantes
              </h2>
              <button
                type="button"
                onClick={() => setModalProveedoresAbierto(false)}
                className="rounded-md p-1 text-zinc-400 hover:text-zinc-700"
              >
                <IconX className="h-5 w-5" />
              </button>
            </div>

            {/* Search + Filters (inline — sin elementos con position:absolute) */}
            <div className="shrink-0 space-y-2.5 border-b border-zinc-200 px-5 py-3">
              <input
                type="text"
                placeholder="Buscar por razón social o RFC…"
                value={busquedaProveedor}
                onChange={(e) => setBusquedaProveedor(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />

              {/* Filter chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-zinc-400">Tipo:</span>
                {(["Fisica", "Moral"] as const).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() =>
                      setFiltrosTipo((prev) =>
                        prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]
                      )
                    }
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      filtrosTipo.includes(val)
                        ? "bg-[var(--color-primario)] text-white"
                        : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                    }`}
                  >
                    {val === "Fisica" ? "Física" : "Moral"}
                  </button>
                ))}
                <span className="ml-1 text-xs text-zinc-400">Estado:</span>
                {(["Activo", "Inactivo"] as const).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() =>
                      setFiltrosEstado((prev) =>
                        prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]
                      )
                    }
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      filtrosEstado.includes(val)
                        ? "bg-[var(--color-primario)] text-white"
                        : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                    }`}
                  >
                    {val}
                  </button>
                ))}
                {(filtrosTipo.length > 0 || filtrosEstado.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFiltrosTipo([]);
                      setFiltrosEstado([]);
                    }}
                    className="ml-1 text-xs text-zinc-400 underline hover:text-zinc-600"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {/* Toggle: preseleccionar proveedores con materiales de la licitación */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  title={
                    !puedeToggleMateriales
                      ? "Agrega productos primero para preseleccionar por materiales"
                      : undefined
                  }
                  className="flex items-center gap-2.5 select-none"
                >
                  <button
                    type="button"
                    role="switch"
                    aria-checked={preseleccionarMateriales}
                    onClick={() => {
                      if (!puedeToggleMateriales) return;
                      const turnOn = !preseleccionarMateriales;
                      setPreseleccionarMateriales(turnOn);
                      if (turnOn) {
                        const idsToPreselect = proveedores
                          .filter(proveedorTieneMateriales)
                          .map((p: any) => p.id);
                        setSelTemp((prev) => [...new Set([...prev, ...idsToPreselect])]);
                      }
                      // Al desactivar no se desmarca nada: solo deja de aplicar la preselección.
                    }}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                      !puedeToggleMateriales
                        ? "cursor-not-allowed bg-zinc-200 opacity-50"
                        : preseleccionarMateriales
                          ? "bg-[var(--color-primario)]"
                          : "bg-zinc-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        preseleccionarMateriales ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                  <span
                    className={`text-xs ${puedeToggleMateriales ? "cursor-pointer text-zinc-600" : "text-zinc-400"}`}
                  >
                    Preseleccionar proveedores que manejan los materiales de esta licitación
                  </span>
                </span>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={seleccionarTodosVisibles}
                    className="text-xs font-medium text-[var(--color-primario)] hover:underline"
                  >
                    Seleccionar todos
                  </button>
                  <span className="text-zinc-300">·</span>
                  <button
                    type="button"
                    onClick={deseleccionarTodos}
                    className="text-xs font-medium text-zinc-500 hover:underline"
                  >
                    Deseleccionar todos
                  </button>
                </div>
              </div>
            </div>

            {/* Provider list */}
            <div className="flex-1 overflow-y-auto px-5 py-1" style={{ minHeight: 0 }}>
              {proveedoresFiltrados.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-400">Sin resultados</p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {proveedoresFiltrados.map((p: any)=> (
                    <li key={p.id}>
                      <label className="flex cursor-pointer items-center gap-3 py-3 text-sm">
                        <input
                          type="checkbox"
                          checked={selTemp.includes(p.id)}
                          onChange={() => toggleProveedorTemp(p.id)}
                          className="h-4 w-4 rounded border-zinc-300"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-zinc-800">{p.razonSocial}</span>
                          <span className="ml-2 text-zinc-400">{p.rfc}</span>
                        </span>
                        {puedeToggleMateriales && proveedorTieneMateriales(p) && (
                          <IconCheck
                            className="h-4 w-4 shrink-0 text-emerald-600"
                            title="Tiene los materiales de esta licitación"
                          />
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.estado === "Activo"
                              ? "bg-green-100 text-green-700"
                              : "bg-zinc-100 text-zinc-500"
                          }`}
                        >
                          {p.estado}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-between border-t border-zinc-200 px-5 py-4">
              <span className="text-sm text-zinc-500">
                {selTemp.length === 0
                  ? "Ningún proveedor seleccionado"
                  : `${selTemp.length} proveedor${selTemp.length !== 1 ? "es" : ""} seleccionado${selTemp.length !== 1 ? "s" : ""}`}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalProveedoresAbierto(false)}
                  className={BTN_SECUNDARIO}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarProveedores}
                  className={BTN_PRIMARIO}
                >
                  Confirmar selección
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Instrucciones ──────────────────────────────────────────────── */}
      {modalInstruccionesAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="flex w-full max-w-xl flex-col rounded-xl bg-white shadow-xl"
            style={{ maxHeight: "85vh" }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-5 py-4">
              <h2 className="text-base font-semibold text-zinc-900">
                Instrucciones de licitación
              </h2>
              <button
                type="button"
                onClick={() => setModalInstruccionesAbierto(false)}
                className="rounded-md p-1 text-zinc-400 hover:text-zinc-700"
              >
                <IconX className="h-5 w-5" />
              </button>
            </div>

            <div
              className="flex-1 space-y-5 overflow-y-auto px-5 py-4"
              style={{ minHeight: 0 }}
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium text-zinc-700">
                    Mensaje para los proveedores invitados
                  </label>
                  {!confirmarRestablecerInstrucciones && (
                    <button
                      type="button"
                      onClick={() => setConfirmarRestablecerInstrucciones(true)}
                      className="flex shrink-0 items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600"
                    >
                      <IconRefresh className="h-3.5 w-3.5" />
                      Restablecer predeterminado
                    </button>
                  )}
                </div>
                {confirmarRestablecerInstrucciones && (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                    <p className="text-xs text-zinc-600">
                      ¿Restablecer las instrucciones al texto predeterminado? Se perderán los cambios actuales.
                    </p>
                    <div className="flex shrink-0 gap-3">
                      <button
                        type="button"
                        onClick={() => setConfirmarRestablecerInstrucciones(false)}
                        className="text-xs text-zinc-500 hover:text-zinc-700"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setInstruccionesTemp(generarPlantilla());
                          setConfirmarRestablecerInstrucciones(false);
                        }}
                        className="text-xs font-medium text-zinc-700 hover:text-zinc-900"
                      >
                        Restablecer
                      </button>
                    </div>
                  </div>
                )}
                <textarea
                  rows={8}
                  value={instruccionesTemp}
                  onChange={(e) => setInstruccionesTemp(e.target.value)}
                  placeholder="Escribe las instrucciones, condiciones y detalles que recibirán los proveedores al ser invitados…"
                  className="w-full resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-zinc-700">Archivos adjuntos</p>
                <p className="text-xs text-zinc-500">
                  Especificaciones técnicas, planos, condiciones de compra u otros documentos de
                  referencia.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => {
                    if (!e.target.files) return;
                    setArchivosTemp((prev) => [...prev, ...Array.from(e.target.files!)]);
                    e.target.value = "";
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  <IconUpload className="h-4 w-4" />
                  Seleccionar archivos
                </button>
                {archivosTemp.length > 0 && (
                  <ul className="space-y-1.5">
                    {archivosTemp.map((archivo, i) => (
                      <li
                        key={`${archivo.name}-${i}`}
                        className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-sm"
                      >
                        <span className="flex min-w-0 items-center gap-2 text-zinc-700">
                          <IconFile className="h-4 w-4 shrink-0 text-zinc-400" />
                          <span className="truncate">{archivo.name}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => quitarArchivoTemp(i)}
                          aria-label={`Quitar ${archivo.name}`}
                          className="ml-2 shrink-0 text-zinc-400 hover:text-zinc-700"
                        >
                          <IconX className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setModalInstruccionesAbierto(false)}
                className={BTN_SECUNDARIO}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarInstrucciones}
                className={BTN_PRIMARIO}
              >
                Guardar instrucciones
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Confirmar cambio de fecha ─────────────────────────────────── */}
      {modalConfirmarFecha && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-md flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <h2 className="text-base font-semibold text-zinc-900">Cambiar fecha de inicio</h2>
              <button
                type="button"
                onClick={() => setModalConfirmarFecha(false)}
                className="rounded-md p-1 text-zinc-400 hover:text-zinc-700"
              >
                <IconX className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-5">
              <div className="flex items-start gap-3">
                <IconAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <p className="text-sm text-zinc-700">
                  Al cambiar la fecha de inicio a una hora futura, la licitación volverá a estado{" "}
                  <strong>Programada</strong> y se reiniciarán las rondas. ¿Deseas continuar?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setModalConfirmarFecha(false)}
                className={BTN_SECUNDARIO}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardando !== null}
                onClick={async () => {
                  setModalConfirmarFecha(false);
                  await ejecutarGuardar();
                }}
                className={`${BTN_PRIMARIO} disabled:opacity-60`}
              >
                {guardando === "edicion" ? "Guardando…" : "Sí, cambiar fecha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Campo helper ───────────────────────────────────────────────────────────────

function Campo({
  label,
  required,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1 text-sm ${className ?? ""}`}>
      <span className="font-medium text-zinc-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {error && <p className="mt-0.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}
