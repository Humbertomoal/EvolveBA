-- CreateTable
CREATE TABLE "ProveedorMaterial" (
    "id" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProveedorMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProveedorMaterial_proveedorId_productoId_key" ON "ProveedorMaterial"("proveedorId", "productoId");

-- AddForeignKey
ALTER TABLE "ProveedorMaterial" ADD CONSTRAINT "ProveedorMaterial_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProveedorMaterial" ADD CONSTRAINT "ProveedorMaterial_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
