-- AlterTable
ALTER TABLE "OrdenCompra" ADD COLUMN     "fechaCancelada" TIMESTAMP(3),
ADD COLUMN     "fechaEnTransito" TIMESTAMP(3),
ADD COLUMN     "fechaEntregada" TIMESTAMP(3),
ADD COLUMN     "fechaPendiente" TIMESTAMP(3),
ADD COLUMN     "fechaRecibida" TIMESTAMP(3);
