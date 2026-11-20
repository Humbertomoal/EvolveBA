-- ═══════════════════════════════════════════════════════════════════════════
-- LIMPIEZA de SOLO la licitación PRUEBA-DEMO
-- (scripts/crear-licitacion-prueba-demo.ts)
--
-- A diferencia de prueba_grupos_limpieza.sql, NO toca PRUEBA-GRUPOS* ni
-- PRUEBA-AUTOLLENADO: sirve para recrear la demo entre tomas del video.
--
-- Alcance: número = 'PRUEBA-DEMO' (exacto; es único en la base). Borra la
-- licitación y todo lo que cuelga de ella: ofertas, invitación y chat de
-- Proveedor2, bitácora, partidas y grupos. Proveedor2 se queda como está.
-- Mismo orden de hojas a raíz que prueba_grupos_limpieza.sql (FK RESTRICT).
-- Idempotente: si ya no existe, borra 0 filas.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

DO $$
DECLARE objetivo INT;
BEGIN
  SELECT count(*) INTO objetivo FROM "Licitacion" WHERE numero = 'PRUEBA-DEMO';
  IF objetivo > 1 THEN
    RAISE EXCEPTION 'Abortado: % licitaciones PRUEBA-DEMO (debería haber a lo más 1).', objetivo;
  END IF;
  RAISE NOTICE 'Licitaciones a borrar: %', objetivo;
END $$;

CREATE TEMP TABLE _lic ON COMMIT DROP AS
  SELECT id FROM "Licitacion" WHERE numero = 'PRUEBA-DEMO';
CREATE TEMP TABLE _item ON COMMIT DROP AS
  SELECT id FROM "LicitacionItem" WHERE "licitacionId" IN (SELECT id FROM _lic);

DELETE FROM "OrdenCompraLinea"
 WHERE "ordenCompraId" IN (SELECT id FROM "OrdenCompra" WHERE "licitacionId" IN (SELECT id FROM _lic))
    OR "asignacionId"  IN (SELECT id FROM "AsignacionMaterial" WHERE "licitacionId" IN (SELECT id FROM _lic));
DELETE FROM "OrdenCompra"              WHERE "licitacionId"     IN (SELECT id FROM _lic);
DELETE FROM "AsignacionMaterial"       WHERE "licitacionId"     IN (SELECT id FROM _lic)
                                          OR "licitacionItemId" IN (SELECT id FROM _item);
DELETE FROM "OfertaItem"               WHERE "licitacionItemId" IN (SELECT id FROM _item);
DELETE FROM "SeleccionPrecioComprador" WHERE "licitacionItemId" IN (SELECT id FROM _item);
DELETE FROM "ChatMensaje"              WHERE "licitacionId"     IN (SELECT id FROM _lic);
DELETE FROM "LicitacionProveedor"      WHERE "licitacionId"     IN (SELECT id FROM _lic);
DELETE FROM "LicitacionEstadoLog"      WHERE "licitacionId"     IN (SELECT id FROM _lic);
DELETE FROM "LicitacionItem"           WHERE id                 IN (SELECT id FROM _item);
DELETE FROM "LicitacionGrupo"          WHERE "licitacionId"     IN (SELECT id FROM _lic);
DELETE FROM "Licitacion"               WHERE id                 IN (SELECT id FROM _lic);

COMMIT;

-- ── Verificación (solo lectura) ─────────────────────────────────────────────
SELECT numero, estado FROM "Licitacion"
 WHERE numero LIKE 'PRUEBA-%' ORDER BY numero;
