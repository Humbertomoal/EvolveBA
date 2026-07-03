-- AlterTable
ALTER TABLE "AsignacionMaterial" ADD COLUMN     "moneda" TEXT NOT NULL DEFAULT 'MXN';

-- AlterTable
ALTER TABLE "LicitacionItem" ADD COLUMN     "moneda" TEXT NOT NULL DEFAULT 'MXN';

-- AlterTable
ALTER TABLE "OfertaItem" ADD COLUMN     "moneda" TEXT NOT NULL DEFAULT 'MXN';

-- AlterTable
ALTER TABLE "OrdenCompraLinea" ADD COLUMN     "moneda" TEXT NOT NULL DEFAULT 'MXN';
