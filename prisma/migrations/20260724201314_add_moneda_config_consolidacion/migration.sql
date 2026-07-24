-- AlterTable
ALTER TABLE "CatalogoValor" ADD COLUMN     "tipoCambio" DOUBLE PRECISION,
ADD COLUMN     "tipoCambioActualizado" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Licitacion" ADD COLUMN     "monedaConsolidacion" TEXT NOT NULL DEFAULT 'MXN';
