# Checklist manual — grupos de partidas

Rama `grupos-partidas`, con los pasos (a) a (d) commiteados. Prueba por la UI, contra la base
compartida con producción. Limpieza al final: `scripts/sql/prueba_grupos_limpieza.sql`.

**Orden de la pasada:**

| Pruebas | Licitación |
|---|---|
| 1 a 9 y B | En **Borrador**, sin mandar correos |
| A y 10 | Lanzada. Es el único momento en que sale un correo, y solo a un proveedor tuyo |

## Reglas de la prueba

- **Cada partida se identifica por su cantidad**, y cada una lleva un **producto distinto** (en la
  prueba A se cruza por nombre de producto).

  | Cantidad | Nace en |
  |---|---|
  | 101, 102 | PRUEBA Norte |
  | 201, 202 | PRUEBA Sur |
  | 103 | PRUEBA Norte (prueba 3) |
  | 301 | PRUEBA Oeste (prueba 6a) |
  | 901 | Sin grupo (prueba A) |

- **Los grupos se llaman `PRUEBA …`.** La verificación de la limpieza los busca por ese prefijo.
- **NUNCA presiones «Enviar» en la ventana de correo**, salvo en el paso A.1, y solo con tu
  proveedor de prueba invitado.
- **Proveedor participante: elige desde el principio un proveedor cuya cuenta del portal y cuyo
  correo controles, y solo ese.** En A.1 se le manda la invitación y en A.2 entras como él.
- **Ese proveedor debe poder ver los productos que elijas:**
  - Si tiene catálogo, usa productos de su catálogo.
  - Si ninguna partida coincide, el portal le muestra todas (respaldo del filtro).
  - Si tiene catálogo y solo algunas coinciden, verá solo esas.
- No se crea ni se modifica ningún Proveedor.
- **Ruta del formulario de edición:** `/<cliente>/comprador/licitaciones/<id>/editar`
  (se llega desde **Lanzamiento**).

---

## Consultas de apoyo

Todas son de solo lectura. Cambia `'PRUEBA-GRUPOS'` por `'PRUEBA-GRUPOS-DUP'` cuando la prueba hable
de la copia.

**Q-ID** — id y estado de la licitación:
```sql
SELECT id, numero, estado, "rondaActual" FROM "Licitacion" WHERE numero LIKE 'PRUEBA-GRUPOS%';
```

**Q-GRUPOS** — grupos tal como quedaron:
```sql
SELECT g.orden, g.nombre, g.domicilio, g.latitud, g.longitud, g.eliminado, g."eliminadoEn", g.id
  FROM "LicitacionGrupo" g JOIN "Licitacion" l ON l.id = g."licitacionId"
 WHERE l.numero = 'PRUEBA-GRUPOS'
 ORDER BY g.orden, g.id;
```

**Q-ORDEN** — partidas en el orden de todas las lecturas (grupo, posición; sin grupo al final):
```sql
SELECT coalesce(g.nombre, '(sin grupo)') AS grupo, g.orden AS g_orden, p.nombre AS producto,
       i."cantidadSolicitada" AS cant, i.posicion, i.eliminado, i.especificacion, i.id
  FROM "LicitacionItem" i
  JOIN "Licitacion" l ON l.id = i."licitacionId"
  JOIN "Producto" p ON p.id = i."productoId"
  LEFT JOIN "LicitacionGrupo" g ON g.id = i."grupoId"
 WHERE l.numero = 'PRUEBA-GRUPOS'
 ORDER BY g.orden ASC NULLS LAST, i.posicion, i.id;
```

**Q-PORTAL** — lo que reciben el portal y el comparativo: Q-ORDEN sin las partidas retiradas. El
portal, además, filtra por el catálogo del proveedor.
```sql
SELECT coalesce(g.nombre, '(sin grupo)') AS grupo, p.nombre AS producto, i."cantidadSolicitada" AS cant
  FROM "LicitacionItem" i
  JOIN "Licitacion" l ON l.id = i."licitacionId"
  JOIN "Producto" p ON p.id = i."productoId"
  LEFT JOIN "LicitacionGrupo" g ON g.id = i."grupoId"
 WHERE l.numero = 'PRUEBA-GRUPOS' AND i.eliminado = false
 ORDER BY g.orden ASC NULLS LAST, i.posicion, i.id;
```

