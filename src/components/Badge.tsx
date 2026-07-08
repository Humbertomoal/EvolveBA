import {
  IconCalendar,
  IconCheck,
  IconClock,
  IconTruck,
  IconX,
} from "@tabler/icons-react";

export type BadgeVariant =
  | "en-proceso"
  | "finalizada"
  | "cancelada"
  | "programada"
  | "pendiente"
  // Order-delivery states (found in OrdenDetalle/OrdenCompradorDetalle) —
  // distinct from the licitación states above, kept as separate variants
  // so their existing color hierarchy (recibida > entregada) is preserved.
  | "en-transito"
  | "entregada"
  | "recibida"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

const VARIANTES: Record<BadgeVariant, { className: string; icon?: typeof IconClock }> = {
  "en-proceso": { className: "bg-blue-50 text-blue-700", icon: IconClock },
  finalizada: { className: "bg-green-50 text-green-700", icon: IconCheck },
  cancelada: { className: "bg-red-50 text-red-700", icon: IconX },
  programada: { className: "bg-amber-50 text-amber-700", icon: IconCalendar },
  pendiente: { className: "bg-gray-100 text-gray-600", icon: IconClock },
  "en-transito": { className: "bg-blue-100 text-blue-700", icon: IconTruck },
  entregada: { className: "bg-green-100 text-green-700", icon: IconCheck },
  recibida: { className: "bg-green-200 text-green-800", icon: IconCheck },
  success: { className: "bg-green-50 text-green-700" },
  warning: { className: "bg-amber-50 text-amber-700" },
  danger: { className: "bg-red-50 text-red-700" },
  info: { className: "bg-blue-50 text-blue-700" },
  neutral: { className: "bg-gray-100 text-gray-600" },
};

export default function Badge({
  variant,
  children,
  className,
}: {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}) {
  const { className: variantClassName, icon: Icon } = VARIANTES[variant];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClassName}${className ? ` ${className}` : ""}`}
    >
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
      {children}
    </span>
  );
}
