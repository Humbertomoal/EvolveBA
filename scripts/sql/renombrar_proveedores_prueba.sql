-- ═══════════════════════════════════════════════════════════════════════════
-- Renombrar los proveedores de PRUEBA para que se vayan al final de las
-- listas y no se inviten por error. Se SIGUEN USANDO para probar: no se
-- desactivan ni se borran.
-- Se corre a mano en el editor SQL de Supabase. Estado: PENDIENTE de correr.
--
-- Evidencia (2026-11-20):
--   · Proveedor1  cmscftlam000004jl3kxdk96j  RFC DAN180523AB1  creado 02/08/2026
--       contacto admin humbertomoal22+Prov1@gmail.com
--       OJO: vendedorCorreo y usuario del portal = fco.hdz.c@gmail.com (las
--       invitaciones le llegan a esa dirección).
--   · Proveedor2  cmscfvbu3000104l95apfjnv5  RFC DAN180523AB2  creado 02/08/2026
--       correos humbertomoal22+Prov2@gmail.com
--   · Ejemplo tadeo  cmwkzpizr000004l8pa63036j  RFC YEAJ860117BM7  creado 17/11/2026
--       correo upsyepiz@gmail.com, sin usuario de portal, nunca invitado.
--       → Bloque OPCIONAL al final: descomentarlo solo si confirmas que es de prueba.
--
-- Guardas: cada UPDATE va por id Y por el nombre actual; si el nombre ya no
-- es el esperado, aborta sin cambiar nada (todo en una transacción).
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

DO $$
BEGIN
  IF (SELECT "razonSocial" FROM "Proveedor" WHERE id = 'cmscftlam000004jl3kxdk96j') IS DISTINCT FROM 'Proveedor1' THEN
    RAISE EXCEPTION 'Abortado: cmscftlam000004jl3kxdk96j ya no se llama "Proveedor1". Revisar a mano.';
  END IF;
  IF (SELECT "razonSocial" FROM "Proveedor" WHERE id = 'cmscfvbu3000104l95apfjnv5') IS DISTINCT FROM 'Proveedor2' THEN
    RAISE EXCEPTION 'Abortado: cmscfvbu3000104l95apfjnv5 ya no se llama "Proveedor2". Revisar a mano.';
  END IF;
END $$;

UPDATE "Proveedor" SET "razonSocial" = 'ZZ PRUEBA — Proveedor 1', "updatedAt" = now()
 WHERE id = 'cmscftlam000004jl3kxdk96j' AND "razonSocial" = 'Proveedor1';
UPDATE "Proveedor" SET "razonSocial" = 'ZZ PRUEBA — Proveedor 2', "updatedAt" = now()
 WHERE id = 'cmscfvbu3000104l95apfjnv5' AND "razonSocial" = 'Proveedor2';

-- ── OPCIONAL: "Ejemplo tadeo" (descomentar solo si confirmas que es de prueba)
-- DO $$
-- BEGIN
--   IF (SELECT "razonSocial" FROM "Proveedor" WHERE id = 'cmwkzpizr000004l8pa63036j') IS DISTINCT FROM 'Ejemplo tadeo' THEN
--     RAISE EXCEPTION 'Abortado: cmwkzpizr000004l8pa63036j ya no se llama "Ejemplo tadeo".';
--   END IF;
-- END $$;
-- UPDATE "Proveedor" SET "razonSocial" = 'ZZ PRUEBA — Ejemplo tadeo', "updatedAt" = now()
--  WHERE id = 'cmwkzpizr000004l8pa63036j' AND "razonSocial" = 'Ejemplo tadeo';

COMMIT;

-- ── Verificación (solo lectura): cada fila debe decir ok = true ─────────────
SELECT 'Proveedor 1 renombrado' AS chequeo,
       (SELECT "razonSocial" FROM "Proveedor" WHERE id = 'cmscftlam000004jl3kxdk96j') = 'ZZ PRUEBA — Proveedor 1' AS ok
UNION ALL
SELECT 'Proveedor 2 renombrado',
       (SELECT "razonSocial" FROM "Proveedor" WHERE id = 'cmscfvbu3000104l95apfjnv5') = 'ZZ PRUEBA — Proveedor 2'
UNION ALL
SELECT 'Siguen activos (se usan para probar)',
       (SELECT bool_and(estado = 'Activo' AND NOT eliminado) FROM "Proveedor"
         WHERE id IN ('cmscftlam000004jl3kxdk96j', 'cmscfvbu3000104l95apfjnv5'))
UNION ALL
SELECT 'Conservan sus invitaciones (25 y 24)',
       (SELECT count(*) FROM "LicitacionProveedor" WHERE "proveedorId" = 'cmscftlam000004jl3kxdk96j') = 25
   AND (SELECT count(*) FROM "LicitacionProveedor" WHERE "proveedorId" = 'cmscfvbu3000104l95apfjnv5') = 24;
-- Si corriste el bloque opcional, verifica también:
-- SELECT "razonSocial" = 'ZZ PRUEBA — Ejemplo tadeo' FROM "Proveedor" WHERE id = 'cmwkzpizr000004l8pa63036j';
