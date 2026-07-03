-- CreateTable
CREATE TABLE "Licitacion" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "jerarquia" TEXT,
    "tipoLicitacion" TEXT,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEjecucion" TIMESTAMP(3),
    "fechaInicioRangoEntrega" TIMESTAMP(3),
    "fechaFinRangoEntrega" TIMESTAMP(3),
    "costoObjetivo" DOUBLE PRECISION,
    "duracionRondaMinutos" INTEGER NOT NULL DEFAULT 1440,
    "maxRondas" INTEGER NOT NULL DEFAULT 3,
    "rondaActual" INTEGER NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'Borrador',
    "instrucciones" TEXT,
    "archivosAdjuntos" TEXT,
    "compradorId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Licitacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicitacionItem" (
    "id" TEXT NOT NULL,
    "licitacionId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "especificacion" TEXT,
    "fechaEntrega" TIMESTAMP(3),
    "cantidadSolicitada" DOUBLE PRECISION NOT NULL,
    "precioObjetivo" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicitacionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicitacionProveedor" (
    "id" TEXT NOT NULL,
    "licitacionId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "invitadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicitacionProveedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Licitacion_numero_key" ON "Licitacion"("numero");

-- AddForeignKey
ALTER TABLE "LicitacionItem" ADD CONSTRAINT "LicitacionItem_licitacionId_fkey" FOREIGN KEY ("licitacionId") REFERENCES "Licitacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicitacionItem" ADD CONSTRAINT "LicitacionItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicitacionProveedor" ADD CONSTRAINT "LicitacionProveedor_licitacionId_fkey" FOREIGN KEY ("licitacionId") REFERENCES "Licitacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicitacionProveedor" ADD CONSTRAINT "LicitacionProveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
