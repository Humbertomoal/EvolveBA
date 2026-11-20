/**
 * Pruebas del autollenado de precios del portal (lógica pura, sin base).
 *
 * Correr:  npx tsx scripts/pruebas/autollenado.ts
 */
import assert from "node:assert/strict";
import {
  esAutollenable,
  propagarDesde,
  type FilaAutollenado,
  type ItemAutollenado,
} from "../../src/lib/autollenadoPrecios";

let total = 0;
function prueba(nombre: string, f: () => void) {
  f();
  total++;
  console.log("✓", nombre);
}

type Fila = FilaAutollenado & { cantidadDisponible: string; puedeCumplirFecha: boolean };

const I = (id: string, productoId: string, grupo: string | null, extra: Partial<ItemAutollenado> = {}): ItemAutollenado => ({
  licitacionItemId: id,
  productoId,
  moneda: "MXN",
  autollenable: true,
  grupo: grupo ? { nombre: grupo } : null,
  ...extra,
});
const F = (id: string, extra: Partial<Fila> = {}): Fila => ({
  licitacionItemId: id,
  precioUnitario: "",
  estado: "cotizo",
  esProductoSimilar: false,
  productoSimilarDetalle: "",
  copiadoDe: null,
  cantidadDisponible: "10",
  puedeCumplirFecha: true,
  ...extra,
});
const por = (filas: Fila[], id: string) => filas.find((f) => f.licitacionItemId === id)!;

// a1 (La Mesa), a2 (Tepic), a3 (Sin grupo): mismo producto A. b1: otro producto.
const items = [I("a1", "A", "La Mesa"), I("b1", "B", "La Mesa"), I("a2", "A", "Tepic"), I("a3", "A", null)];

prueba("copia a las vacías del mismo producto, con la etiqueta del sitio origen", () => {
  const filas = [F("a1", { precioUnitario: "125" }), F("b1"), F("a2"), F("a3")];
  const r = propagarDesde(filas, items, "a1");
  assert.equal(por(r, "a2").precioUnitario, "125");
  assert.equal(por(r, "a3").precioUnitario, "125");
  assert.deepEqual(por(r, "a2").copiadoDe, { licitacionItemId: "a1", etiqueta: "La Mesa" });
  assert.equal(por(r, "b1").precioUnitario, "", "otro producto no se toca");
  assert.equal(por(r, "a1").copiadoDe, null);
});

prueba("nunca pisa un precio capturado ni una descripción de similar tecleada", () => {
  const filas = [F("a1", { precioUnitario: "125" }), F("b1"), F("a2", { precioUnitario: "130" }), F("a3", { productoSimilarDetalle: "x" })];
  const r = propagarDesde(filas, items, "a1");
  assert.equal(r, filas, "sin cambios → mismo arreglo");
});

prueba("solo precio + similar: cantidad y fecha no se copian", () => {
  const filas = [F("a1", { precioUnitario: "125", cantidadDisponible: "3", puedeCumplirFecha: false }), F("b1"), F("a2"), F("a3")];
  const r = propagarDesde(filas, items, "a1");
  assert.equal(por(r, "a2").cantidadDisponible, "10");
  assert.equal(por(r, "a2").puedeCumplirFecha, true);
});

prueba("copia la marca de similar y su detalle; también si se marcó DESPUÉS del precio", () => {
  let filas = [F("a1", { precioUnitario: "125" }), F("b1"), F("a2"), F("a3")];
  filas = propagarDesde(filas, items, "a1");
  // El proveedor marca "similar" en el origen después de capturar el precio.
  filas = filas.map((f) => (f.licitacionItemId === "a1" ? { ...f, esProductoSimilar: true, productoSimilarDetalle: "Modelo 720" } : f));
  filas = propagarDesde(filas, items, "a1");
  assert.equal(por(filas, "a2").esProductoSimilar, true);
  assert.equal(por(filas, "a2").productoSimilarDetalle, "Modelo 720");
});

prueba("copia viva: corregir el precio origen actualiza la copia sin marca de edición", () => {
  let filas = propagarDesde([F("a1", { precioUnitario: "125" }), F("b1"), F("a2"), F("a3")], items, "a1");
  filas = filas.map((f) => (f.licitacionItemId === "a1" ? { ...f, precioUnitario: "120" } : f));
  filas = propagarDesde(filas, items, "a1");
  assert.equal(por(filas, "a2").precioUnitario, "120");
});

