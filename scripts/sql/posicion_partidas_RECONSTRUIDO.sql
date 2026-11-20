-- ═══════════════════════════════════════════════════════════════════════════
-- LicitacionItem.posicion — SQL RECONSTRUIDO.  NO ES EL ORIGINAL.  NO CORRER.
--
-- Estado: YA APLICADO en Supabase (septiembre de 2026, commit 0051fdf
-- "orden explicito de partidas (posicion) y reordenar con botones
-- subir/bajar"). El SQL original no se conservó en el repo ni en git.
--
-- Este archivo se reconstruyó el 2026-11-19 leyendo el estado REAL de la base
-- (information_schema, pg_indexes, pg_constraint) y existe solo como
-- REGISTRO: qué hay en la base y cómo se llegó ahí. Correrlo de nuevo FALLA
-- (la columna y el índice ya existen) y, si se forzara, el llenado
-- reescribiría el orden de todas las licitaciones.
--
-- ── Lo que es CIERTO (leído de la base) ─────────────────────────────────────
--   columna  "posicion"  integer  NOT NULL  DEFAULT 0
--   índice   "LicitacionItem_licitacionId_posicion_idx"
--            btree ("licitacionId", posicion)
--   sin CHECK ni UNIQUE sobre posicion (posiciones repetidas son posibles a
--   nivel base; el código las evita).
--
--   El DEFAULT 0 existe solo para el código desplegado en ese momento, que aún
--   no mandaba el campo. schema.prisma la declara SIN @default a propósito
--   (ver el comentario de LicitacionItem.posicion).
--
-- ── Lo que es INFERIDO (no hay registro del original) ───────────────────────
--   El llenado inicial. En 25 de 26 licitaciones, posicion coincide EXACTAMENTE
--   con  row_number() OVER (PARTITION BY "licitacionId" ORDER BY "createdAt", id) - 1
--   y la restante tiene huecos explicables por ediciones posteriores (partidas
--   borradas después del llenado). Eso indica que el original llenó con ese
--   criterio: orden de captura, base 0, `id` como desempate.
-- ═══════════════════════════════════════════════════════════════════════════

-- BEGIN;
--
-- ALTER TABLE "LicitacionItem" ADD COLUMN "posicion" INTEGER NOT NULL DEFAULT 0;
--
-- -- Llenado inicial (INFERIDO): orden de captura, base 0, desempate por id.
-- UPDATE "LicitacionItem" AS li
--    SET "posicion" = o.rn
--   FROM (
--     SELECT id,
--            (row_number() OVER (PARTITION BY "licitacionId" ORDER BY "createdAt", id) - 1)::int AS rn
--       FROM "LicitacionItem"
--   ) AS o
--  WHERE li.id = o.id;
--
-- CREATE INDEX "LicitacionItem_licitacionId_posicion_idx"
--   ON "LicitacionItem"("licitacionId", "posicion");
--
-- COMMIT;

-- ── Verificación (solo lectura; sí se puede correr) ─────────────────────────
SELECT 'columna posicion integer NOT NULL DEFAULT 0' AS chequeo,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'LicitacionItem'
                  AND column_name = 'posicion' AND data_type = 'integer'
                  AND is_nullable = 'NO' AND column_default = '0') AS ok
UNION ALL
SELECT 'índice LicitacionItem_licitacionId_posicion_idx',
       EXISTS (SELECT 1 FROM pg_indexes
                WHERE indexname = 'LicitacionItem_licitacionId_posicion_idx');
