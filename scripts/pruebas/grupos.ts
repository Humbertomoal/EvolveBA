/**
 * Pruebas de grupos de partidas (lógica pura, sin base de datos).
 *
 * Correr:  npx tsx scripts/pruebas/grupos.ts
 *
 * Parte 1 — servidor: validación y plan de guardado (src/lib/licitacionGrupos.ts).
 * Parte 2 — formulario: que lo que se ve es lo que se guarda (src/lib/formularioGrupos.ts).
 *
 * ── Cómo se prueba la Parte 2 ──────────────────────────────────────────────
 * `guardarYReleer` reproduce la regla de `posicion` del servidor
 * (reconciliarItems, ver LicitacionInput.reordenado):
 *   · reordenado = true  → posicion = índice en el arreglo enviado.
 *   · reordenado = false → las existentes conservan su posicion; las nuevas
 *                          toman max+1 en orden de llegada.
 * y relee como todas las lecturas: grupo.orden, luego posicion, luego id, con
 * "sin grupo" al final (nulos al final en ASC, verificado contra Postgres).
 * La prueba exige que el orden releído sea EXACTAMENTE el de la pantalla.
 */
import assert from "node:assert/strict";
import {
  decidirRetiroGrupos,
  destinoDeItem,
  llaveNombreGrupo,
  parsearCoordenadas,
  planearGrupos,
  type GrupoEnBase,
} from "../../src/lib/licitacionGrupos";
import {
  agregarPartida,
  moverGrupo,
  moverPartida,
  moverPartidaAGrupo,
  quitarGrupo,
  restaurarPartida,
  type EstadoPartidas,
  type GrupoFila,
  type Transicion,
} from "../../src/lib/formularioGrupos";

let total = 0;
function prueba(nombre: string, f: () => void) {
  f();
  total++;
  console.log("✓", nombre);
}

// ═════════════════════════════════════════════════════════════════════════════
// Parte 1 — servidor
// ═════════════════════════════════════════════════════════════════════════════

const G = (
  clave: string,
  extra: Partial<{ id: string; nombre: string; domicilio: string; coordenadas: string; eliminado: boolean }> = {}
) => ({
  clave,
  nombre: extra.nombre ?? clave,
  domicilio: extra.domicilio ?? "Dom " + clave,
  coordenadas: extra.coordenadas ?? "",
  ...extra,
});
const I = (grupoClave: string | null, eliminado = false) => ({ grupoClave, eliminado });
const GB = (id: string, extra: Partial<GrupoEnBase> = {}): GrupoEnBase => ({
  id, nombre: id.toUpperCase(), domicilio: "x", latitud: null, longitud: null, orden: 0, eliminado: false, ...extra,
});

