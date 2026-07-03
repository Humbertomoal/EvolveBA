"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ProveedorInput } from "@/src/data/proveedores";
import { actualizarProveedor, crearProveedor } from "@/src/lib/proveedores";
import { sincronizarMaterialesDB } from "@/src/lib/proveedorMateriales";

function extraerDatos(formData: FormData): ProveedorInput {
  return {
    razonSocial: String(formData.get("razonSocial") ?? "").trim(),
    vendedorNombre: String(formData.get("vendedorNombre") ?? "").trim(),
    vendedorCelular: String(formData.get("vendedorCelular") ?? "").trim(),
    vendedorCorreo: String(formData.get("vendedorCorreo") ?? "").trim(),
    contactoAdminNombre: String(
      formData.get("contactoAdminNombre") ?? ""
    ).trim(),
    contactoAdminTelefono: String(
      formData.get("contactoAdminTelefono") ?? ""
    ).trim(),
    contactoAdminCorreo: String(
      formData.get("contactoAdminCorreo") ?? ""
    ).trim(),
    tipoPersona: formData.get("tipoPersona") === "Moral" ? "Moral" : "Fisica",
    rfc: String(formData.get("rfc") ?? "")
      .trim()
      .toUpperCase(),
    domicilio: String(formData.get("domicilio") ?? "").trim(),
    estado: formData.get("estado") === "Inactivo" ? "Inactivo" : "Activo",
  };
}

export async function crearProveedorAction(
  basePath: string,
  formData: FormData
) {
  const proveedor = await crearProveedor(extraerDatos(formData));
  const materialIds = formData.getAll("materialId") as string[];
  if (materialIds.length > 0) {
    await sincronizarMaterialesDB(proveedor.id, materialIds);
  }
  revalidatePath(`${basePath}/comprador/proveedores`);
  redirect(`${basePath}/comprador/proveedores`);
}

export async function actualizarProveedorAction(
  id: string,
  basePath: string,
  formData: FormData
) {
  await actualizarProveedor(id, extraerDatos(formData));
  const materialIds = formData.getAll("materialId") as string[];
  await sincronizarMaterialesDB(id, materialIds);
  revalidatePath(`${basePath}/comprador/proveedores`);
  redirect(`${basePath}/comprador/proveedores`);
}
