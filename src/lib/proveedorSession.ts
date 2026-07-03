import { cookies } from "next/headers";
import { prisma } from "./prisma";

export const PROVEEDOR_COOKIE = "cyrgo_proveedor_id";

/**
 * Returns the proveedorId to use for the current proveedor view.
 * Reads from the test-mode cookie; falls back to the first active proveedor.
 */
export async function getProveedorIdActual(): Promise<string> {
  const store = await cookies();
  const id = store.get(PROVEEDOR_COOKIE)?.value;
  if (id) return id;
  const p = await prisma.proveedor.findFirst({
    where: { eliminado: false },
    select: { id: true },
  });
  return p?.id ?? "";
}
