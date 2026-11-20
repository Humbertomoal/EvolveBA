-- ═══════════════════════════════════════════════════════════════════════════
-- MC4 CAL 10: unidad del producto MED-CMP-010 de "Pieza" a "Par".
-- Se corre a mano en el editor SQL de Supabase.
-- Estado: APLICADO en Supabase el 2026-11-20 por el comprador. Verificación en
-- ok: MED-CMP-010 en "Par" con 0 partidas; MED-CMP-009 sigue en "Pieza" con sus 3.
-- Correrlo de nuevo aborta en la guarda ("ya tiene unidad Par").
--
-- Contexto (2026-11-20). CONECTORES MC4 P/CAL 10 FV existe dos veces:
--   · MED-CMP-010 (creado 31/07/2026): 0 partidas, 21 proveedores en catálogo.
--     → SE QUEDA y su unidad pasa a "Par", la real (se compran por par).
--   · MED-CMP-009 (creado 27/08/2026): 3 partidas vivas (0016 Cerrada, 0017 y
--     0020 En Proceso, con precios cotizados por PIEZA en la 0017).
--     → NO se toca. Ni su unidad ni su visibilidad: ocultarlo se decide cuando
--       cierren la 0017 y la 0020, verificando antes que no rompa sus partidas.
--
-- Por qué importa que MED-CMP-010 no tenga partidas: LicitacionItem NO guarda
-- la unidad, la toma del producto. Cambiar la unidad de un producto con
-- partidas cambiaría cómo se leen esas licitaciones (3 piezas pasarían a
-- decir 3 pares). La guarda de abajo aborta si MED-CMP-010 ya tiene alguna.
--
-- Todo en una transacción. Si una guarda falla, no se cambia nada.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

DO $$
DECLARE
  n_prod     INT;
  unidad_act TEXT;
  n_partidas INT;
  n_par      INT;
BEGIN
  SELECT count(*), max("unidadMedida") INTO n_prod, unidad_act
    FROM "Producto" WHERE codigo = 'MED-CMP-010';
  IF n_prod <> 1 THEN
    RAISE EXCEPTION 'Abortado: se esperaba 1 producto MED-CMP-010 y hay %.', n_prod;
  END IF;
  IF unidad_act = 'Par' THEN
    RAISE EXCEPTION 'Abortado: MED-CMP-010 ya tiene unidad "Par". Nada que hacer.';
  END IF;
  IF unidad_act <> 'Pieza' THEN
    RAISE EXCEPTION 'Abortado: se esperaba unidad "Pieza" y MED-CMP-010 tiene "%". Revisar a mano.', unidad_act;
  END IF;

  SELECT count(*) INTO n_partidas
    FROM "LicitacionItem" i JOIN "Producto" p ON p.id = i."productoId"
   WHERE p.codigo = 'MED-CMP-010';
  IF n_partidas > 0 THEN
    RAISE EXCEPTION 'Abortado: MED-CMP-010 ya está en % partida(s); cambiar su unidad cambiaría cómo se leen. Revisar a mano.', n_partidas;
  END IF;

  -- "Par" debe ser un valor ACTIVO del catálogo de unidades: es lo que muestra
  -- el select de unidad del formulario de producto.
  SELECT count(*) INTO n_par
    FROM "CatalogoValor"
   WHERE tipo = 'UNIDAD_MEDIDA' AND nombre = 'Par' AND activo = true;
  IF n_par = 0 THEN
    RAISE EXCEPTION 'Abortado: "Par" no es un valor activo del catálogo UNIDAD_MEDIDA.';
  END IF;
END $$;

UPDATE "Producto"
   SET "unidadMedida" = 'Par',
       "updatedAt"    = now()
 WHERE codigo = 'MED-CMP-010'
   AND "unidadMedida" = 'Pieza';

COMMIT;

-- ── Verificación (solo lectura): cada fila debe decir ok = true ─────────────
SELECT 'MED-CMP-010 con unidad Par' AS chequeo,
       (SELECT "unidadMedida" FROM "Producto" WHERE codigo = 'MED-CMP-010') = 'Par' AS ok
UNION ALL
SELECT 'MED-CMP-010 activo y no eliminado',
       (SELECT activo AND NOT eliminado FROM "Producto" WHERE codigo = 'MED-CMP-010')
UNION ALL
SELECT 'MED-CMP-010 sin partidas (nada histórico cambió)',
       NOT EXISTS (SELECT 1 FROM "LicitacionItem" i JOIN "Producto" p ON p.id = i."productoId"
                    WHERE p.codigo = 'MED-CMP-010')
UNION ALL
SELECT 'MED-CMP-009 intacto: sigue en Pieza',
       (SELECT "unidadMedida" FROM "Producto" WHERE codigo = 'MED-CMP-009') = 'Pieza'
UNION ALL
SELECT 'MED-CMP-009 intacto: activo y no eliminado',
       (SELECT activo AND NOT eliminado FROM "Producto" WHERE codigo = 'MED-CMP-009')
UNION ALL
SELECT 'MED-CMP-009 conserva sus 3 partidas',
       (SELECT count(*) FROM "LicitacionItem" i JOIN "Producto" p ON p.id = i."productoId"
         WHERE p.codigo = 'MED-CMP-009') = 3
UNION ALL
SELECT 'MED-CMP-010 sigue en el catálogo de 21 proveedores',
       (SELECT count(*) FROM "ProveedorMaterial" pm JOIN "Producto" p ON p.id = pm."productoId"
         WHERE p.codigo = 'MED-CMP-010') = 21;
