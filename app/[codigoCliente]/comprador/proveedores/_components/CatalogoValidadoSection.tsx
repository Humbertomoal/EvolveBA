"use client";

import { IconCheck, IconClockHour4 } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { marcarCatalogoValidadoAction } from "@/src/lib/proveedorMaterialesActions";
import type { AccesoProveedor, CatalogoValidado } from "@/src/lib/proveedores";
import { formatFechaMexico } from "@/src/lib/dateUtils";
import BotonEnviarCorreo from "@/src/components/BotonEnviarCorreo";

const BTN_SECUNDARIO =
  "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60";

export default function CatalogoValidadoSection({
  proveedorId,
  catalogoValidado,
  acceso,
  basePath,
  codigoCliente,
  nombreProveedor,
  nombreContacto,
  correoContacto,
}: {
  proveedorId: string;
  catalogoValidado: CatalogoValidado;
  acceso: AccesoProveedor | null;
  basePath: string;
  codigoCliente: string;
  nombreProveedor: string;
  nombreContacto: string;
  correoContacto: string;
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);

  async function handleToggle() {
    const nuevoValidado = !catalogoValidado.validado;
    setCargando(true);
    await marcarCatalogoValidadoAction(proveedorId, nuevoValidado, basePath);
    setCargando(false);
    toast.success(
      nuevoValidado ? "Catálogo marcado como validado" : "Catálogo marcado como pendiente"
    );
    router.refresh();
  }

  const puedeEnviarRecordatorio = !!acceso?.activo && !catalogoValidado.validado;
  const correoContactoValido = correoContacto.trim().length > 0;

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 p-4">
      <div className="flex flex-wrap items-center gap-3">
        {catalogoValidado.validado ? (
          <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            <IconCheck className="h-3.5 w-3.5" />
            Catálogo validado
            {catalogoValidado.validadoEn &&
              ` · ${formatFechaMexico(catalogoValidado.validadoEn)}`}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            <IconClockHour4 className="h-3.5 w-3.5" />
            Pendiente de validación
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleToggle}
          disabled={cargando}
          className={BTN_SECUNDARIO}
        >
          {catalogoValidado.validado
            ? "Marcar como pendiente"
            : "Marcar catálogo como validado"}
        </button>
        {puedeEnviarRecordatorio && (
          <BotonEnviarCorreo
            tipo="RECORDATORIO_PRODUCTOS"
            etiqueta="Enviar recordatorio de catálogo"
            codigoCliente={codigoCliente}
            variables={{
              nombreContacto,
              nombreProveedor,
              usuarioAcceso: acceso?.email ?? "",
              passwordTemporal: "(la que se te compartió al dar de alta tu acceso)",
            }}
            destinatarios={correoContactoValido ? [correoContacto] : []}
            deshabilitado={!correoContactoValido}
            tooltipDeshabilitado="Este proveedor no tiene un correo de contacto registrado."
          />
        )}
      </div>
    </div>
  );
}