**Q-PRECIOS** — cada oferta con el producto y el grupo de SU partida (prueba A):
```sql
SELECT coalesce(g.nombre, '(sin grupo)') AS grupo, p.nombre AS producto,
       i."cantidadSolicitada" AS cant, o.ronda, o."precioUnitario",
       o."noDisponible", o."noAplica", o."updatedAt", i.id AS partida_id
  FROM "OfertaItem" o
  JOIN "LicitacionItem" i ON i.id = o."licitacionItemId"
  JOIN "Producto" p ON p.id = i."productoId"
  JOIN "Licitacion" l ON l.id = i."licitacionId"
  LEFT JOIN "LicitacionGrupo" g ON g.id = i."grupoId"
 WHERE l.numero = 'PRUEBA-GRUPOS'
 ORDER BY g.orden ASC NULLS LAST, i.posicion, i.id, o.ronda;
```

---

## 0. Antes de empezar

- [ ] Corre **Q-ID**. Debe salir **0 filas**. Si sale algo, corre primero la limpieza.

## 1. Crear la licitación con 2 grupos

1. [ ] **Licitaciones → Nueva**. Modo «Licitación a Proveedores». Número `PRUEBA-GRUPOS`.
   - Llena los campos obligatorios: criticidad, tipo, instrucciones.
   - **Fecha de inicio: unos minutos en el futuro**, para que en la prueba A la ronda ya esté abierta.
   - **Fecha de fin: holgada**, por ejemplo mañana.
   - **Máximo de rondas = 1** y **duración de ronda larga** (por ejemplo 1 día), para que las
     pruebas A y 10 ocurran dentro de la misma ronda.
   - Como proveedor participante, elige **solo tu proveedor de prueba**.
2. [ ] **Agregar grupo** dos veces:
   - Grupo 1: nombre `PRUEBA Norte`, domicilio `Calle Norte 1`, sin coordenadas.
   - Grupo 2: nombre `PRUEBA Sur`, domicilio `Calle Sur 2`, coordenadas `20.853501, -104.486565`.

   **Qué ver:** cada grupo es un encabezado con nombre, domicilio y coordenadas, y su propio botón
   «Agregar producto a «…»». Con coordenadas válidas aparece el ícono «Ver en el mapa».
3. [ ] Con «Agregar producto a «PRUEBA Norte»» agrega las partidas 101 y 102. Con el de
   «PRUEBA Sur», agrega 201 y 202. Usa productos distintos y deja **vacía** la especificación de
   todas. Presiona **Guardar como Borrador**.

   **Qué ver:** el aviso «Licitación guardada correctamente».
4. [ ] **Q-GRUPOS:** 2 filas. Norte con `orden 0` y latitud/longitud nulas; Sur con `orden 1`,
   `20.853501` y `-104.486565`. Ambas con `eliminado = false`.
5. [ ] **Q-ORDEN:** `101, 102` (Norte), `201, 202` (Sur), con posiciones `0, 1, 2, 3`.
6. [ ] Abre la licitación en **Editar**.

   **Qué ver:** la misma estructura que capturaste, en el mismo orden.

## 2. Texto de ayuda gris en «Especificación»

En Editar de `PRUEBA-GRUPOS`, con la especificación todavía vacía:

- [ ] **Partida de Norte:** el placeholder gris dice `El domicilio ya va en el grupo «PRUEBA Norte»`.
- [ ] **Partida de Sur:** dice `… «PRUEBA Sur»`.
- [ ] **Al pasar el mouse** sobre el campo vacío sale el mismo texto como tooltip.
- [ ] **Al escribir algo** en la especificación desaparece el placeholder, y el tooltip muestra lo
  escrito. Borra lo escrito antes de seguir.
- [ ] **Al borrar** el domicilio de Norte (sin guardar), el placeholder de sus partidas cambia a
  `Detalles adicionales…`. Vuelve a poner `Calle Norte 1`.
