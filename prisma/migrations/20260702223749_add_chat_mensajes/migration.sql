-- CreateTable
CREATE TABLE "ChatMensaje" (
    "id" TEXT NOT NULL,
    "licitacionId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "emisor" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMensaje_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ChatMensaje" ADD CONSTRAINT "ChatMensaje_licitacionId_fkey" FOREIGN KEY ("licitacionId") REFERENCES "Licitacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMensaje" ADD CONSTRAINT "ChatMensaje_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
