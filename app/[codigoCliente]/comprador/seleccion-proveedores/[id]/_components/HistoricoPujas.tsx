"use client";

import {
  IconChevronDown,
  IconChevronUp,
  IconDownload,
  IconHistory,
  IconLoader2,
} from "@tabler/icons-react";
import { useState, useTransition } from "react";
import Badge from "@/src/components/Badge";
import { formatFechaMexico } from "@/src/lib/dateUtils";
import { formatImporte } from "@/src/lib/monedas";
import {
  getHistoricoPujas,
  type FilaHistoricoPuja,
} from "@/src/lib/historicoPujasActions";

const TODOS_LOS_PROVEEDORES = "";
const TODAS_LAS_RONDAS = "";

function nombreArchivoSeguro(texto: string): string {
  return texto.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

export default function HistoricoPujas({
  licitacionId,
  licitacionNumero,
  proveedoresParticipantes,
}: {
  licitacionId: string;
  licitacionNumero: string;
  proveedoresParticipantes: { id: string; nombre: string }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [pending, startTransition] = useTransition();

  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<string>(
    proveedoresParticipantes[0]?.id ?? TODOS_LOS_PROVEEDORES
  );
  const [rondaSeleccionada, setRondaSeleccionada] = useState<number | "">(
    TODAS_LAS_RONDAS
  );
  const [rondasDisponibles, setRondasDisponibles] = useState<number[]>([]);
  const [filas, setFilas] = useState<FilaHistoricoPuja[]>([]);
  const [truncado, setTruncado] = useState(false);

  function cargarDatos(proveedorId: string, ronda: number | "") {
    startTransition(async () => {
      const resultado = await getHistoricoPujas(
        licitacionId,
        proveedorId || undefined,
        ronda === "" ? undefined : ronda
      );
      setFilas(resultado.filas);
      setTruncado(resultado.truncado);
      if (ronda === TODAS_LAS_RONDAS) {
        const rondas = Array.from(
          new Set(resultado.filas.map((f) => f.ronda))
        ).sort((a, b) => a - b);
        setRondasDisponibles(rondas);
      }
      setCargado(true);
    });
  }

  function handleAbrir() {
    const siguiente = !abierto;
    setAbierto(siguiente);
    if (siguiente && !cargado) {
      cargarDatos(proveedorSeleccionado, rondaSeleccionada);
    }
  }

  function handleCambiarProveedor(id: string) {
    setProveedorSeleccionado(id);
    setRondaSeleccionada(TODAS_LAS_RONDAS);
    cargarDatos(id, TODAS_LAS_RONDAS);
  }

  function handleCambiarRonda(valor: string) {
    const ronda = valor === "" ? "" : Number(valor);
    setRondaSeleccionada(ronda);
    cargarDatos(proveedorSeleccionado, ronda);
  }

  function handleDescargarExcel() {
    import("xlsx").then((XLSX) => {
      const modoTodos = proveedorSeleccionado === TODOS_LOS_PROVEEDORES;
      const filasExcel = filas.map((f) => ({
        Ronda: `R${f.ronda}`,
        ...(modoTodos ? { Proveedor: f.proveedorNombre } : {}),
        Material: f.productoNombre,
        "Cantidad ofertada": f.cantidadDisponible,
        "Precio unitario": `${formatImporte(f.precioUnitario, f.moneda)}`,
        Subtotal: `${formatImporte(f.subtotal, f.moneda)}`,
        "¿Cumple fecha?": f.puedeCumplirFecha ? "Sí" : "No",
        "Fecha estimada de entrega": formatFechaMexico(f.fechaEstimadaEntrega),
        "Fecha/hora de la puja": formatFechaMexico(f.fechaPuja, {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      }));

      const hoja = XLSX.utils.json_to_sheet(filasExcel);
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, "Histórico");

      const sufijoProveedor = modoTodos
        ? "Todos"
        : nombreArchivoSeguro(
            proveedoresParticipantes.find((p) => p.id === proveedorSeleccionado)
              ?.nombre ?? "Proveedor"
          );

      XLSX.writeFile(
        libro,
        `Historico_Licitacion-${nombreArchivoSeguro(licitacionNumero)}_${sufijoProveedor}.xlsx`
      );
    });
  }

  const modoTodos = proveedorSeleccionado === TODOS_LOS_PROVEEDORES;

  return (
    <div className="rounded-card border border-border bg-white shadow-card overflow-hidden">
      <button
        type="button"
        onClick={handleAbrir}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors duration-150 hover:bg-zinc-50/50"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-zinc-700">
          <IconHistory className="h-4 w-4 text-zinc-400" />
          Ver histórico de pujas
        </span>
        {abierto ? (
          <IconChevronUp className="h-4 w-4 text-zinc-400" />
        ) : (
          <IconChevronDown className="h-4 w-4 text-zinc-400" />
        )}
      </button>

      {abierto && (
        <div className="border-t border-border px-4 py-4">
          {/* Toolbar */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-zinc-500">
                Proveedor
              </label>
              <select
                value={proveedorSeleccionado}
                onChange={(e) => handleCambiarProveedor(e.target.value)}
                className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {proveedoresParticipantes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
                <option value={TODOS_LOS_PROVEEDORES}>
                  Ver todos los proveedores
                </option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-zinc-500">
                Ronda
              </label>
              <select
                value={rondaSeleccionada}
                onChange={(e) => handleCambiarRonda(e.target.value)}
                className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Todas las rondas</option>
                {rondasDisponibles.map((r) => (
                  <option key={r} value={r}>
                    R{r}
                  </option>
                ))}
              </select>
            </div>

            {pending && (
              <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                Cargando…
              </span>
            )}

            <button
              type="button"
              onClick={handleDescargarExcel}
              disabled={pending || filas.length === 0}
              className="ml-auto flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconDownload className="h-4 w-4" />
              Descargar Excel
            </button>
          </div>

          {truncado && (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Se muestran los primeros 500 registros. Filtra por proveedor o
              ronda para ver el resto.
            </p>
          )}

          {/* Tabla */}
          <div className="overflow-x-auto rounded-md border border-zinc-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-surface-muted text-left text-xs font-medium text-zinc-500">
                  <th className="px-3 py-2">Ronda</th>
                  {modoTodos && <th className="px-3 py-2">Proveedor</th>}
                  <th className="px-3 py-2">Material</th>
                  <th className="px-3 py-2 text-right">Cant. ofertada</th>
                  <th className="px-3 py-2 text-right">Precio unit.</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                  <th className="px-3 py-2 text-center">¿Cumple fecha?</th>
                  <th className="px-3 py-2">Fecha estimada</th>
                  <th className="px-3 py-2">Fecha/hora de la puja</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filas.length === 0 && !pending ? (
                  <tr>
                    <td
                      colSpan={modoTodos ? 9 : 8}
                      className="px-3 py-6 text-center text-sm text-zinc-400"
                    >
                      Sin pujas registradas para este filtro.
                    </td>
                  </tr>
                ) : (
                  filas.map((f, i) => (
                    <tr
                      key={`${f.ronda}-${f.proveedorId}-${i}`}
                      className="hover:bg-zinc-50/50 transition-colors duration-150"
                    >
                      <td className="px-3 py-2">
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600">
                          R{f.ronda}
                        </span>
                      </td>
                      {modoTodos && (
                        <td className="px-3 py-2 text-zinc-700">
                          {f.proveedorNombre}
                        </td>
                      )}
                      <td className="px-3 py-2 text-zinc-700">
                        {f.productoNombre}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-600">
                        {f.cantidadDisponible}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-600">
                        {formatImporte(f.precioUnitario, f.moneda)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-zinc-800">
                        {formatImporte(f.subtotal, f.moneda)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant={f.puedeCumplirFecha ? "success" : "danger"}>
                          {f.puedeCumplirFecha ? "Sí" : "No"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-zinc-500">
                        {formatFechaMexico(f.fechaEstimadaEntrega)}
                      </td>
                      <td className="px-3 py-2 text-zinc-500">
                        {formatFechaMexico(f.fechaPuja, {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
