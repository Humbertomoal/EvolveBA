-- CreateTable
CREATE TABLE "Proveedor" (
    "id" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "vendedorNombre" TEXT,
    "vendedorCelular" TEXT,
    "vendedorCorreo" TEXT,
    "contactoAdminNombre" TEXT NOT NULL,
    "contactoAdminTelefono" TEXT,
    "contactoAdminCorreo" TEXT NOT NULL,
    "tipoPersona" TEXT NOT NULL,
    "rfc" TEXT NOT NULL,
    "domicilio" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'Activo',
    "clienteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_rfc_key" ON "Proveedor"("rfc");
