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
--       → Bloque al final, COMENTADO: su RFC parece de persona física real; el
--         comprador verifica quién es antes de tocarlo.
--
-- Además, Proveedor1: su vendedorCorreo (a donde van las INVITACIONES y todo lo
-- operativo, ver correoProveedor.ts) es fco.hdz.c@gmail.com, que no es del
-- comprador, así que cada prueba le mandaba correo a una persona real. Pasa a
-- su correo de contacto, humbertomoal22+Prov1@gmail.com.
-- NO se cambia el email de su USUARIO del portal (también fco.hdz.c@gmail.com):
-- es su inicio de sesión, y cambiarlo cambia con qué cuenta se entra.
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
  IF (SELECT "vendedorCorreo" FROM "Proveedor" WHERE id = 'cmscftlam000004jl3kxdk96j') IS DISTINCT FROM 'fco.hdz.c@gmail.com' THEN
    RAISE EXCEPTION 'Abortado: el vendedorCorreo de Proveedor1 ya no es fco.hdz.c@gmail.com. Revisar a mano.';
  END IF;
  IF (SELECT "contactoAdminCorreo" FROM "Proveedor" WHERE id = 'cmscftlam000004jl3kxdk96j') IS DISTINCT FROM 'humbertomoal22+Prov1@gmail.com' THEN
    RAISE EXCEPTION 'Abortado: el contactoAdminCorreo de Proveedor1 ya no es humbertomoal22+Prov1@gmail.com. Revisar a mano.';
  END IF;
END $$;

-- Proveedor1: las invitaciones dejan de ir a fco.hdz.c@gmail.com.
UPDATE "Proveedor" SET "vendedorCorreo" = 'humbertomoal22+Prov1@gmail.com', "updatedAt" = now()
 WHERE id = 'cmscftlam000004jl3kxdk96j' AND "vendedorCorreo" = 'fco.hdz.c@gmail.com';

UPDATE "Proveedor" SET "razonSocial" = 'ZZ PRUEBA — Proveedor 1', "updatedAt" = now()
 WHERE id = 'cmscftlam000004jl3kxdk96j' AND "razonSocial" = 'Proveedor1';
UPDATE "Proveedor" SET "razonSocial" = 'ZZ PRUEBA — Proveedor 2', "updatedAt" = now()
 WHERE id = 'cmscfvbu3000104l95apfjnv5' AND "razonSocial" = 'Proveedor2';

-- ── "Ejemplo tadeo": COMENTADO a propósito. Su RFC parece de persona física
--    real; descomentar solo después de verificar quién es.
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
SELECT 'Proveedor 1: invitaciones a humbertomoal22+Prov1@gmail.com',
       (SELECT "vendedorCorreo" FROM "Proveedor" WHERE id = 'cmscftlam000004jl3kxdk96j') = 'humbertomoal22+Prov1@gmail.com'
UNION ALL
SELECT 'Ningún proveedor conserva fco.hdz.c@gmail.com como correo de invitaciones',
       NOT EXISTS (SELECT 1 FROM "Proveedor" WHERE "vendedorCorreo" = 'fco.hdz.c@gmail.com')
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