- [ ] **Sin grupo:** en la prueba 4 (partida 202 sin grupo), comprueba que su placeholder dice
  `Detalles adicionales…`.

Solo orienta: no copia nada a la especificación. Comprobación con **Q-ORDEN**: la columna
`especificacion` queda vacía o nula.

## 3. Agregar una partida a un grupo que NO es el último

1. [ ] En Editar, usa **«Agregar producto a «PRUEBA Norte»»** y captura la partida 103.

   **Qué ver:** 103 aparece **al final de Norte** (después de 102) y **antes** del encabezado de Sur.
2. [ ] **Guardar Cambios** y recarga la página.

   **Qué ver:** Norte = `101, 102, 103` y Sur = `201, 202`.
3. [ ] **Q-ORDEN:** el mismo orden. 103 tiene `posicion = 4`: es max+1, porque agregar no reordena.
4. [ ] **Q-PORTAL:** también `101, 102, 103, 201, 202`. Las lecturas ordenan primero por grupo, así
   que la posición 4 no la manda al final.

## 4. Mover partidas entre grupos y a «Sin grupo»

1. [ ] En la columna **Grupo** de la partida 101, elige `PRUEBA Sur`.

   **Qué ver:** 101 se va **al final de Sur**: Norte = `102, 103` y Sur = `201, 202, 101`.
2. [ ] **Guardar Cambios** y recarga.

   **Qué ver:** el mismo orden.

   **Q-ORDEN:** el mismo orden, con posiciones reescritas `0..4` en ese orden, porque este guardado
   reordena.
3. [ ] En la columna Grupo de 202, elige `Sin grupo`.

   **Qué ver:** aparece al final una sección con la franja ámbar
   «**Sin grupo** · 1 partida — el proveedor las verá sin domicilio de entrega…», con 202 dentro.
4. [ ] **Guardar Cambios** y recarga.

   **Qué ver:** 202 sigue en «Sin grupo».

   **Q-ORDEN:** 202 con `grupo = (sin grupo)`, al final.
5. [ ] **De ida y vuelta:** mueve 202 a `PRUEBA Norte`.

   **Qué ver:** queda al final de Norte.

   **No guardes:** vuelve a ponerla en `Sin grupo` y guarda. Así queda lista para el modal de la
   prueba 8.

## 5. Reordenar grupos y partidas dentro de un grupo

1. [ ] En el encabezado de Norte, presiona **«Bajar el grupo»**.

   **Qué ver:** Sur queda primero y Norte segundo; «Sin grupo» sigue al final.
2. [ ] Dentro de Sur (`201, 101`), en la partida 101 presiona **«Subir una posición»**.

   **Qué ver:** Sur = `101, 201`.
3. [ ] **Frontera:** en la **primera** partida de Norte, el botón «Subir una posición» está
   deshabilitado. Una partida no salta a otro grupo con las flechas.
4. [ ] **Guardar Cambios** y recarga.

   **Qué ver:** Sur `101, 201` → Norte `102, 103` → Sin grupo `202`.
5. [ ] **Q-GRUPOS:** Sur `orden 0` y Norte `orden 1`. **Q-ORDEN:** el mismo orden de pantalla.

## 6. Quitar un grupo

### 6a. Sin dependencias: se borra

1. [ ] **Agregar grupo** `PRUEBA Oeste` (domicilio `Calle Oeste 3`) con la partida 301.
   **Guardar Cambios**.

   **Q-GRUPOS:** aparece Oeste.
2. [ ] En Oeste, presiona **«Quitar grupo»**.

   **Qué ver:** el diálogo «¿Quitar el grupo «PRUEBA Oeste» y sus 1 partida? Las que ya tienen
   ofertas se conservan ocultas…». Acepta: el grupo y 301 desaparecen de la lista.
3. [ ] **Guardar Cambios** y recarga.

   **Qué ver:** Oeste no está.
4. [ ] Comprobación en la base:
   ```sql
   SELECT count(*) FROM "LicitacionGrupo" WHERE nombre = 'PRUEBA Oeste';      -- 0
   SELECT count(*) FROM "LicitacionItem" i JOIN "Licitacion" l ON l.id = i."licitacionId"
    WHERE l.numero = 'PRUEBA-GRUPOS' AND i."cantidadSolicitada" = 301;        -- 0
   ```
   Las filas se borraron de verdad, no se ocultaron.

