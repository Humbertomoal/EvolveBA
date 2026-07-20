-- AlterTable
ALTER TABLE "Proveedor" ADD COLUMN     "catalogoValidado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalogoValidadoEn" TIMESTAMP(3),
ADD COLUMN     "catalogoValidadoPor" TEXT;
