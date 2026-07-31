-- CreateTable
CREATE TABLE "LicitacionEstadoLog" (
    "id" TEXT NOT NULL,
    "licitacionId" TEXT NOT NULL,
    "estadoAnterior" TEXT,
    "estadoNuevo" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT,

    CONSTRAINT "LicitacionEstadoLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LicitacionEstadoLog_licitacionId_idx" ON "LicitacionEstadoLog"("licitacionId");

-- AddForeignKey
ALTER TABLE "LicitacionEstadoLog" ADD CONSTRAINT "LicitacionEstadoLog_licitacionId_fkey" FOREIGN KEY ("licitacionId") REFERENCES "Licitacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