### 6b. Con precio capturado: se oculta

1. [ ] Simula el precio capturado en la partida 102 (Norte). No se toca ningún Proveedor: la
   columna `proveedorId` no tiene FK.
   ```sql
   INSERT INTO "SeleccionPrecioComprador"
     (id, "licitacionItemId", "proveedorId", "precioNegociado", "actualizadoPor", "actualizadoEn")
   SELECT 'prueba-grupos-spc-1', i.id, 'PRUEBA-GRUPOS', 1, 'PRUEBA-GRUPOS', now()
     FROM "LicitacionItem" i JOIN "Licitacion" l ON l.id = i."licitacionId"
    WHERE l.numero = 'PRUEBA-GRUPOS'
      AND i."cantidadSolicitada" = 102 AND i.eliminado = false;
   ```
   **Qué ver:** `INSERT 0 1`.
2. [ ] **Recarga** Editar: el formulario cuenta las dependencias al cargar.

   **Qué ver:** al pasar el mouse por el bote de 102, el tooltip dice «Retirar esta partida (tiene
   ofertas: se conserva el histórico y se puede restaurar)». El de 103 dice «Eliminar fila».
3. [ ] En Norte, presiona **«Quitar grupo»** y acepta el diálogo («… y sus 2 partidas?»).

   **Qué ver:**
   - Norte queda **tachado**, con el tooltip «Grupo quitado: sus partidas tienen ofertas y se
     conservan ocultas…» y el botón **«Restaurar grupo»**.
   - 102 queda tachada.
   - 103 **desaparece**.
4. [ ] **Guardar Cambios** y recarga.

   **Qué ver:** lo mismo que en el paso anterior.
5. [ ] Comprobación:
   - **Q-GRUPOS:** Norte con `eliminado = true` y `eliminadoEn` lleno.
   - **Q-ORDEN:** 102 con `eliminado = true`, y 103 ya no existe.
   - **Q-PORTAL:** 102 **no** sale.
   - El borrador de precio sigue vivo:
     ```sql
     SELECT count(*) FROM "SeleccionPrecioComprador" WHERE id = 'prueba-grupos-spc-1';  -- 1
     ```

## 7. Restaurar un grupo quitado

1. [ ] En Norte (tachado), presiona **«Restaurar grupo»**.

   **Qué ver:** Norte ya no está tachado y 102 vuelve a estar viva. 103 no regresa, porque se borró
   en 6b.
2. [ ] **Guardar Cambios** y recarga.

   **Q-GRUPOS:** Norte `eliminado = false`, `eliminadoEn` nulo. **Q-ORDEN:** 102 `eliminado = false`.
3. [ ] **Variante por la partida:** quita Norte otra vez y guarda (como en 6b). Luego, en la fila
   tachada de 102, presiona **«Restaurar esta partida»**.

   **Qué ver:** Norte se restaura solo, porque un grupo oculto no puede tener partidas vivas.

   Guarda y repite el paso 2 de esta prueba.

## 8. Lanzar con partidas sin grupo: el modal

Estado de partida: Sur `101, 201`, Norte `102`, Sin grupo `202`.

1. [ ] **Control:** **Guardar Cambios** o «Guardar como Borrador» **no** muestra el modal. Solo
   aparece al lanzar.
2. [ ] Presiona **«Guardar y Notificar Participantes»**.

   **Qué ver:** el modal «**Hay 1 partida sin grupo**»: «Esta licitación tiene grupos, pero una
   partida no está en ninguno. Los proveedores la verán en la sección «Sin grupo»…», con los botones
   **Cancelar** y **Lanzar de todos modos**.
3. [ ] Presiona **Cancelar**.

   **Qué ver:** no pasa nada más. **Q-ID:** `estado = Borrador`.
