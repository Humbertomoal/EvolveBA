-- AlterTable
ALTER TABLE "Licitacion" ADD COLUMN     "importeVenta" DOUBLE PRECISION,
ADD COLUMN     "tiempoConfirmacionHoras" INTEGER NOT NULL DEFAULT 24;

-- CreateTable
CREATE TABLE "AsignacionMaterial" (
    "id" TEXT NOT NULL,
    "licitacionId" TEXT NOT NULL,
    "licitacionItemId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "cantidadAsignada" DOUBLE PRECISION NOT NULL,
    "precioUnitario" DOUBLE PRECISION NOT NULL,
    "ronda" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 1,
    "estatusProveedor" TEXT NOT NULL DEFAULT 'Pendiente',
    "fechaObjetivo" TIMESTAMP(3),
    "fechaEstimadaProveedor" TIMESTAMP(3),
    "fechaLimiteConfirmacion" TIMESTAMP(3),
    "fechaConfirmacion" TIMESTAMP(3),
    "motivoRechazo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AsignacionMaterial_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AsignacionMaterial" ADD CONSTRAINT "AsignacionMaterial_licitacionId_fkey" FOREIGN KEY ("licitacionId") REFERENCES "Licitacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionMaterial" ADD CONSTRAINT "AsignacionMaterial_licitacionItemId_fkey" FOREIGN KEY ("licitacionItemId") REFERENCES "LicitacionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionMaterial" ADD CONSTRAINT "AsignacionMaterial_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
