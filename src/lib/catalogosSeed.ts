import { prisma } from "./prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

type SeedValor = { codigo: string; nombre: string; orden: number; simbolo?: string };

const SEED: Record<string, SeedValor[]> = {
  JERARQUIA: [
    { codigo: "CRITICA", nombre: "Crítica", orden: 1 },
    { codigo: "ALTA", nombre: "Alta", orden: 2 },
    { codigo: "MEDIA", nombre: "Media", orden: 3 },
    { codigo: "BAJA", nombre: "Baja", orden: 4 },
  ],
  TIPO_LICITACION: [
    { codigo: "MTS", nombre: "Made to Stock", orden: 1 },
    { codigo: "MTO", nombre: "Made to Order", orden: 2 },
    { codigo: "COT", nombre: "Cotización", orden: 3 },
    { codigo: "SVC", nombre: "Servicio", orden: 4 },
  ],
  FAMILIA: [
    { codigo: "TI", nombre: "TI", orden: 1 },
    { codigo: "INFRA", nombre: "Infraestructura", orden: 2 },
    { codigo: "PROF", nombre: "Servicios Profesionales", orden: 3 },
    { codigo: "MANUF", nombre: "Manufactura", orden: 4 },
    { codigo: "CONS", nombre: "Consumibles", orden: 5 },
    { codigo: "EQUIP", nombre: "Equipamiento", orden: 6 },
  ],
  UNIDAD_MEDIDA: [
    { codigo: "PZA", nombre: "Pieza", orden: 1 },
    { codigo: "KG", nombre: "Kilogramo", orden: 2 },
    { codigo: "LT", nombre: "Litro", orden: 3 },
    { codigo: "MT", nombre: "Metro", orden: 4 },
    { codigo: "HR", nombre: "Hora", orden: 5 },
    { codigo: "SVC", nombre: "Servicio", orden: 6 },
    { codigo: "CJA", nombre: "Caja", orden: 7 },
    { codigo: "TON", nombre: "Tonelada", orden: 8 },
    { codigo: "RLL", nombre: "Rollo", orden: 9 },
    { codigo: "JGO", nombre: "Juego", orden: 10 },
  ],
  MONEDA: [
    { codigo: "MXN", nombre: "Peso Mexicano", orden: 1, simbolo: "$" },
    { codigo: "USD", nombre: "Dólar Americano", orden: 2, simbolo: "$" },
    { codigo: "EUR", nombre: "Euro", orden: 3, simbolo: "€" },
    { codigo: "COP", nombre: "Peso Colombiano", orden: 4, simbolo: "$" },
    { codigo: "DOP", nombre: "Peso Dominicano", orden: 5, simbolo: "$" },
    { codigo: "CAD", nombre: "Dólar Canadiense", orden: 6, simbolo: "$" },
    { codigo: "GBP", nombre: "Libra Esterlina", orden: 7, simbolo: "£" },
  ],
};

export async function ensureCatalogosSeed(clienteId = "default") {
  for (const [tipo, valores] of Object.entries(SEED)) {
    for (const v of valores) {
      await db.catalogoValor.upsert({
        where: { tipo_codigo_clienteId: { tipo, codigo: v.codigo, clienteId } },
        update: {},
        create: {
          tipo,
          codigo: v.codigo,
          nombre: v.nombre,
          orden: v.orden,
          simbolo: v.simbolo ?? null,
          clienteId,
        },
      });
    }
  }
}
