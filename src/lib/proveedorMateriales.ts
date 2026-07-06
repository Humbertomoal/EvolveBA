import { prisma } from "@/src/lib/prisma";

export async function sincronizarMaterialesDB(
  proveedorId: string,
  productoIds: string[]
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
      prisma.proveedorMaterial.create({ data: { proveedorId, productoId } })
    ),
  ]);
}

export async function getMaterialesProveedor(
  proveedorId: string
): Promise<string[]> {
  const rows = await prisma.proveedorMaterial.findMany({
    where: { proveedorId },
    select: { productoId: true },
  });
  return rows.map((r: any) => r.productoId);
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