4. [ ] Vuelve a presionar el botón y elige **«Lanzar de todos modos»**.

   **Qué ver:** se guarda y se abre la **ventana de correo**. Antes de cerrarla, haz la **prueba B1**
   con esa misma ventana. Después **ciérrala con la X o con Cancelar. NO envíes.**

   **Qué ver después:** el aviso «No se enviaron los correos. La licitación sigue en Borrador…».
   **Q-ID:** `estado = Borrador`.
5. [ ] **Control:** mueve 202 a `PRUEBA Sur`, guarda y presiona «Guardar y Notificar» otra vez.

   **Qué ver:** **no** aparece el modal de sin grupo; va directo a la ventana de correo.
   **Ciérrala sin enviar.**

## Prueba B — el correo de invitación

Siempre en la **ventana de correo** que abre «Guardar y Notificar Participantes». Se lee la vista
previa y **se cierra con Cancelar o la X. Nunca se envía.**

### B1. Con grupos (`PRUEBA-GRUPOS`, desde 8.4)

Estado: Sur `101, 201`, Norte `102`, Sin grupo `202`.

- [ ] En el cuerpo, la lista de materiales sale **por bloques, en este orden**, separados por una
  línea en blanco:
  ```
  PRUEBA Sur — Entrega en: Calle Sur 2
  - <producto 101>: 101 <unidad> · Fecha requerida: dd/mm/aaaa
  - <producto 201>: 201 <unidad> · Fecha requerida: dd/mm/aaaa

  PRUEBA Norte — Entrega en: Calle Norte 1
  - <producto 102>: 102 <unidad> · Fecha requerida: dd/mm/aaaa

  Sin grupo (sin domicilio de entrega)
  - <producto 202>: 202 <unidad> · Fecha requerida: dd/mm/aaaa
  ```
- [ ] Si la plantilla muestra la cantidad de materiales, dice **4**: los encabezados no cuentan.
- [ ] **Grupo sin domicilio:** si un grupo no tuviera domicilio, su encabezado sería solo el nombre,
  sin «— Entrega en:». No se puede guardar un grupo sin domicilio, así que esto solo se ve si lo
  borras en pantalla antes de presionar el botón.

Si haces el control de 8.5 (202 ya en Sur), en esa ventana confirma que **no** hay bloque «Sin grupo».

### B2. Sin grupos: idéntico a antes (`PRUEBA-GRUPOS-DUP`, después de la prueba 9)

1. [ ] Abre `PRUEBA-GRUPOS-DUP` en Editar.
   - Con la columna Grupo, pasa **todas** sus partidas a `Sin grupo`.
   - Quita los grupos, que ya están vacíos y salen sin diálogo.
   - **Guardar Cambios** y recarga.

   **Qué ver:** tabla sin encabezados ni franja «Sin grupo», como una licitación de antes.
   **Q-GRUPOS** (con `-DUP`) da 0 filas.
2. [ ] Presiona «Guardar y Notificar Participantes».

   **Qué ver:** **no** aparece el modal de sin grupo, porque no hay grupos.
3. [ ] En la ventana de correo, la lista es **una línea por material, sin encabezados ni líneas en
   blanco**:
   ```
   - <producto>: <cantidad> <unidad> · Fecha requerida: dd/mm/aaaa
   - <producto>: <cantidad> <unidad> · Fecha requerida: dd/mm/aaaa
   ```
   **Cierra con Cancelar.**
4. [ ] **Comparación con una real (opcional, recomendado):**
   - Abre una licitación real **En Proceso** sin grupos y usa su opción de reenviar la invitación.
   - Compara el formato de la lista: debe ser el mismo carácter por carácter, salvo los datos.
   - **Cierra con Cancelar. No reenvíes.**

## 9. Duplicar: los grupos nuevos no reutilizan ids

Hazla **antes de B2**.

1. [ ] En **Lanzamiento**, en la fila de `PRUEBA-GRUPOS`, presiona el ícono **«Duplicar licitación
   PRUEBA-GRUPOS»**.

   **Qué ver:** el formulario de **Nueva** llega prellenado, con los mismos grupos en el mismo
   orden y las mismas partidas en sus grupos.
