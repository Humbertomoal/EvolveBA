-- Grupos de partidas · rama grupos-partidas · paso (a)
-- Estado: APLICADO en Supabase; verificación 12/12 en true.
-- Se corre a mano en el editor SQL de Supabase (aquí no se usa prisma migrate).

-- ═══════════════════════════════════════════════════════════════════════════
-- Grupos de partidas — ROLLBACK
-- Deja la base como antes de APLICAR. Se NIEGA a correr si ya hay datos de
-- grupos (grupos creados, partidas con grupo u OC con snapshot de grupo):
-- en ese caso borraría información real. Todo o nada.
--
-- IMPORTANTE: antes de correrlo, el código desplegado NO debe usar estas
-- columnas (revertir el código primero), o la app fallará al leerlas.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

DO $$
DECLARE
  n_grupos INT; n_items INT; n_oc INT;
BEGIN
  SELECT count(*) INTO n_grupos FROM "LicitacionGrupo";
  SELECT count(*) INTO n_items  FROM "LicitacionItem"   WHERE "grupoId" IS NOT NULL;
  SELECT count(*) INTO n_oc     FROM "OrdenCompraLinea" WHERE "grupoNombre" IS NOT NULL OR "grupoDomicilio" IS NOT NULL;
  IF n_grupos > 0 OR n_items > 0 OR n_oc > 0 THEN
    RAISE EXCEPTION 'Rollback cancelado: hay datos de grupos (grupos=%, partidas con grupo=%, líneas de OC con grupo=%).',
      n_grupos, n_items, n_oc;
  END IF;
END $$;

ALTER TABLE "OrdenCompraLinea" DROP COLUMN "grupoDomicilio", DROP COLUMN "grupoNombre";

ALTER TABLE "LicitacionItem" DROP CONSTRAINT "LicitacionItem_grupoId_fkey";
DROP INDEX "LicitacionItem_grupoId_idx";
ALTER TABLE "LicitacionItem" DROP COLUMN "grupoId";

DROP TABLE "LicitacionGrupo";   -- arrastra su PK, índice, CHECK y FK a Licitacion

COMMIT;
