/*
  Warnings:

  - A unique constraint covering the columns `[usuarioId]` on the table `Proveedor` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Proveedor" ADD COLUMN     "usuarioId" TEXT;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "emailVerificado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "primerAcceso" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tipoUsuario" TEXT NOT NULL DEFAULT 'comprador';

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_usuarioId_key" ON "Proveedor"("usuarioId");

-- AddForeignKey
ALTER TABLE "Proveedor" ADD CONSTRAINT "Proveedor_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
