-- CreateTable
CREATE TABLE "OfertaItem" (
    "id" TEXT NOT NULL,
    "licitacionItemId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "ronda" INTEGER NOT NULL DEFAULT 1,
    "precioUnitario" DOUBLE PRECISION NOT NULL,
    "cantidadDisponible" DOUBLE PRECISION NOT NULL,
    "puedeCumplirFecha" BOOLEAN NOT NULL DEFAULT true,
    "fechaEstimadaEntrega" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfertaItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OfertaItem_licitacionItemId_proveedorId_ronda_key" ON "OfertaItem"("licitacionItemId", "proveedorId", "ronda");

-- AddForeignKey
ALTER TABLE "OfertaItem" ADD CONSTRAINT "OfertaItem_licitacionItemId_fkey" FOREIGN KEY ("licitacionItemId") REFERENCES "LicitacionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfertaItem" ADD CONSTRAINT "OfertaItem_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
