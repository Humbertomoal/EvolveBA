// ─────────────────────────────────────────────────────────────────────────────
// Forma del payload del correo de invitación a una licitación.
//
// Módulo PURO (0 imports): lo consumen a la vez un Server Component
// (licitaciones-proceso/[id]/page.tsx), un módulo con Prisma
// (datosInvitacion.ts) y Client Components (ModalInvitacionLicitacion,
// LanzamientoTabla, DetalleLicitacion).
//
// ── Por qué existe este archivo ─────────────────────────────────────────────
// Este tipo vivía exportado desde DetalleLicitacion.tsx, que es un
// "use client" — y el Server Component lo importaba DESDE AHÍ. Compilaba
// (los tipos se borran en compilación), pero era la dirección equivocada:
// un archivo de servidor colgando de uno de cliente. Con el tipo aquí, el
// cliente nunca queda a un `import` de distancia de Prisma y el servidor no
// depende de un componente para saber qué forma tienen sus propios datos.
// ─────────────────────────────────────────────────────────────────────────────

/** Un material de la licitación, tal como se lista en el correo. */
export type ItemInvitacion = {
  producto: string;
  cantidad: number;
  unidad: string;
  fechaRequerida: string | null;
};

export type DatosInvitacionLicitacion = {
  fechaInicio: string | null;
  fechaFin: string | null;
  instrucciones: string;
  archivosAdjuntos: string[];
  items: ItemInvitacion[];
  /** Items filtrados al catálogo de cada proveedor invitado, por correo — para personalizar la tabla de materiales del correo. */
  itemsPorProveedor: Record<string, ItemInvitacion[]>;
  /** Razón social del proveedor, por correo — para la nota de vista previa personalizada. */
  nombrePorDestinatario: Record<string, string>;
  /**
   * URLs de fichas técnicas por correo: solo las de los materiales que ese
   * proveedor puede cotizar, deduplicadas y en orden de aparición. Se resuelven
   * en el servidor (necesitan Producto.archivosEspecificaciones).
   */
  fichasPorDestinatario: Record<string, string[]>;
  destinatarios: string[];
  excluidos: number;
  nombreComprador: string;
  correoComprador: string;
};
