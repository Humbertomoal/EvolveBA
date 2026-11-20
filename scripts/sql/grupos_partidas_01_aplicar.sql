-- Grupos de partidas · rama grupos-partidas · paso (a)
-- Estado: APLICADO en Supabase; verificación 12/12 en true.
-- Se corre a mano en el editor SQL de Supabase (aquí no se usa prisma migrate).

-- ═══════════════════════════════════════════════════════════════════════════
-- Grupos de partidas (proyecto/sitio) — APLICAR
-- Aditivo: no modifica ni borra datos existentes. Todo o nada (una transacción).
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

-- Precondición: nada de esto existe todavía. Si ya se corrió, aborta sin tocar nada.
DO $$
BEGIN
  IF to_regclass('public."LicitacionGrupo"') IS NOT NULL THEN
    RAISE EXCEPTION 'LicitacionGrupo ya existe: este script ya se aplicó.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'LicitacionItem' AND column_name = 'grupoId') THEN
    RAISE EXCEPTION 'LicitacionItem.grupoId ya existe: este script ya se aplicó.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'OrdenCompraLinea'
               AND column_name IN ('grupoNombre', 'grupoDomicilio')) THEN
    RAISE EXCEPTION 'OrdenCompraLinea.grupoNombre/grupoDomicilio ya existe: este script ya se aplicó.';
  END IF;
END $$;

-- 1. Tabla de grupos
CREATE TABLE "LicitacionGrupo" (
    "id"           TEXT             NOT NULL,
    "licitacionId" TEXT             NOT NULL,
    "nombre"       TEXT             NOT NULL,
    "domicilio"    TEXT,
    "latitud"      DOUBLE PRECISION,
    "longitud"     DOUBLE PRECISION,
    "orden"        INTEGER          NOT NULL,
    "eliminado"    BOOLEAN          NOT NULL DEFAULT false,
    "eliminadoEn"  TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3)     NOT NULL,
    CONSTRAINT "LicitacionGrupo_pkey" PRIMARY KEY ("id"),
    -- Latitud y longitud van las dos o ninguna, y dentro de rango.
    CONSTRAINT "grupo_coordenadas_coherentes" CHECK (
          ("latitud" IS NULL) = ("longitud" IS NULL)
      AND ("latitud"  IS NULL OR "latitud"  BETWEEN -90  AND 90)
      AND ("longitud" IS NULL OR "longitud" BETWEEN -180 AND 180)
    )
);

CREATE INDEX "LicitacionGrupo_licitacionId_orden_idx" ON "LicitacionGrupo"("licitacionId", "orden");

ALTER TABLE "LicitacionGrupo" ADD CONSTRAINT "LicitacionGrupo_licitacionId_fkey"
  FOREIGN KEY ("licitacionId") REFERENCES "Licitacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Igual que Usuario/Rol/RolPermiso/CatalogoValor: RLS activo sin políticas.
-- Bloquea el acceso por la API REST de Supabase (anon/authenticated); Prisma
-- conecta como `postgres` (bypassrls) y no se ve afectado.
ALTER TABLE "LicitacionGrupo" ENABLE ROW LEVEL SECURITY;

-- 2. Grupo de cada partida (null = sin grupo; todo lo histórico queda en null)
ALTER TABLE "LicitacionItem" ADD COLUMN "grupoId" TEXT;

CREATE INDEX "LicitacionItem_grupoId_idx" ON "LicitacionItem"("grupoId");

ALTER TABLE "LicitacionItem" ADD CONSTRAINT "LicitacionItem_grupoId_fkey"
  FOREIGN KEY ("grupoId") REFERENCES "LicitacionGrupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Snapshot del grupo en la línea de OC
ALTER TABLE "OrdenCompraLinea"
  ADD COLUMN "grupoNombre"    TEXT,
  ADD COLUMN "grupoDomicilio" TEXT;

COMMIT;
