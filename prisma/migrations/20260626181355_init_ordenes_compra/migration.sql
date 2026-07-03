-- CreateTable
CREATE TABLE "OrdenCompra" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "licitacionId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'Pendiente',
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEstimadaEntrega" TIMESTAMP(3),
    "clienteId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdenCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenCompraLinea" (
    "id" TEXT NOT NULL,
    "ordenCompraId" TEXT NOT NULL,
    "asignacionId" TEXT NOT NULL,
    "productoNombre" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "unidadMedida" TEXT NOT NULL,
    "precioUnitario" DOUBLE PRECISION NOT NULL,
    "fechaEntregaObjetivo" TIMESTAMP(3),
    "fechaEstimadaProveedor" TIMESTAMP(3),
    "subtotal" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrdenCompraLinea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrdenCompra_numero_key" ON "OrdenCompra"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenCompraLinea_asignacionId_key" ON "OrdenCompraLinea"("asignacionId");

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_licitacionId_fkey" FOREIGN KEY ("licitacionId") REFERENCES "Licitacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompraLinea" ADD CONSTRAINT "OrdenCompraLinea_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "OrdenCompra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompraLinea" ADD CONSTRAINT "OrdenCompraLinea_asignacionId_fkey" FOREIGN KEY ("asignacionId") REFERENCES "AsignacionMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
