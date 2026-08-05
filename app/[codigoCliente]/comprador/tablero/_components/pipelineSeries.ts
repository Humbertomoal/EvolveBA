import {
  CATEGORIAS_PIPELINE,
  LABEL_CATEGORIA,
  type CategoriaLicitacion,
} from "@/src/lib/tableroCategorias";

// Series y colores compartidos por las dos gráficas del pipeline, para que una
// misma categoría tenga siempre el mismo color en ambas. Los labels salen de
// LABEL_CATEGORIA: el vocabulario visible se define en un solo lugar.

export const COLOR_CATEGORIA: Record<CategoriaLicitacion, string> = {
  en_construccion: "rgba(148, 163, 184, 0.85)", // gris — aún no arranca
  por_lanzar: "rgba(59, 130, 246, 0.85)", // azul
  en_licitacion: "rgba(20, 184, 166, 0.85)", // verde azulado — activa
  en_cierre: "rgba(245, 158, 11, 0.85)", // ámbar — requiere decisión
  terminadas: "rgba(34, 197, 94, 0.85)", // verde
  cancelada: "rgba(203, 213, 225, 0.85)", // gris claro — fuera del flujo
};

export const SERIES_PIPELINE: { clave: CategoriaLicitacion; label: string }[] =
  CATEGORIAS_PIPELINE.map((clave) => ({ clave, label: LABEL_CATEGORIA[clave] }));
