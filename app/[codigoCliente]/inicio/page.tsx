import { prisma } from "@/src/lib/prisma";
import {
  CODIGO_CLIENTE_SIN_ESPECIFICAR,
  getClienteByCodigo,
} from "@/src/lib/getClienteByCodigo";
import InicioView, { type CompradorOpcion } from "./_components/InicioView";

export default async function InicioPage({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;
  const cliente = getClienteByCodigo(codigoCliente);

  if (!cliente) {
    return null;
  }

  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  // Fetch active comprador users. Uses (prisma as any) since Usuario migration
  // may not have been applied yet — falls back to a single default option.
  let compradores: CompradorOpcion[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usuarios: any[] = await db.usuario.findMany({
      where: { activo: true },
      include: { rol: { select: { nombre: true, esAdmin: true, esSupervisor: true } } },
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    });

    // Separate supervisors/admins from regular compradores
    const privilegiados = usuarios.filter(
      (u) => u.rol?.esAdmin === true || u.rol?.esSupervisor === true
    );
    const compradorNormales = usuarios.filter(
      (u) => !u.rol?.esAdmin && !u.rol?.esSupervisor
    );

    // Use compradores normales + privilegiados, or fall back to all users
    const source = usuarios.length > 0 ? usuarios : [];

    // If there are privileged users, add the "ver todos" sentinel option first
    if (privilegiados.length > 0) {
      compradores = [
        { id: "__todos__", label: "— Ver todos los compradores —" },
        ...source.map((u) => ({
          id: u.id,
          label:
            u.rol?.esAdmin
              ? `${u.nombre} ${u.apellido} (Admin)`
              : u.rol?.esSupervisor
              ? `${u.nombre} ${u.apellido} (Gerente)`
              : `${u.nombre} ${u.apellido}`,
        })),
      ];
    } else if (compradorNormales.length > 0) {
      compradores = compradorNormales.map((u) => ({
        id: u.id,
        label: `${u.nombre} ${u.apellido}`,
      }));
    }
  } catch {
    // Migration not yet applied — use default below
  }

  if (compradores.length === 0) {
    compradores = [{ id: "default", label: "Comprador 1 (default)" }];
  }

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[linear-gradient(135deg,var(--color-primario),var(--color-secundario))] px-6"
      style={
        {
          "--color-primario": cliente.colorPrimario,
          "--color-secundario": cliente.colorSecundario,
        } as React.CSSProperties
      }
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-6 -right-5 h-14 w-14 rotate-[20deg] rounded-lg bg-white/[6%]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-10 -left-8 h-16 w-16 rotate-[30deg] rounded-lg bg-white/[7%]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-10 bottom-16 h-10 w-10 rotate-[15deg] rounded-lg bg-white/[5%]"
      />

      <div className="relative z-10 flex flex-col items-center gap-10 text-center">
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cliente.logoUrl}
            alt={cliente.nombreEmpresa}
            width={48}
            height={48}
            className="rounded-lg"
          />
          <div>
            <h1 className="text-xl font-semibold text-white">
              {cliente.nombreEmpresa}
            </h1>
            <p className="text-sm text-white/70">
              Selecciona cómo quieres continuar
            </p>
          </div>
        </div>

        <InicioView basePath={basePath} compradores={compradores} />
      </div>
    </div>
  );
}
