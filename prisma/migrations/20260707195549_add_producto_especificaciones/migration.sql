-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "archivosEspecificaciones" TEXT,
ADD COLUMN     "especificacionesTecnicas" TEXT,
ADD COLUMN     "monedaPredeterminada" TEXT;

-- AlterTable
ALTER TABLE "Proveedor" ADD COLUMN     "domicilioComercial" TEXT;
