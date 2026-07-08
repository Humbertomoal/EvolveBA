"use client";

import { IconPencil, IconPlus, IconSearch } from "@tabler/icons-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  EstadoProveedor,
  Proveedor,
  TipoPersona,
} from "@/src/data/proveedores";
import PanelFiltros from "@/app/_components/PanelFiltros";
import type { SeccionFiltroConfig } from "@/app/_components/PanelFiltros";
import { usePageTitle } from "@/app/_components/PageHeaderContext";
import EmptyState from "@/src/components/EmptyState";

const ETIQUETA_TIPO_PERSONA: Record<TipoPersona, string> = {
  Fisica: "Física",
  Moral: "Moral",
};

function BadgeEstado({ estado }: { estado: EstadoProveedor }) {
  const esActivo = estado === "Activo";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        esActivo ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-600"
      }`}
    >
      {estado}
    </span>
  );
}

export default function ProveedoresTabla({
  proveedores,
  basePath,
}: {
  proveedores: Proveedor[];
  basePath: string;
}) {
  usePageTitle("Administración de Proveedores");
  const [busqueda, setBusqueda] = useState("");
  const [tiposPersona, setTiposPersona] = useState<string[]>([]);
  const [estados, setEstados] = useState<string[]>([]);

  function toggleTipoPersona(value: string) {
    setTiposPersona((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  }

  function toggleEstado(value: string) {
    setEstados((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value]
    );
  }

  function limpiarFiltros() {
    setTiposPersona([]);
    setEstados([]);
  }

  const secciones: SeccionFiltroConfig[] = [
    {
      titulo: "Tipo de Persona",
      opciones: [
        { label: "Física", value: "Fisica" },
        { label: "Moral", value: "Moral" },
      ],
      seleccionados: tiposPersona,
      onToggle: toggleTipoPersona,
    },
    {
      titulo: "Estado",
      opciones: [
        { label: "Activo", value: "Activo" },
        { label: "Inactivo", value: "Inactivo" },
      ],
      seleccionados: estados,
      onToggle: toggleEstado,
    },
  ];

  const proveedoresFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return proveedores.filter((proveedor) => {
      const coincideTexto =
        texto === "" ||
        proveedor.razonSocial.toLowerCase().includes(texto) ||
        proveedor.rfc.toLowerCase().includes(texto) ||
        proveedor.contactoAdminNombre.toLowerCase().includes(texto);

      const coincideTipo =
        tiposPersona.length === 0 || tiposPersona.includes(proveedor.tipoPersona);

      const coincideEstado =
        estados.length === 0 || estados.includes(proveedor.estado);

      return coincideTexto && coincideTipo && coincideEstado;
    });
  }, [proveedores, busqueda, tiposPersona, estados]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Link
          href={`${basePath}/comprador/proveedores/nuevo`}
          className="flex items-center gap-2 rounded-md bg-[var(--color-primario)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-secundario)] transition-colors duration-150"
        >
          <IconPlus className="h-4 w-4" />
          Agregar proveedor
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por razón social, RFC o contacto"
            className="w-full rounded-md border border-zinc-300 py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <PanelFiltros secciones={secciones} onLimpiar={limpiarFiltros} />
      </div>

      <div className="rounded-card border border-border bg-white shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                <th className="px-4 py-3 font-medium">Razón Social</th>
                <th className="px-4 py-3 font-medium">Nombre Contacto Admin</th>
                <th className="px-4 py-3 font-medium">Correo Contacto Admin</th>
                <th className="px-4 py-3 font-medium">Tipo de Persona</th>
                <th className="px-4 py-3 font-medium">RFC</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {proveedoresFiltrados.map((proveedor) => (
                <tr key={proveedor.id} className="hover:bg-zinc-50/50 transition-colors duration-150">
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {proveedor.razonSocial}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {proveedor.contactoAdminNombre}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {proveedor.contactoAdminCorreo}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {ETIQUETA_TIPO_PERSONA[proveedor.tipoPersona]}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{proveedor.rfc}</td>
                  <td className="px-4 py-3">
                    <BadgeEstado estado={proveedor.estado} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`${basePath}/comprador/proveedores/${proveedor.id}/editar`}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-zinc-600 hover:bg-zinc-100"
                      aria-label={`Editar ${proveedor.razonSocial}`}
                    >
                      <IconPencil className="h-4 w-4" />
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
              {proveedoresFiltrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-2">
                    {proveedores.length === 0 ? (
                      <EmptyState
                        icon="IconUsers"
                        title="Aún no tienes proveedores registrados"
                        description="Agrega tu primer proveedor para comenzar a asignarle licitaciones."
                      />
                    ) : (
                      <EmptyState
                        icon="IconSearchOff"
                        title="Sin resultados"
                        description="No se encontraron proveedores con los filtros aplicados."
                      />
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
