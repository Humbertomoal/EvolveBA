-- ═══════════════════════════════════════════════════════════════════════════
-- LIMPIEZA de las licitaciones de PRUEBA
--   · prueba MANUAL de grupos de partidas (checklist: docs/pruebas/checklist-grupos-partidas.md)
--   · prueba del autollenado de precios (scripts/crear-licitacion-prueba-autollenado.ts)
--   · demostración para el video a proveedores (scripts/crear-licitacion-prueba-demo.ts)
--
-- La prueba se hace a mano, por la UI. No hay arnés automático.
--
-- Borra COMPLETAS las licitaciones de prueba y todo lo que cuelga de ellas.
-- Base compartida con PRODUCCIÓN. Alcance:
--   · número LIKE 'PRUEBA-GRUPOS%'  (PRUEBA-GRUPOS y PRUEBA-GRUPOS-DUP)
--   · número IN ('PRUEBA-AUTOLLENADO', 'PRUEBA-DEMO') (exactos)
--   · y como máximo 4 licitaciones: si el filtro atrapa más, el script aborta
--     sin tocar nada (algo que no es de la prueba usa ese prefijo).
-- PRUEBA-AUTOLLENADO y PRUEBA-DEMO las crean sus scripts, con Proveedor2
-- invitado: aquí se borran sus ofertas, su invitación y los avisos de ronda de
-- su chat. Proveedor2 se queda como está.
-- La licitación se crea por la UI con el comprador real; NO se marca
-- compradorId (marcarla a mano era frágil y la sacaba de las listas).
--
-- ── Proveedores: NO se crea ni se toca ninguno ──────────────────────────────
-- La dependencia que impide BORRAR una partida (y obliga a ocultarla) se
-- simula con una fila en SeleccionPrecioComprador con
--   "proveedorId" = 'PRUEBA-GRUPOS'
-- Es válido porque SeleccionPrecioComprador.proveedorId es un String suelto,
-- SIN FK a Proveedor. tieneDependencias() (src/lib/licitacionesActions.ts)
-- cuenta seleccionesPrecio, así que esa fila basta para que la partida se
-- oculte en vez de borrarse. Las demás tablas que dependen de una partida
-- (OfertaItem, AsignacionMaterial, …) SÍ tienen FK a Proveedor y la prueba no
-- las usa.
--
-- Si para revisar el portal se invitó a un proveedor existente, este script
-- borra su invitación (LicitacionProveedor), sus ofertas y su chat de ESTAS
-- licitaciones, pero nunca la fila de Proveedor.
--
-- ── Orden de borrado ────────────────────────────────────────────────────────
-- Todo en UNA transacción. Todas las FK involucradas son RESTRICT (verificado
-- contra la base el 2026-11-19, incluida SeleccionPrecioComprador →
-- LicitacionItem), así que se borra de hojas a raíz:
--
--   OrdenCompraLinea → OrdenCompra → AsignacionMaterial → OfertaItem →
--   SeleccionPrecioComprador → ChatMensaje / LicitacionProveedor /
--   LicitacionEstadoLog → LicitacionItem → LicitacionGrupo → Licitacion
--
-- Idempotente: si ya no hay nada, borra 0 filas y termina bien.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

-- Guarda: no puede haber más de las 4 licitaciones que crean las pruebas.
DO $$
DECLARE objetivo INT;
BEGIN
  SELECT count(*) INTO objetivo FROM "Licitacion"
   WHERE numero LIKE 'PRUEBA-GRUPOS%' OR numero IN ('PRUEBA-AUTOLLENADO', 'PRUEBA-DEMO');
  IF objetivo > 4 THEN
    RAISE EXCEPTION 'Abortado: % licitaciones de prueba; las pruebas crean a lo más 4 (PRUEBA-GRUPOS, PRUEBA-GRUPOS-DUP, PRUEBA-AUTOLLENADO y PRUEBA-DEMO). Revisar a mano.', objetivo;
  END IF;
  RAISE NOTICE 'Licitaciones de prueba a borrar: %', objetivo;
END $$;

CREATE TEMP TABLE _lic ON COMMIT DROP AS
  SELECT id FROM "Licitacion" WHERE numero LIKE 'PRUEBA-GRUPOS%' OR numero IN ('PRUEBA-AUTOLLENADO', 'PRUEBA-DEMO');
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

-- ── Verificación (solo lectura): todo debe salir en 0 ───────────────────────
SELECT 'Licitacion PRUEBA-GRUPOS% / PRUEBA-AUTOLLENADO / PRUEBA-DEMO' AS tabla, count(*)::int AS filas
  FROM "Licitacion" WHERE numero LIKE 'PRUEBA-GRUPOS%' OR numero IN ('PRUEBA-AUTOLLENADO', 'PRUEBA-DEMO')
UNION ALL SELECT 'LicitacionGrupo huérfano de licitación', count(*)::int
  FROM "LicitacionGrupo" g WHERE NOT EXISTS (SELECT 1 FROM "Licitacion" l WHERE l.id = g."licitacionId")
UNION ALL SELECT 'LicitacionGrupo con nombre PRUEBA', count(*)::int
  FROM "LicitacionGrupo" WHERE nombre LIKE 'PRUEBA %'
UNION ALL SELECT 'SeleccionPrecioComprador centinela', count(*)::int
  FROM "SeleccionPrecioComprador" WHERE "proveedorId" = 'PRUEBA-GRUPOS';