2. [ ] Pon el número `PRUEBA-GRUPOS-DUP` y presiona **Guardar como Borrador**.
3. [ ] Ningún id de grupo compartido entre original y copia:
   ```sql
   SELECT count(*) AS ids_compartidos
     FROM "LicitacionGrupo" a JOIN "Licitacion" la ON la.id = a."licitacionId"
     JOIN "LicitacionGrupo" b ON b.id = a.id
     JOIN "Licitacion" lb ON lb.id = b."licitacionId"
    WHERE la.numero = 'PRUEBA-GRUPOS' AND lb.numero = 'PRUEBA-GRUPOS-DUP';   -- 0
   ```
4. [ ] Cada partida de la copia apunta a un grupo **de la copia**:
   ```sql
   SELECT count(*) AS apuntan_fuera
     FROM "LicitacionItem" i JOIN "Licitacion" l ON l.id = i."licitacionId"
     JOIN "LicitacionGrupo" g ON g.id = i."grupoId"
    WHERE l.numero = 'PRUEBA-GRUPOS-DUP' AND g."licitacionId" <> l.id;       -- 0
   ```
5. [ ] La estructura es la misma:
   ```sql
   SELECT l.numero, g.orden, g.nombre, g.domicilio, g.latitud, g.longitud, g.id
     FROM "LicitacionGrupo" g JOIN "Licitacion" l ON l.id = g."licitacionId"
    WHERE l.numero LIKE 'PRUEBA-GRUPOS%' AND g.eliminado = false
    ORDER BY g.orden, l.numero;
   ```
   **Qué ver:** pares iguales en nombre, domicilio, coordenadas y orden, con **ids distintos**.
   Además, **Q-ORDEN** con `-DUP` da las mismas cantidades en el mismo orden.

## Prueba A — los precios no se cruzan en el portal

**El riesgo:** la tabla de cotización ahora intercala filas de encabezado. El estado de captura
vive en un arreglo por índice, que se reconstruye **por `licitacionItemId`**
(`LicitacionCotizacion.tsx`, `filasAlineadas`). Al guardar, cada precio viaja con el
`licitacionItemId` de su partida, no con su número de fila. Esta prueba confirma que sigue así con
encabezados y después de reordenar.

### A.0 Preparar (en Borrador)

1. [ ] En Editar de `PRUEBA-GRUPOS`, con **«Agregar producto sin grupo»** agrega la partida **901**
   (producto distinto).

   **Estado esperado:** Sur `101, 201, 202` → Norte `102` → Sin grupo `901`.

   **Guardar Cambios.** Anota en papel qué producto es cada cantidad.

### A.1 Lanzar (el único envío de toda la pasada)

2. [ ] Comprueba que en «Proveedores participantes» está **solo tu proveedor de prueba**.
3. [ ] Presiona «Guardar y Notificar Participantes». En el modal de sin grupo, elige «Lanzar de
   todos modos».
4. [ ] En la ventana de correo, revisa que el **único destinatario** sea tu correo de prueba. La
   lista va en bloques: Sur, Norte, Sin grupo. Ahora sí, **Enviar**.
5. [ ] **Q-ID:** `estado` = `Programada` o `En Proceso`. Espera a la fecha de inicio; al abrir el
   portal, el estado pasa a `En Proceso` con `rondaActual = 1`.

### A.2 Capturar como proveedor

6. [ ] Entra al portal con tu proveedor de prueba y abre `PRUEBA-GRUPOS`.

   **Qué ver:** en la tabla «Registrar oferta de precio por producto», una fila gris de encabezado
   antes de cada sección:
   - `PRUEBA Sur` con 📍 `Calle Sur 2`
   - `PRUEBA Norte` con 📍 `Calle Norte 1`
   - `Sin grupo · sin domicilio de entrega`

   Las filas de encabezado no tienen campos.
7. [ ] Captura **solo** estos precios, con cantidad disponible igual a la solicitada:

   | Partida | Grupo | Precio |
   |---|---|---|
   | 101 | Sur | **111** |
   | 102 | Norte | **444** |
   | 901 | Sin grupo | **777** |

   - En 201 y 202 marca **«No dispongo de esta partida»**. El portal exige precio o «No dispongo»
     en cada partida.
