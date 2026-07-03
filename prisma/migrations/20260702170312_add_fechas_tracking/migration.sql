-- AlterTable
ALTER TABLE "Licitacion" ADD COLUMN     "fechaCancelada" TIMESTAMP(3),
ADD COLUMN     "fechaCerrada" TIMESTAMP(3),
ADD COLUMN     "fechaEsperandoDecision" TIMESTAMP(3),
ADD COLUMN     "fechaFinReal" TIMESTAMP(3),
ADD COLUMN     "fechaFinalizada" TIMESTAMP(3),
ADD COLUMN     "fechaInicioLicitacion" TIMESTAMP(3);
