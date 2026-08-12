"use client";

import { useRouter } from "next/navigation";
import { IconChevronDown, IconEye, IconLogout, IconMenu2 } from "@tabler/icons-react";
import { usePageHeaderTitle } from "./PageHeaderContext";
import { useSidebarState } from "./SidebarStateContext";

const PROVEEDOR_COOKIE = "cyrgo_proveedor_id";
const VISTA_COMPRADOR = "__comprador__";

type Proveedor = { id: string; razonSocial: string };

type UsuarioInfo = {
  nombre: string;
  email: string;
  rolNombre: string | null;
};

export default function TopBar({
  esAdmin,
  basePath,
  proveedores,
  vistaActual,
  proveedorIdActual,
  usuario,
  logoutAction,
}: {
  esAdmin: boolean;
  basePath: string;
  proveedores: Proveedor[];
  vistaActual: "comprador" | "proveedor";
  proveedorIdActual?: string;
  usuario: UsuarioInfo;
  logoutAction: () => Promise<void>;
}) {
  const router = useRouter();
  const titulo = usePageHeaderTitle();
  const { toggleMobileOpen } = useSidebarState();

  function handleChangeVista(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;

    if (val === VISTA_COMPRADOR) {
      if (vistaActual === "proveedor") {
        router.push(`${basePath}/comprador`);
      }
      return;
    }

    document.cookie = `${PROVEEDOR_COOKIE}=${val}; path=/; max-age=86400; SameSite=Lax`;
    if (vistaActual === "comprador") {
      router.push(`${basePath}/proveedor/licitaciones`);
    } else {
      router.refresh();
    }
  }

  const iniciales = usuario.nombre
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-border bg-white px-4 shadow-card sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={toggleMobileOpen}
          title="Abrir menú"
          className="shrink-0 rounded-md p-1.5 text-zinc-500 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-700 md:hidden"
        >
          <IconMenu2 className="h-5 w-5" />
        </button>
        <h1 className="truncate text-lg font-semibold text-zinc-900">{titulo}</h1>
      </div>

      {/* Este bloque medía ~848px FIJOS y no encogía nunca, dentro de un header
          que a veces tiene 358px: de ahí el scroll horizontal, que no era solo
          de móvil (desbordaba en 390, 430, 640, 768 y 1024).
          La causa de fondo era el <select> de abajo; el resto es cómo se
          reparte lo que queda. `shrink-0` + los anchos acotados de cada hijo le
          dan un ancho DETERMINISTA por breakpoint y dejan que ceda el título,
          que ya tiene truncate. Sin `shrink-0`, flexbox repartía el recorte
          entre ambos y el selector terminaba en 26px —ilegible— con el título
          quedándose el espacio. */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {esAdmin && (
          <div className="flex min-w-0 items-center gap-1.5 rounded-[20px] border border-blue-200 bg-blue-50 py-1 pl-2.5 pr-1.5 text-sm text-blue-700">
            <IconEye className="h-4 w-4 shrink-0" />
            {/* El rótulo solo desde lg. Son ~92px y su información ya la da el
                ícono del ojo junto al valor seleccionado; abajo de lg valen
                más como espacio para el título de la página. */}
            <span className="hidden shrink-0 whitespace-nowrap lg:inline">
              Viendo como:
            </span>
            <select
              value={vistaActual === "proveedor" ? proveedorIdActual ?? "" : VISTA_COMPRADOR}
              onChange={handleChangeVista}
              // Un <select> nativo se dimensiona por su <option> MÁS LARGA, no
              // por la seleccionada: con razones sociales de ~48 caracteres se
              // plantaba en 345px aunque mostrara "Comprador". El tope es
              // responsivo y desaparece en xl, donde ya hay espacio de sobra —
              // así el desktop queda exactamente como estaba.
              className="w-[104px] shrink-0 cursor-pointer appearance-none truncate bg-transparent pr-1 font-medium text-blue-700 focus:outline-none sm:w-[150px] xl:w-auto"
            >
              <option value={VISTA_COMPRADOR}>Comprador</option>
              {proveedores.length > 0 && (
                <option value="" disabled>
                  ──────────────
                </option>
              )}
              {proveedores.map((p: any)=> (
                <option key={p.id} value={p.id}>
                  {p.razonSocial}
                </option>
              ))}
            </select>
            <IconChevronDown className="h-3.5 w-3.5 shrink-0" />
          </div>
        )}

        {/* Debajo de lg el rol se oculta: es contexto, no navegación, y son
            112px que a 768px de ancho hacen la diferencia entre caber y no. */}
        {usuario.rolNombre && (
          <span className="hidden shrink-0 whitespace-nowrap rounded-full border border-green-200 bg-green-50 px-3 py-1 text-sm font-medium text-green-700 lg:inline-block">
            {usuario.rolNombre}
          </span>
        )}

        {/* Bajo sm el bloque entero desaparece: sin nombre ni correo, el círculo
            de iniciales es decoración, y sus 44px son la diferencia entre un
            título legible ("Administrac…") y uno inútil ("Admi…"). En un móvil
            el título es la única pista de dónde estás — el sidebar que lo diría
            está detrás del menú hamburguesa. */}
        <div className="hidden min-w-0 items-center gap-2.5 pl-1 sm:flex">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            {iniciales}
          </div>
          {/* Entre sm y xl queda solo el avatar: el nombre y el correo son el
              bloque caro (192px) y el más prescindible de los dos, porque las
              iniciales ya identifican al usuario. */}
          <div className="hidden min-w-0 xl:block">
            <p className="truncate text-sm font-medium text-zinc-900">{usuario.nombre}</p>
            <p className="truncate text-xs text-zinc-500">{usuario.email}</p>
          </div>
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            title="Cerrar sesión"
            className="shrink-0 rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
          >
            <IconLogout className="h-[18px] w-[18px]" />
          </button>
        </form>
      </div>
    </header>
  );
}