8. [ ] **Enviar Oferta → Confirmar y Enviar.**

### A.3 Recargar y comprobar

9. [ ] Recarga el portal (F5).

   **Qué ver:** 111 junto al producto de 101, 444 junto al de 102 y 777 junto al de 901. 201 y 202
   siguen en «No dispongo».
10. [ ] **Q-PRECIOS:**

    | Producto de | Grupo | `precioUnitario` | `noDisponible` |
    |---|---|---|---|
    | 101 | PRUEBA Sur | 111 | false |
    | 102 | PRUEBA Norte | 444 | false |
    | 901 | (sin grupo) | 777 | false |
    | 201, 202 | — | 0 | true |

    Todas con `ronda = 1`.

### A.4 Reordenar como comprador

11. [ ] Como comprador, abre `PRUEBA-GRUPOS` en **Editar**. La licitación En Proceso sigue siendo
    editable.
    - En Norte, presiona **«Subir el grupo»**: Norte queda primero.
    - Mueve la partida **101** (la del 111) de `PRUEBA Sur` a `PRUEBA Norte`.

    **Qué ver antes de guardar:** Norte `102, 101` → Sur `201, 202` → Sin grupo `901`.
12. [ ] **Guardar Cambios.**
    - Es posible que se publique un aviso automático en el chat de la licitación. Es del sistema,
      no un correo.
    - Si aparece un modal de rondas o de fecha, revisa qué dice antes de confirmar.
13. [ ] **Q-ORDEN:** Norte (`orden 0`): 102, 101; Sur (`orden 1`): 201, 202; sin grupo: 901.
    **Q-PRECIOS:** **sin cambios**: los mismos precios, en los mismos productos.

### A.5 Volver al portal

14. [ ] Como proveedor, **recarga** el portal.

    **Qué ver:**
    - El orden nuevo: `PRUEBA Norte` (102 = **444**, 101 = **111**), luego `PRUEBA Sur`
      (201, 202 en «No dispongo»), luego `Sin grupo` (901 = **777**).
    - **Cada precio sigue en su material, no en su número de fila.** La fila 2 ahora es 101 y debe
      mostrar 111, no el 444 que antes estaba en la fila 2.
15. [ ] **Sin recargar a mano:** con el portal abierto en otra pestaña, repite un movimiento como
    comprador (por ejemplo, regresa 101 a Sur) y espera unos 30 s a que el portal se refresque solo.

    **Qué ver:** los precios se reacomodan con sus materiales y ningún campo se queda con el valor de
    la fila de al lado.
16. [ ] Vuelve a enviar la oferta sin tocar nada (**Actualizar Oferta → Confirmar**).

    **Q-PRECIOS:** los mismos precios en los mismos productos. Nada se cruzó al reenviar.

## 10. Portal del proveedor y comparativo, con encabezados

Con la licitación ya lanzada y la oferta de la prueba A.

### Portal del proveedor

1. [ ] La tabla de cotización muestra los encabezados de A.2: nombre, 📍 domicilio, y
   «Sin grupo · sin domicilio de entrega» al final. Coincide con **Q-PORTAL**.
2. [ ] **Grupo sin partidas visibles (opcional, depende del catálogo):** si tu proveedor de prueba
   tiene catálogo y un grupo tiene solo productos fuera de él, ese grupo **no** muestra encabezado.

   Ojo con el respaldo del filtro: si **ninguna** partida coincide con su catálogo, el proveedor ve
   todas.
3. [ ] **Fuera de alcance, solo anótalo si lo ves:**
   - El **resumen de materiales** de arriba del portal (`MaterialesResumenTabla`) ya sale en orden de
     grupo, pero **sin encabezados**.
   - Lo mismo la **vista de resultados** (`ResumenOfertasView`, licitación cerrada). Es de la segunda
     tanda.

### Comparativo en proceso

`/<cliente>/comprador/licitaciones-proceso/<id>`

4. [ ] **«Análisis de Ahorro por Producto»:** filas de encabezado por grupo, en el orden de Q-PORTAL.
   El renglón de totales del pie sigue igual.
