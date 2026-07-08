import { prisma } from "@/src/lib/prisma";

export async function sincronizarMaterialesDB(
  proveedorId: string,
  productoIds: string[],
  familias: string[] = []
): Promise<void> {
  const existentes = await prisma.proveedorMaterial.findMany({
    where: { proveedorId },
    select: { id: true, productoId: true },
  });

  const existentesIds = existentes.map((e) => e.productoId);
  const nuevosIds = productoIds.filter((id) => !existentesIds.includes(id));
  const aEliminar = existentes
    .filter((e) => !productoIds.includes(e.productoId))
    .map((e) => e.id);

  await prisma.$transaction([
    prisma.proveedorMaterial.deleteMany({ where: { id: { in: aEliminar } } }),
    ...nuevosIds.map((productoId) =>
      prisma.proveedorMaterial.create({
        data: { proveedorId, productoId },
        select: { id: true },
      })
    ),
  ]);

  await prisma.proveedorMaterial.updateMany({
    where: { proveedorId },
    data: { familias: familias.length > 0 ? JSON.stringify(familias) : null },
  });
}

export async function getMaterialesProveedor(
  proveedorId: string
): Promise<string[]> {
  const rows = await prisma.proveedorMaterial.findMany({
    where: { proveedorId },
    select: { productoId: true },
  });
  return rows.map((r) => r.productoId);
}

export async function getMapaProveedorMateriales(): Promise<
  Record<string, string[]>
> {
  const rows = await prisma.proveedorMaterial.findMany({
    select: { proveedorId: true, productoId: true },
  });
  return rows.reduce(
    (acc, r) => {
      if (!acc[r.proveedorId]) acc[r.proveedorId] = [];
      acc[r.proveedorId].push(r.productoId);
      return acc;
    },
    {} as Record<string, string[]>
  );
}

// Reads back the families assigned to a proveedor (stamped by sincronizarMaterialesDB).
export async function getFamiliasProveedor(proveedorId: string): Promise<string[]> {
  const row = await prisma.proveedorMaterial.findFirst({
    where: { proveedorId },
    select: { familias: true },
  });
  if (!row?.familias) return [];
  const parsed = JSON.parse(row.familias);
  return Array.isArray(parsed) ? parsed : [];
}
