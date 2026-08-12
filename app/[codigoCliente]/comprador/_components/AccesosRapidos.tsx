import Link from "next/link";
import { IconBox, IconPlus, IconSend, IconUsers } from "@tabler/icons-react";

/**
 * Los tres arranques del ciclo de compras. Server Component: son Links puros,
 * sin estado ni handlers, así que no hay razón para mandarlos al cliente.
 */
export default function AccesosRapidos({ basePath }: { basePath: string }) {
  const accesos = [
    {
      href: `${basePath}/comprador/catalogo/nuevo`,
      label: "Nuevo material",
      descripcion: "Alta en el catálogo de productos",
      icon: <IconBox className="h-5 w-5" />,
    },
    {
      href: `${basePath}/comprador/proveedores/nuevo`,
      label: "Nuevo proveedor",
      descripcion: "Alta con RFC, contacto y materiales",
      icon: <IconUsers className="h-5 w-5" />,
    },
    {
      href: `${basePath}/comprador/licitaciones/nueva`,
      label: "Nueva licitación",
      descripcion: "Materiales, fechas y proveedores",
      icon: <IconSend className="h-5 w-5" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {accesos.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="group flex items-center gap-4 rounded-card border border-border bg-white p-4 shadow-card transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-primary-light text-primary transition-colors duration-150 ease-out group-hover:bg-primary group-hover:text-white">
            {a.icon}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1 text-sm font-semibold text-zinc-800">
              <IconPlus className="h-3.5 w-3.5 shrink-0 text-primary" />
              {a.label}
            </span>
            <span className="mt-0.5 block truncate text-xs text-zinc-400">
              {a.descripcion}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