5. [ ] **«Mejor Precio por Material»:** los mismos encabezados. 111 sale en el material de 101, 444 en
   el de 102 y 777 en el de 901, con tu proveedor como mejor oferta.
6. [ ] En la tabla de participantes, abre **la oferta de tu proveedor**.

   **Qué ver:** en la ventana «Oferta de …», los productos van agrupados con encabezado, y cada precio
   en su material.
7. [ ] **Licitación sin grupos:** abre el comparativo de una licitación real En Proceso.

   **Qué ver:** **no** hay filas de encabezado; se ve igual que antes.

### Orden de compra

No forma parte de esta pasada: requiere cerrar, asignar y validar. Cuando se genere una OC de una
licitación con grupos:

```sql
SELECT ocl."productoNombre", ocl."grupoNombre", ocl."grupoDomicilio"
  FROM "OrdenCompraLinea" ocl JOIN "OrdenCompra" oc ON oc.id = ocl."ordenCompraId"
  JOIN "Licitacion" l ON l.id = oc."licitacionId" WHERE l.numero = 'PRUEBA-GRUPOS';
```

Cada línea debe traer el nombre y domicilio del grupo de su partida, o `null` si no tenía grupo.

---

## Limpieza

1. [ ] Corre `scripts/sql/prueba_grupos_limpieza.sql` completo.
   - Borra también las ofertas, la invitación y el chat de tu proveedor de prueba en estas
     licitaciones, pero no el Proveedor.
   - **Aborta** si hay más de 2 licitaciones `PRUEBA-GRUPOS%`.
2. [ ] La verificación final debe salir **toda en 0**.

---

## Pendientes (anotados, sin arreglar)

**Segunda tanda de lecturas.**

- **`ResumenOfertasView` y `MaterialesResumenTabla` (portal del proveedor):** ya ordenan por grupo
  (comparten la consulta de la página), pero **sin encabezados**. El proveedor ve los materiales
  agrupados sin saber por qué. Deben llevar `FilaEncabezadoGrupo` o un equivalente.
- **Lecturas que todavía ordenan solo por `posicion`:**
  - comparativo final de selección (`seleccion-proveedores/[id]/page.tsx`)
  - licitaciones finalizadas
  - captura manual
  - PDF
  - pantallas e impresión de órdenes de compra
  - histórico de pujas
  - notificaciones de ganadores
  - resultado del proveedor
- **Líneas de la OC:** `ordenesUtils.ts` sigue creándolas en orden de `posicion`.

**`scripts/limpiar-demo.ts` está roto con la FK real.** Confirmado leyendo el script; no se corrió.
- **El script asume otra cosa:** su cabecera dice «El schema NO tiene un solo `onDelete`», y ya no es
  cierto.
- **Fallo hoy:** la línea 164 borra `LicitacionItem` sin borrar antes `SeleccionPrecioComprador`.
  La FK es RESTRICT, así que si alguna `DMY-%` tiene un precio capturado, el `deleteMany` falla.
- **Fallo con grupos:** tampoco borra `LicitacionGrupo`. Si alguna `DMY-%` se editó con grupos,
  fallará el borrado de `Licitacion`.
- **Deja la base a medias:** los `deleteMany` van sueltos, sin `$transaction`. Si uno falla, los
  anteriores (órdenes, asignaciones, ofertas) **ya se borraron**.
- **Para saber si hoy fallaría** (solo lectura):
  ```sql
  SELECT count(*) FROM "SeleccionPrecioComprador" s
    JOIN "LicitacionItem" i ON i.id = s."licitacionItemId"
    JOIN "Licitacion" l ON l.id = i."licitacionId" WHERE l.numero LIKE 'DMY-%';
  SELECT count(*) FROM "LicitacionGrupo" g
    JOIN "Licitacion" l ON l.id = g."licitacionId" WHERE l.numero LIKE 'DMY-%';
  ```

**Cerrado:**
- `onDelete` de `SeleccionPrecioComprador` en `schema.prisma`: commit `8f34584`.
- Grupos en portal, comparativo en proceso, correo y snapshot de OC (paso (d)): commit `33965b5`.
