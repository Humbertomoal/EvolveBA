-- ===========================================================================
-- AJUSTE 2 -- Cotización de PRODUCTO SIMILAR
-- Migración de base de datos * Supabase (PostgreSQL)
--
-- Contexto: el proveedor puede surtir una partida con un producto SIMILAR al
-- solicitado (se pide el 715, ofrece el 720). Es una MARCA sobre la cotización
-- normal --no un cuarto estado-- así que la oferta sigue compitiendo con su
-- precio como cualquier otra.
--
-- Orden de aplicación del ajuste: este SQL PRIMERO, después schema.prisma +
-- `npx prisma generate`. NO se usa `prisma migrate`.
--
-- Nombres: el schema no usa @@map, así que las tablas y columnas conservan el
-- camelCase de los modelos y requieren comillas dobles.
--
-- El límite de 500 caracteres del detalle vive SOLO en código
-- (esCapturaValida, cliente y servidor, + maxLength del textarea).
-- Deliberadamente NO está en el CHECK y la columna es TEXT sin límite físico.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- BLOQUE 1 * MIGRACIÓN
-- ---------------------------------------------------------------------------

BEGIN;

-- 1. OfertaItem: la marca y su detalle.
-- Aditivas y con default: las filas existentes quedan en (false, NULL), que es
-- lo correcto -- ninguna oferta histórica fue de producto similar. Sin backfill.
-- `ADD COLUMN ... DEFAULT` no reescribe la tabla en PostgreSQL 11+.
ALTER TABLE "OfertaItem"
  ADD COLUMN "esProductoSimilar"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "productoSimilarDetalle" TEXT;

-- 2. Coherencia de la marca.
-- Misma familia que `oferta_estado_excluyente`: la base es la última red, no la
-- primera. Tres reglas en una:
--   (a) marcado    => el detalle existe y no está vacío;
--   (b) marcado    => es una cotización CON precio (ni "no dispongo" ni "no aplica");
--   (c) sin marcar => no se exige nada (el detalle puede ser NULL).
-- `btrim` solo sirve para rechazar un detalle que sea puro espacio en blanco;
-- el trim real al guardar lo hace ofertasActions.ts.
ALTER TABLE "OfertaItem"
  ADD CONSTRAINT "oferta_similar_coherente" CHECK (
    NOT "esProductoSimilar" OR (
      "productoSimilarDetalle" IS NOT NULL
      AND length(btrim("productoSimilarDetalle")) > 0
      AND NOT "noDisponible"
      AND NOT "noAplica"
    )
  );

-- 3. OrdenCompraLinea: snapshot (opción A).
-- La OC es un documento: congela lo que se compró, igual que ya congela
-- productoNombre y precioUnitario. Estos dos campos se copian desde la
-- OfertaItem origen al generar la orden (ordenesUtils.ts) -- no se leen en vivo.
-- El vínculo existe porque AsignacionMaterial(licitacionItemId, proveedorId,
-- ronda) es exactamente la clave única de OfertaItem.
ALTER TABLE "OrdenCompraLinea"
  ADD COLUMN "esProductoSimilar"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "productoSimilarDetalle" TEXT;

COMMIT;


-- ---------------------------------------------------------------------------
-- BLOQUE 2 * VERIFICACIÓN
-- Correr DESPUÉS de la migración. Resultado esperado:
--   * consulta 1 -> 4 filas (2 columnas x 2 tablas)
--   * consulta 2 -> 2 constraints: `oferta_estado_excluyente` (el que ya
--     existía) y `oferta_similar_coherente` (el nuevo).
-- Si `oferta_estado_excluyente` NO aparece, significa que nunca se aplicó en
-- este entorno: hay que revisarlo antes de seguir con el ajuste.
-- ---------------------------------------------------------------------------

SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name IN ('OfertaItem', 'OrdenCompraLinea')
  AND column_name IN ('esProductoSimilar', 'productoSimilarDetalle')
ORDER BY table_name, column_name;

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = '"OfertaItem"'::regclass
  AND contype = 'c'
ORDER BY conname;


-- ---------------------------------------------------------------------------
-- BLOQUE 3 * ROLLBACK
-- Deshace el bloque 1 por completo. Orden inverso: primero el CHECK, luego las
-- columnas. Con `IF EXISTS` para que sea idempotente.
-- OJO: borra los datos capturados en esas columnas. Si ya hay ofertas marcadas
-- como similares, esa información se pierde.
-- ---------------------------------------------------------------------------

BEGIN;

ALTER TABLE "OrdenCompraLinea"
  DROP COLUMN IF EXISTS "productoSimilarDetalle",
  DROP COLUMN IF EXISTS "esProductoSimilar";

ALTER TABLE "OfertaItem"
  DROP CONSTRAINT IF EXISTS "oferta_similar_coherente";

ALTER TABLE "OfertaItem"
  DROP COLUMN IF EXISTS "productoSimilarDetalle",
  DROP COLUMN IF EXISTS "esProductoSimilar";

COMMIT;
