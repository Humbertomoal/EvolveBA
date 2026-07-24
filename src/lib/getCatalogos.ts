import { prisma } from "./prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export type CatalogoOpcion = {
  codigo: string;
  nombre: string;
  simbolo?: string | null;
};

export type CatalogoValorDTO = {
  id: string;
  tipo: string;
  codigo: string;
  nombre: string;
  simbolo: string | null;
  activo: boolean;
  orden: number;
  // Solo tipo == "MONEDA" (≠ MXN): tasa a MXN y su última actualización (ISO).
  tipoCambio: number | null;
  tipoCambioActualizado: string | null;
};

export async function getCatalogosActivos(
  tipo: string,
  clienteId = "default"
): Promise<CatalogoOpcion[]> {
  try {
    return await db.catalogoValor.findMany({
      where: { tipo, clienteId, activo: true },
      orderBy: { orden: "asc" },
      select: { codigo: true, nombre: true, simbolo: true },
    });
  } catch {
    return [];
  }
}

export async function getTodosLosCatalogos(clienteId = "default"): Promise<CatalogoValorDTO[]> {
  try {
    const rows = await db.catalogoValor.findMany({
      where: { clienteId },
      orderBy: [{ tipo: "asc" }, { orden: "asc" }],
    });
    // Normaliza a DTO serializable (fecha → ISO) para el client component.
    return rows.map((v: any) => ({
      id: v.id,
      tipo: v.tipo,
      codigo: v.codigo,
      nombre: v.nombre,
      simbolo: v.simbolo ?? null,
      activo: v.activo,
      orden: v.orden,
      tipoCambio: v.tipoCambio ?? null,
      tipoCambioActualizado: v.tipoCambioActualizado
        ? new Date(v.tipoCambioActualizado).toISOString()
        : null,
    }));
  } catch {
    return [];
  }
}

/**
 * Tipos de cambio actuales de Settings (CatalogoValor tipo "MONEDA", ≠ MXN con
 * tasa > 0), como mapa { USD: 17.2 }. Es lo que hereda una licitación al crearse.
 */
export async function getTiposCambioActuales(
  clienteId = "default"
): Promise<Record<string, number>> {
  try {
    const rows = await db.catalogoValor.findMany({
      where: { tipo: "MONEDA", clienteId },
      select: { codigo: true, tipoCambio: true },
    });
    const out: Record<string, number> = {};
    for (const r of rows as { codigo: string; tipoCambio: number | null }[]) {
      if (r.codigo !== "MXN" && typeof r.tipoCambio === "number" && r.tipoCambio > 0) {
        out[r.codigo] = r.tipoCambio;
      }
    }
    return out;
  } catch {
    return {};
  }
}