prueba("coordenadas: formatos aceptados", () => {
  assert.deepEqual(parsearCoordenadas("20.853501, -104.486565"), { ok: true, valor: { latitud: 20.853501, longitud: -104.486565 } });
  assert.deepEqual(parsearCoordenadas("(20.85,-104.48)"), { ok: true, valor: { latitud: 20.85, longitud: -104.48 } });
  assert.deepEqual(parsearCoordenadas("20.85 -104.48"), { ok: true, valor: { latitud: 20.85, longitud: -104.48 } });
  assert.deepEqual(parsearCoordenadas("  "), { ok: true, valor: null });
});
prueba("coordenadas: rechazos", () => {
  for (const malo of ["20.85", "95, 10", "20, 190", "abc, def"]) assert.equal(parsearCoordenadas(malo).ok, false, malo);
});
prueba("nombre de grupo: ignora acentos, mayúsculas y espacios", () => {
  assert.equal(llaveNombreGrupo("  Pringón "), llaveNombreGrupo("PRINGON"));
});
prueba("crear: grupos nuevos, orden = índice, destino de cada partida", () => {
  const p = planearGrupos([], [G("a"), G("b")], [I("a"), I("b"), I(null)]);
  assert.deepEqual(p.errores, []);
  assert.deepEqual(p.aCrear.map((g) => [g.clave, g.orden]), [["a", 0], ["b", 1]]);
  assert.deepEqual(destinoDeItem(I("a"), p.destinoPorClave), { tipo: "nuevo", clave: "a" });
  assert.deepEqual(destinoDeItem(I(null), p.destinoPorClave), { tipo: "sinGrupo" });
});
prueba("validaciones del servidor", () => {
  const t = planearGrupos(
    [],
    [G("a", { nombre: " " }), G("b", { domicilio: "" }), G("c", { coordenadas: "20" }),
     G("d", { nombre: "La Mesa" }), G("e", { nombre: "la  mesa" }), G("f")],
    [I("a"), I("b"), I("c"), I("d"), I("e"), I("zzz")]
  ).errores.join("\n");
  assert.match(t, /grupo 1 necesita un nombre/);
  assert.match(t, /«b» necesita un domicilio/);
  assert.match(t, /Coordenadas del grupo «c»/);
  assert.match(t, /dos grupos llamados «La Mesa»/);
  assert.match(t, /«f» no tiene partidas/);
  assert.match(t, /partida 6 apunta a un grupo que ya no existe/);
});
prueba("partida viva en grupo quitado → error; oculta → ok y se retira", () => {
  assert.match(planearGrupos([GB("g1")], [G("g1", { id: "g1", eliminado: true })], [I("g1")]).errores.join(), /está en el grupo quitado/);
  const bien = planearGrupos([GB("g1")], [G("g1", { id: "g1", eliminado: true })], [I("g1", true)]);
  assert.deepEqual(bien.errores, []);
  assert.deepEqual(bien.aRetirar, ["g1"]);
});
prueba("aviso: domicilio sí; solo nombre u orden no", () => {
  const base = [GB("g1", { nombre: "A" }), GB("g2", { nombre: "B", domicilio: "y", latitud: 1, longitud: 2, orden: 1 })];
  const p = planearGrupos(base, [
    G("g2", { id: "g2", nombre: "B", domicilio: "y", coordenadas: "1, 2" }),
    G("g1", { id: "g1", nombre: "A renombrado", domicilio: "x nuevo" }),
  ], [I("g1"), I("g2")]);
  assert.deepEqual(p.aActualizar, [
    { id: "g2", datos: { orden: 0 } },
    { id: "g1", datos: { nombre: "A renombrado", domicilio: "x nuevo", orden: 1 } },
  ]);
  assert.deepEqual(p.destinoCambiado, ["g1"]);
  assert.deepEqual(planearGrupos([GB("g1")], [G("g1", { id: "g1", nombre: "Z", domicilio: "x" })], [I("g1")]).destinoCambiado, []);
});
prueba("restaurar grupo oculto", () => {
  const p = planearGrupos([GB("g1", { nombre: "A", eliminado: true })], [G("g1", { id: "g1", nombre: "A", domicilio: "x" })], [I("g1")]);
  assert.deepEqual(p.aActualizar, [{ id: "g1", datos: { eliminado: false, eliminadoEn: null } }]);
});
prueba("grupo quitado conserva su lugar: se actualiza su orden si cambió", () => {
  const base = [GB("g1", { orden: 0, eliminado: true }), GB("g2", { orden: 1 })];
  const p = planearGrupos(base, [G("g2", { id: "g2", nombre: "G2", domicilio: "x" }), G("g1", { id: "g1", eliminado: true })], [I("g2"), I("g1", true)]);
  assert.deepEqual(p.errores, []);
  assert.deepEqual(p.aActualizar, [{ id: "g2", datos: { orden: 0 } }, { id: "g1", datos: { orden: 1 } }]);
  assert.deepEqual(p.aRetirar, []);
});
prueba("id ajeno → grupo nuevo; grupo que ya no viene → a retirar", () => {
  assert.deepEqual(planearGrupos([], [G("x", { id: "ajeno" })], [I("x")]).aCrear.map((g) => g.clave), ["x"]);
  assert.deepEqual(planearGrupos([GB("g1")], [], []).aRetirar, ["g1"]);
});
prueba("retiro: oculta si le queda una partida, borra si no", () => {
  const r = decidirRetiroGrupos(
    ["g1", "g2", "g3"],
    [{ id: "i1", grupoId: "g1" }, { id: "i2", grupoId: "g2" }, { id: "i3", grupoId: "g3" }],
    new Map([["i3", "g9"]]),
    new Set(["i2"])
  );
  assert.deepEqual(r, { aOcultar: ["g1"], aBorrar: ["g2", "g3"] });
});

