-- AlterTable
ALTER TABLE "Licitacion" ADD COLUMN     "esperandoDecision" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inicioRondaActual" TIMESTAMP(3);