prueba("copia editada a mano (sin marca) ya no se toca", () => {
  let filas = propagarDesde([F("a1", { precioUnitario: "125" }), F("b1"), F("a2"), F("a3")], items, "a1");
  // setFila quita la marca al editar; aquí se simula.
  filas = filas.map((f) => (f.licitacionItemId === "a2" ? { ...f, precioUnitario: "140", copiadoDe: null } : f));
  filas = filas.map((f) => (f.licitacionItemId === "a1" ? { ...f, precioUnitario: "110" } : f));
  filas = propagarDesde(filas, items, "a1");
  assert.equal(por(filas, "a2").precioUnitario, "140");
  assert.equal(por(filas, "a3").precioUnitario, "110");
});

prueba("una copia sin tocar no es origen (no hay cadenas)", () => {
  const filas = propagarDesde([F("a1", { precioUnitario: "125" }), F("b1"), F("a2"), F("a3")], items, "a1");
  assert.equal(propagarDesde(filas, items, "a2"), filas);
});

prueba("No dispongo / Sin costo no se copian; las vacías destino en esos estados tampoco reciben", () => {
  const nd = [F("a1", { estado: "no_dispongo", precioUnitario: "125" }), F("b1"), F("a2"), F("a3")];
  assert.equal(propagarDesde(nd, items, "a1"), nd);
  const sc = [F("a1", { estado: "no_aplica" }), F("b1"), F("a2"), F("a3")];
  assert.equal(propagarDesde(sc, items, "a1"), sc);
  const destino = [F("a1", { precioUnitario: "125" }), F("b1"), F("a2", { estado: "no_dispongo" }), F("a3", { estado: "no_aplica" })];
  assert.equal(propagarDesde(destino, items, "a1"), destino);
});

prueba("origen se queda sin precio (borrado o No dispongo) → sus copias vuelven a vacío", () => {
  let filas = propagarDesde([F("a1", { precioUnitario: "125", esProductoSimilar: true, productoSimilarDetalle: "x" }), F("b1"), F("a2"), F("a3")], items, "a1");
  const borrado = propagarDesde(filas.map((f) => (f.licitacionItemId === "a1" ? { ...f, precioUnitario: "" } : f)), items, "a1");
  assert.deepEqual(
    [por(borrado, "a2").precioUnitario, por(borrado, "a2").esProductoSimilar, por(borrado, "a2").copiadoDe],
    ["", false, null]
  );
  filas = propagarDesde(filas.map((f) => (f.licitacionItemId === "a1" ? { ...f, estado: "no_dispongo" } : f)), items, "a1");
  assert.equal(por(filas, "a3").precioUnitario, "");
});

prueba("misma moneda: no copia entre MXN y USD", () => {
  const its = [I("a1", "A", "La Mesa"), I("a2", "A", "Tepic", { moneda: "USD" })];
  const filas = [F("a1", { precioUnitario: "125" }), F("a2")];
  assert.equal(propagarDesde(filas, its, "a1"), filas);
});

prueba("flete y seguro (Servicios Profesionales) ni dan ni reciben", () => {
  assert.equal(esAutollenable("Servicios Profesionales"), false);
  assert.equal(esAutollenable("Canalización"), true);
  assert.equal(esAutollenable(null), true);
  const its = [I("f1", "FLETE", "La Mesa", { autollenable: false }), I("f2", "FLETE", "Tepic", { autollenable: false })];
  const filas = [F("f1", { precioUnitario: "5000" }), F("f2")];
  assert.equal(propagarDesde(filas, its, "f1"), filas);
});

prueba("precio inválido (0, negativo) no se copia", () => {
  for (const p of ["0", "-3", "abc"]) {
    const filas = [F("a1", { precioUnitario: p }), F("b1"), F("a2"), F("a3")];
    assert.equal(propagarDesde(filas, items, "a1"), filas, p);
  }
});

prueba("por id, no por posición: el orden del arreglo de filas no importa", () => {
  const filas = [F("a3"), F("a2"), F("b1"), F("a1", { precioUnitario: "125" })];
  const r = propagarDesde(filas, items, "a1");
  assert.deepEqual(r.map((f) => [f.licitacionItemId, f.precioUnitario]), [["a3", "125"], ["a2", "125"], ["b1", ""], ["a1", "125"]]);
});

prueba("partida sin grupo como origen → etiqueta 'partida sin grupo'", () => {
  const r = propagarDesde([F("a1"), F("b1"), F("a2"), F("a3", { precioUnitario: "9" })], items, "a3");
  assert.equal(por(r, "a1").copiadoDe?.etiqueta, "partida sin grupo");
});

console.log(`\n${total} pruebas OK`);