// ═════════════════════════════════════════════════════════════════════════════
// Parte 2 — formulario: lo que se ve es lo que se guarda
// ═════════════════════════════════════════════════════════════════════════════

type Fila = {
  _id: string;
  grupoClave?: string | null;
  eliminado?: boolean;
  tieneDependencias?: boolean;
  /** posicion que ya tiene en la base; ausente = partida nueva. */
  posicionEnBase?: number;
};

/** Simula guardar (regla de posicion del servidor) y releer (orden de las lecturas). */
function guardarYReleer(e: EstadoPartidas<Fila>, reordenado: boolean): string[] {
  let siguiente = Math.max(-1, ...e.items.map((i) => i.posicionEnBase ?? -1)) + 1;
  const ordenGrupo = new Map(e.grupos.map((g, i) => [g.clave, i]));
  const guardadas = e.items.map((item, indice) => ({
    id: item._id,
    posicion: reordenado ? indice : (item.posicionEnBase ?? siguiente++),
    grupoOrden: item.grupoClave != null ? (ordenGrupo.get(item.grupoClave) ?? null) : null,
  }));
  return guardadas
    .sort((a, b) => {
      const ga = a.grupoOrden ?? Number.POSITIVE_INFINITY; // nulos al final
      const gb = b.grupoOrden ?? Number.POSITIVE_INFINITY;
      return ga - gb || a.posicion - b.posicion || (a.id < b.id ? -1 : 1);
    })
    .map((x) => x.id);
}

const ids = (e: EstadoPartidas<Fila>) => e.items.map((i) => i._id);

/** Aplica una transición acumulando la bandera, como el formulario. */
function aplicar(
  estado: { e: EstadoPartidas<Fila>; reordenado: boolean },
  t: Transicion<Fila>
) {
  return { e: { items: t.items, grupos: t.grupos }, reordenado: estado.reordenado || t.reordena };
}

const grupo = (clave: string, extra: Partial<GrupoFila> = {}): GrupoFila => ({
  clave, id: clave, nombre: clave, domicilio: "dom", coordenadas: "", ...extra,
});

/** Licitación guardada: A = [a1, a2], B = [b1, b2], sin grupo = [s1]; posiciones 0..4. */
function base(): EstadoPartidas<Fila> {
  return {
    grupos: [grupo("A"), grupo("B")],
    items: [
      { _id: "a1", grupoClave: "A", posicionEnBase: 0, tieneDependencias: true },
      { _id: "a2", grupoClave: "A", posicionEnBase: 1 },
      { _id: "b1", grupoClave: "B", posicionEnBase: 2 },
      { _id: "b2", grupoClave: "B", posicionEnBase: 3 },
      { _id: "s1", grupoClave: null, posicionEnBase: 4 },
    ],
  };
}

