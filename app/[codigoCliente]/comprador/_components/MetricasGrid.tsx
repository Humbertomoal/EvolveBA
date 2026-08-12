import {
  IconArchive,
  IconBox,
  IconClock,
  IconCoin,
  IconFileInvoice,
  IconUsers,
} from "@tabler/icons-react";
import { StatCard } from "@/src/components/Card";
import {
  MESES_VENTANA_AHORRO,
  formatMonto,
  type MetricasDashboard,
} from "@/src/lib/dashboardTypes";

/**
 * Rejilla de métricas. Server Component (solo lee datos ya calculados).
 *
 * El grid es de 7 columnas en xl porque son 6 tarjetas y la de ahorro ocupa 2:
 * 5 × 1 + 1 × 2 = 7 exacto, sin huecos. En breakpoints menores la de ahorro
 * pasa a ancho completo y las demás fluyen de a 2 o 3.
 */
export default function MetricasGrid({
  metricas,
}: {
  metricas: MetricasDashboard;
}) {
  const { licitaciones: lic } = metricas;

  // Plural con las dos palabras completas: "licitación" pierde el acento al
  // pluralizar, así que concatenar el sufijo produce "licitaciónes".
  const ahorroSubtexto =
    metricas.licitacionesConAhorro === 0
      ? `Sin licitaciones cerradas en ${MESES_VENTANA_AHORRO} meses`
      : `${metricas.ahorroPct !== null ? `${metricas.ahorroPct.toFixed(1)} % · ` : ""}${
          metricas.licitacionesConAhorro
        } ${metricas.licitacionesConAhorro === 1 ? "licitación" : "licitaciones"} · ${MESES_VENTANA_AHORRO} meses`;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-7">
      {/* Protagonista: 2 de 7 columnas y acento con el color del cliente. */}
      <StatCard
        className="col-span-2 md:col-span-3 xl:col-span-2"
        acento
        label="Ahorro acumulado"
        valor={formatMonto(metricas.ahorroTotal)}
        subtexto={ahorroSubtexto}
        icon={<IconCoin className="h-6 w-6" />}
      />

      <StatCard
        label="Activas"
        valor={lic.activas}
        // El subtexto desglosa la suma a propósito: "Activas" CONTIENE a "En
        // proceso", y sin esta línea las tres tarjetas se leerían como cubos
        // disjuntos que no cuadran.
        subtexto={`${lic.porLanzar} por lanzar · ${lic.enCierre} en cierre`}
        icon={<IconFileInvoice className="h-5 w-5" />}
      />

      <StatCard
        label="En proceso"
        valor={lic.enProceso}
        subtexto="Con rondas de puja abiertas"
        icon={<IconClock className="h-5 w-5" />}
      />

      <StatCard
        label="Cerradas"
        valor={lic.cerradas}
        subtexto={
          lic.canceladas > 0
            ? `Finalizadas · ${lic.canceladas} cancelada${lic.canceladas === 1 ? "" : "s"}`
            : "Finalizadas"
        }
        icon={<IconArchive className="h-5 w-5" />}
      />

      <StatCard
        label="Proveedores"
        valor={metricas.proveedoresActivos}
        subtexto={`Activos de ${metricas.proveedoresTotal}`}
        icon={<IconUsers className="h-5 w-5" />}
      />

      <StatCard
        label="Materiales"
        valor={metricas.materiales}
        subtexto="En el catálogo"
        icon={<IconBox className="h-5 w-5" />}
      />
    </div>
  );
}
