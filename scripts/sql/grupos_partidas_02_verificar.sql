-- Grupos de partidas · rama grupos-partidas · paso (a)
-- Estado: APLICADO en Supabase; verificación 12/12 en true.
-- Se corre a mano en el editor SQL de Supabase (aquí no se usa prisma migrate).

-- ═══════════════════════════════════════════════════════════════════════════
-- Grupos de partidas — VERIFICAR (solo lectura). Correr después de APLICAR.
-- Cada fila debe decir ok = true.
-- ═══════════════════════════════════════════════════════════════════════════
SELECT 'tabla LicitacionGrupo existe' AS chequeo,
       to_regclass('public."LicitacionGrupo"') IS NOT NULL AS ok
UNION ALL
SELECT 'LicitacionGrupo con 11 columnas',
       (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'LicitacionGrupo') = 11
UNION ALL
SELECT 'LicitacionGrupo vacía',
       (SELECT count(*) FROM "LicitacionGrupo") = 0
UNION ALL
SELECT 'RLS activo en LicitacionGrupo',
       (SELECT relrowsecurity FROM pg_class WHERE oid = 'public."LicitacionGrupo"'::regclass)
UNION ALL
SELECT 'LicitacionItem.grupoId TEXT nullable',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'LicitacionItem'
                  AND column_name = 'grupoId' AND data_type = 'text' AND is_nullable = 'YES')
UNION ALL
SELECT 'todas las partidas existentes con grupoId null',
       NOT EXISTS (SELECT 1 FROM "LicitacionItem" WHERE "grupoId" IS NOT NULL)
UNION ALL
SELECT 'OrdenCompraLinea.grupoNombre y grupoDomicilio',
       (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'OrdenCompraLinea'
           AND column_name IN ('grupoNombre', 'grupoDomicilio') AND is_nullable = 'YES') = 2
UNION ALL
SELECT 'FK LicitacionItem_grupoId_fkey RESTRICT',
       EXISTS (SELECT 1 FROM pg_constraint
                WHERE conname = 'LicitacionItem_grupoId_fkey' AND contype = 'f' AND confdeltype = 'r')
UNION ALL
SELECT 'FK LicitacionGrupo_licitacionId_fkey RESTRICT',
       EXISTS (SELECT 1 FROM pg_constraint
                WHERE conname = 'LicitacionGrupo_licitacionId_fkey' AND contype = 'f' AND confdeltype = 'r')
UNION ALL
SELECT 'CHECK grupo_coordenadas_coherentes',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grupo_coordenadas_coherentes' AND contype = 'c')
UNION ALL
SELECT 'índice LicitacionGrupo_licitacionId_orden_idx',
       EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'LicitacionGrupo_licitacionId_orden_idx')
UNION ALL
SELECT 'índice LicitacionItem_grupoId_idx',
       EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'LicitacionItem_grupoId_idx');

-- Prueba del CHECK sin dejar rastro: debe FALLAR con
-- 'violates check constraint "grupo_coordenadas_coherentes"' (solo latitud).
-- Correrla aparte; el ROLLBACK la deshace aunque pasara.
--
-- BEGIN;
-- INSERT INTO "LicitacionGrupo" ("id","licitacionId","nombre","latitud","orden","updatedAt")
-- SELECT 'prueba_check', id, 'prueba', 20.85, 0, now() FROM "Licitacion" LIMIT 1;
-- ROLLBACK;