prueba("CONTROL: mover entre grupos SIN reordenado reproduce el bug", () => {
  const t = moverPartidaAGrupo(base(), "a1", "B");
  assert.deepEqual(ids(t), ["a2", "b1", "b2", "a1", "s1"]); // a1 al final de B
  // Si el formulario NO mandara la bandera, a1 conservaría posicion 0 y al
  // releer quedaría PRIMERO en B, no al final: lo guardado ≠ lo que se veía.
  assert.notDeepEqual(guardarYReleer(t, false), ids(t));
});
prueba("mover partida a otro grupo → reordena y se guarda tal cual", () => {
  const t = moverPartidaAGrupo(base(), "a1", "B");
  assert.equal(t.reordena, true);
  assert.deepEqual(guardarYReleer(t, t.reordena), ids(t));
});
prueba("mover partida a 'sin grupo' y de vuelta → reordena y se guarda tal cual", () => {
  const t1 = moverPartidaAGrupo(base(), "b1", null);
  assert.deepEqual(ids(t1), ["a1", "a2", "b2", "s1", "b1"]);
  assert.equal(t1.reordena, true);
  assert.deepEqual(guardarYReleer(t1, true), ids(t1));
  const t2 = moverPartidaAGrupo(t1, "s1", "A");
  assert.deepEqual(ids(t2), ["a1", "a2", "s1", "b2", "b1"]);
  assert.deepEqual(guardarYReleer(t2, true), ids(t2));
});
prueba("mover un grupo → reordena y se guarda tal cual", () => {
  const t = moverGrupo(base(), "B", -1);
  assert.equal(t.reordena, true);
  assert.deepEqual(ids(t), ["b1", "b2", "a1", "a2", "s1"]);
  assert.deepEqual(guardarYReleer(t, t.reordena), ids(t));
});
prueba("quitar un grupo con una partida con ofertas → se oculta, reordena, se guarda tal cual", () => {
  const t = quitarGrupo(base(), "A");
  assert.equal(t.reordena, true);
  assert.deepEqual(ids(t), ["a1", "b1", "b2", "s1"]); // a2 (sin dependencias) sale
  assert.equal(t.items[0].eliminado, true);
  assert.equal(t.grupos.find((g) => g.clave === "A")?.eliminado, true);
  assert.deepEqual(guardarYReleer(t, t.reordena), ids(t));
});
prueba("quitar un grupo sin dependencias → sale de la lista con sus partidas", () => {
  const t = quitarGrupo(base(), "B");
  assert.equal(t.reordena, true);
  assert.deepEqual(t.grupos.map((g) => g.clave), ["A"]);
  assert.deepEqual(ids(t), ["a1", "a2", "s1"]);
  assert.deepEqual(guardarYReleer(t, t.reordena), ids(t));
});
prueba("subir/bajar intercambia solo dentro de la sección", () => {
  const t = moverPartida(base(), "b2", -1);
  assert.equal(t.reordena, true);
  assert.deepEqual(ids(t), ["a1", "a2", "b2", "b1", "s1"]);
  assert.deepEqual(guardarYReleer(t, true), ids(t));
  const frontera = moverPartida(base(), "b1", -1); // su vecina a2 es de otro grupo
  assert.equal(frontera.reordena, false);
  assert.deepEqual(ids(frontera), ids(base()));
});
prueba("agregar partida a un grupo intermedio NO necesita reordenar", () => {
  const t = agregarPartida(base(), { _id: "n1" }, "A");
  assert.equal(t.reordena, false);
  assert.deepEqual(ids(t), ["a1", "a2", "n1", "b1", "b2", "s1"]);
  assert.deepEqual(guardarYReleer(t, false), ids(t)); // max+1 la deja al final de A
});
prueba("secuencia mixta: agregar, mover entre grupos, mover grupo, quitar", () => {
  let s = { e: base(), reordenado: false };
  s = aplicar(s, agregarPartida(s.e, { _id: "n1" }, "B"));
  s = aplicar(s, moverPartidaAGrupo(s.e, "s1", "A"));
  s = aplicar(s, moverGrupo(s.e, "B", -1));
  s = aplicar(s, moverPartida(s.e, "n1", -1));
  s = aplicar(s, quitarGrupo(s.e, "A"));
  assert.equal(s.reordenado, true);
  assert.deepEqual(guardarYReleer(s.e, s.reordenado), ids(s.e));
});
prueba("licitación sin grupos: subir/bajar igual que antes", () => {
  const e: EstadoPartidas<Fila> = {
    grupos: [],
    items: [{ _id: "x", posicionEnBase: 0 }, { _id: "y", posicionEnBase: 1 }, { _id: "z", posicionEnBase: 2 }],
  };
  const t = moverPartida(e, "z", -1);
  assert.deepEqual(ids(t), ["x", "z", "y"]);
  assert.deepEqual(guardarYReleer(t, t.reordena), ids(t));
});
prueba("restaurar una partida de un grupo quitado restaura el grupo", () => {
  const quitado = quitarGrupo(base(), "A");
  const t = restaurarPartida(quitado, "a1");
  assert.equal(t.items.find((i) => i._id === "a1")?.eliminado, false);
  assert.equal(t.grupos.find((g) => g.clave === "A")?.eliminado, false);
});

console.log(`\n${total} pruebas OK`);
