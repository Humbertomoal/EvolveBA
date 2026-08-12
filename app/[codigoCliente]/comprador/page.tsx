import { redirect } from "next/navigation";
import { IconAlertTriangle, IconChartBar, IconEye, IconUser } from "@tabler/icons-react";
import Link from "next/link";
import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { getCompradorSession } from "@/src/lib/compradorSession";
import { getCompradorSesionSegura } from "@/src/lib/compradorSessionSegura";
import { getUsuarioActual } from "@/src/lib/usuarioActual";
import {
  avanzarEstadosPendientes,
  getDashboardData,
} from "@/src/lib/dashboardQueries";
import { MESES_VENTANA_AHORRO, formatMonto } from "@/src/lib/dashboardTypes";
import { Card } from "@/src/components/Card";
import { PageTitle } from "@/app/_components/PageHeaderContext";
import AccesosRapidos from "./_components/AccesosRapidos";
import AhorroMensualChart from "./_components/AhorroMensualChart";
import MetricasGrid from "./_components/MetricasGrid";
import NecesitaAtencion from "./_components/NecesitaAtencion";
import TopProveedoresChart from "./_components/TopProveedoresChart";

const FORMATO_FECHA = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function CompradorDashboardPage({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  // ── Guarda de lectura ─────────────────────────────────────────────────────
  // proxy.ts exige sesión pero NUNCA compara tipoUsuario contra la sección (la
  // lee solo para el log), así que hasta ahora un PROVEEDOR autenticado podía
  // cargar /comprador. Esta pantalla agrega el ahorro de todos los compradores,
  // así que la identidad se resuelve contra el JWT firmado + la BD, no contra la
  // cookie de alcance.
  //
  // Se usa getCompradorSesionSegura (que devuelve null) y NO exigirCompradorSesion
  // (que lanza): esa es para server actions, donde una escritura sin identidad
  // debe fallar ruidosamente. Aquí lo correcto es mandar a login, no reventar.
  const sesionSegura = await getCompradorSesionSegura();
  if (!sesionSegura) redirect("/login");

  // Alcance de lo que se muestra: "ver todo" vs "solo mías". Es filtrado de UI
  // sobre la cookie cyrgo_comprador_id, no autorización — la de arriba ya pasó.
  const alcance = await getCompradorSession();

  // El avance perezoso va ANTES de leer: sin esto el dashboard —que ahora es la
  // primera pantalla tras el login— mostraría rondas ya vencidas como vivas y
  // licitaciones "Programada" que debieron arrancar. Es idempotente (CAS).
  await avanzarEstadosPendientes(alcance);

  const [usuario, data] = await Promise.all([
    getUsuarioActual(),
    getDashboardData(alcance, basePath),
  ]);

  const nombreCorto = (usuario?.nombre ?? "").trim().split(/\s+/)[0] || "de nuevo";
  const hoy = FORMATO_FECHA.format(new Date());

  return (
    <div className="max-w-7xl space-y-6">
      <PageTitle title="Panel de Comprador" />

      {/* ── Saludo ─────────────────────────────────────────────────────────── */}
      <header
        className="flex flex-wrap items-end justify-between gap-3 animate-fade-in-up"
        style={{ animationDelay: "0ms" }}
      >
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">
            Hola, {nombreCorto}
          </h1>
          <p className="mt-0.5 text-sm text-zinc-400 first-letter:uppercase">
            {hoy}
          </p>
        </div>

        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-zinc-500 shadow-card"
          title={
            alcance.puedeVerTodo
              ? "Estás viendo las licitaciones de todos los compradores"
              : "Estás viendo solo tus licitaciones"
          }
        >
          {alcance.puedeVerTodo ? (
            <IconEye className="h-3.5 w-3.5 text-primary" />
          ) : (
            <IconUser className="h-3.5 w-3.5 text-primary" />
          )}
          {alcance.puedeVerTodo ? "Todos los compradores" : "Solo mis licitaciones"}
        </span>
      </header>

      {/* ── Accesos rápidos ────────────────────────────────────────────────── */}
      <section
        className="animate-fade-in-up"
        style={{ animationDelay: "40ms" }}
        aria-label="Accesos rápidos"
      >
        <AccesosRapidos basePath={basePath} />
      </section>

      {/* ── Métricas ───────────────────────────────────────────────────────── */}
      <section
        className="animate-fade-in-up"
        style={{ animationDelay: "80ms" }}
        aria-label="Métricas"
      >
        <MetricasGrid metricas={data.metricas} />
      </section>

      {/* ── Gráfica + atención ─────────────────────────────────────────────── */}
      {/* Auto-balanceo de columnas. La izquierda es un flex vertical con dos
          tarjetas: la de ahorro mide lo que mide su gráfica (altura fija) y la
          de proveedores lleva flex-1, así que ABSORBE la diferencia contra el
          panel de atención, que crece y encoge con los pendientes que haya.
          Una altura fija aquí cuadraría con los datos de hoy y descuadraría
          mañana. El min-h de la tarjeta de abajo cubre el caso contrario: que
          el panel derecho quede tan corto que las barras no respiren. */}
      <section
        className="grid grid-cols-1 gap-4 animate-fade-in-up lg:grid-cols-3"
        style={{ animationDelay: "120ms" }}
      >
        <div className="flex flex-col gap-4 lg:col-span-2">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Ahorro por mes</h2>
              <p className="mt-0.5 text-xs text-zinc-400">
                Últimos {MESES_VENTANA_AHORRO} meses · MXN · línea base de promedio
              </p>
            </div>
            <Link
              href={`${basePath}/comprador/tablero`}
              className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <IconChartBar className="h-3.5 w-3.5" />
              Tablero
            </Link>
          </div>

          <div className="mt-3">
            <AhorroMensualChart data={data.ahorroMensual} />
          </div>

          {/* Sin este aviso, los importes en moneda extranjera sin tasa se
              suman como si fueran MXN —en silencio y por debajo de su valor
              real— porque conversionMoneda cae a tasa 1 por compatibilidad. */}
          {data.avisoTiposCambio.length > 0 && (
            <p className="mt-3 flex items-start gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <IconAlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>
                Falta el tipo de cambio en{" "}
                {data.avisoTiposCambio.length === 1
                  ? `la licitación ${data.avisoTiposCambio[0]}`
                  : `${data.avisoTiposCambio.length} licitaciones (${data.avisoTiposCambio
                      .slice(0, 3)
                      .join(", ")}${data.avisoTiposCambio.length > 3 ? "…" : ""})`}
                . Su ahorro puede estar subestimado.
              </span>
            </p>
          )}
        </Card>

        {/* min-h: en móvil no hay columna que estirar (flex-1 no aplica), así
            que este es el alto real del gráfico. 400px deja ~34px por barra
            con las 8 del ranking. */}
        <Card className="flex min-h-[400px] flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Top proveedores</h2>
              <p className="mt-0.5 text-xs text-zinc-400">
                Últimos {MESES_VENTANA_AHORRO} meses · MXN adjudicado
              </p>
            </div>
            {data.totalAdjudicadoMXN > 0 && (
              <p className="shrink-0 text-right text-xs text-zinc-400">
                <span className="font-semibold text-zinc-600">
                  {formatMonto(data.totalAdjudicadoMXN)}
                </span>
                <br />
                total adjudicado
              </p>
            )}
          </div>

          {/* min-h-0 es obligatorio: sin él este hijo flex no puede encogerse
              por debajo de su contenido y el ResponsiveContainer al 100 % no
              obtiene una altura definida contra la cual medirse. */}
          <div className="mt-3 min-h-0 flex-1">
            <TopProveedoresChart data={data.topProveedores} />
          </div>
        </Card>
        </div>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-zinc-900">
            Lo que necesita tu atención
          </h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            Pendientes accionables, del más viejo al más nuevo
          </p>

          <div className="mt-4">
            <NecesitaAtencion bloques={data.atencion} />
          </div>
        </Card>
      </section>
    </div>
  );
}
