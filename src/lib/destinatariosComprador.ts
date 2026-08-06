// ─────────────────────────────────────────────────────────────────────────────
// Destinatarios internos de una licitación — SERVER ONLY (importa Prisma).
//
// Quién debe enterarse de lo que pasa con una licitación, del lado comprador:
//   · el comprador DUEÑO (Licitacion.compradorId), y
//   · los usuarios con rol de supervisión activos del mismo cliente.
//
// Sobre el rol de supervisión: hoy `esSupervisor` lo tiene un único rol,
// "Gerente de Compras" ("Supervisión de todas las licitaciones del sistema").
// Es DISTINTO de "Administrador" (esAdmin), que es el acceso técnico total y
// deliberadamente NO recibe estos avisos operativos.
//
// OJO: `Licitacion.compradorId` es un String suelto, no una FK — se resuelve
// con findUnique manual y puede no corresponder a ningún usuario (el fallback
// "default" de crearLicitacionAction). Por eso todo aquí tolera el vacío y
// nunca lanza: un correo sin destinatarios no debe tumbar la operación que lo
// origina.
//
// Esta lógica vivía duplicada en resultadoInternoActions.ts; se centralizó aquí
// para que el día que cambien los roles haya un solo lugar que tocar.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "./prisma";

export type DestinatariosLicitacion = {
  /** Correos únicos a los que enviar. Puede venir vacío. */
  correos: string[];
  /** Nombre del comprador dueño, para personalizar el saludo. */
  nombreComprador: string;
  /** Cuántos supervisores (Gerente de Compras) se incluyeron. */
  supervisores: number;
};

const VACIO: DestinatariosLicitacion = {
  correos: [],
  nombreComprador: "",
  supervisores: 0,
};

export async function getDestinatariosLicitacion(
  licitacionId: string
): Promise<DestinatariosLicitacion> {
  try {
    const licitacion = await prisma.licitacion.findUnique({
      where: { id: licitacionId },
      select: { compradorId: true },
    });
    if (!licitacion) return VACIO;

    const comprador = await prisma.usuario.findUnique({
      where: { id: licitacion.compradorId },
      select: { nombre: true, apellido: true, email: true, clienteId: true },
    });

    // Sin comprador resuelto no hay cliente contra el cual buscar supervisores.
    const supervisores = comprador
      ? await prisma.usuario.findMany({
          where: {
            clienteId: comprador.clienteId,
            activo: true,
            id: { not: licitacion.compradorId },
            rol: { esSupervisor: true },
          },
          select: { email: true },
        })
      : [];

    const correos = [
      ...new Set(
        [comprador?.email, ...supervisores.map((s) => s.email)].filter(
          (email): email is string => Boolean(email)
        )
      ),
    ];

    return {
      correos,
      nombreComprador: comprador
        ? `${comprador.nombre} ${comprador.apellido}`.trim()
        : "",
      supervisores: supervisores.filter((s) => s.email).length,
    };
  } catch (error) {
    console.error("[getDestinatariosLicitacion] fallo al resolver", error);
    return VACIO;
  }
}
