-- AlterTable
ALTER TABLE "Licitacion" ADD COLUMN     "eliminado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "eliminadoEn" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "eliminado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "eliminadoEn" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Proveedor" ADD COLUMN     "eliminado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "eliminadoEn" TIMESTAMP(3);
