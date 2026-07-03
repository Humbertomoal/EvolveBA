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
    return await db.catalogoValor.findMany({
      where: { clienteId },
      orderBy: [{ tipo: "asc" }, { orden: "asc" }],
    });
  } catch {
    return [];
  }
}
