import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/src/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Landing comercial de Evolve BA (solo Evolve BA, no multi-tenant).
// Recreada del diseño de referencia del diseñador: contenido, colores, radios,
// sombras y espaciados fijos (hardcodeados). Server Component: las animaciones
// son CSS puro (globals.css) y el input de demo es visual (sin backend).
//
// Paleta:
//   verde primario #173F35 (variantes #1F5445 #1B4A3C #0F2A22 #1B4D3E)
//   menta acento   #8FE3A6 (#A6F0BC hover)
//   cremas         #FAFAF8 #F1F0E9 · textos #16201A #5C665F #6B756E #3A473F
//   bordes         #EFEEE8 #E7E5DF #D8D5CB
// ─────────────────────────────────────────────────────────────────────────────

// ── Íconos reutilizables (SVG en JSX) ──────────────────────────────────────────
type IconProps = { size?: number; stroke?: string; sw?: number };

function IconSend({ size = 22, stroke = "#8FE3A6", sw = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}
function IconCheck({ size = 22, stroke = "#8FE3A6", sw = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
function IconBolt({ size = 22, stroke = "#1B4D3E", sw = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h7l-1 8 11-14h-7l1-6z" />
    </svg>
  );
}
function IconArrowRight({ size = 16, stroke = "#0F332A", sw = 2.4 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function IconBarChart({ size = 22, stroke = "#8FE3A6", sw = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <rect x="7" y="12" width="3" height="6" />
      <rect x="12" y="8" width="3" height="10" />
      <rect x="17" y="5" width="3" height="13" />
    </svg>
  );
}
function IconClock({ size = 22, stroke = "#8FE3A6", sw = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}
function IconTruck({ size = 22, stroke = "#8FE3A6", sw = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="7" width="15" height="10" rx="1.5" />
      <path d="M16 10h4l3 3v4h-7" />
      <circle cx="6" cy="19" r="1.6" />
      <circle cx="18" cy="19" r="1.6" />
    </svg>
  );
}

// ── Logo (3 barras en cuadrado verde) — TODO: quizá reemplazar por SVG real ─────
function Logo({ box = 38, bar = 20, thick = 3, radius = 10, barColor = "#FAFAF8", boxColor = "#173F35" }: {
  box?: number; bar?: number; thick?: number; radius?: number; barColor?: string; boxColor?: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{ width: box, height: box, borderRadius: radius, background: boxColor, gap: Math.max(2, thick - 1), padding: Math.round(box * 0.16) }}
    >
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: bar, height: thick, background: barColor, borderRadius: 2 }} />
      ))}
    </div>
  );
}

// ── Placeholder de imagen pendiente (elegante) ─────────────────────────────────
// TODO: reemplazar con imagen real usando next/image cuando estén las fotos.
function ImagePlaceholder({ label, circle = false, className = "" }: { label: string; circle?: boolean; className?: string }) {
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-2 border border-dashed border-[#D8D5CB] bg-gradient-to-br from-[#F1F0E9] to-[#E7E5DF] text-center ${circle ? "rounded-full" : "rounded-[16px]"} ${className}`}
    >
      <svg width={circle ? 18 : 26} height={circle ? 18 : 26} viewBox="0 0 24 24" fill="none" stroke="#9AA69E" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
      {!circle && <span className="px-3 text-[11px] font-semibold leading-tight text-[#9AA69E]">{label}</span>}
    </div>
  );
}

// ── Datos fijos (convertidos de los sc-for de la referencia) ────────────────────
const SIDEBAR_ITEMS = [
  { label: "Administración de Proveedores", active: "#1F5445", dot: 1 },
  { label: "Catálogo de Productos", active: "transparent", dot: 0.3 },
  { label: "Lanzamiento de Licitaciones", active: "transparent", dot: 0.3 },
  { label: "Licitaciones en Proceso", active: "transparent", dot: 0.3 },
  { label: "Selección de Proveedores", active: "transparent", dot: 0.3 },
  { label: "Licitaciones Finalizadas", active: "transparent", dot: 0.3 },
  { label: "Órdenes de Compra", active: "transparent", dot: 0.3 },
  { label: "Tablero de Indicadores", active: "transparent", dot: 0.3 },
];
const HERO_STATS = [
  { label: "LICITACIONES ACTIVAS", value: "12" },
  { label: "PROVEEDORES ACTIVOS", value: "48" },
  { label: "AHORRO GENERADO", value: "18%" },
];
const BAR_HEIGHTS = ["30%", "45%", "55%", "40%", "70%", "95%"];
const INDUSTRY_REPORTS = [
  { label: "Tiempo promedio de licitación", value: "6.2 días", pct: "62%" },
  { label: "Proveedores calificados activos", value: "84%", pct: "84%" },
  { label: "Ahorro vs. presupuesto", value: "17%", pct: "45%" },
  { label: "Adherencia de Precios", value: "98%", pct: "98%" },
];
const INDUSTRIES = ["Manufactura", "Energía", "Retail", "Construcción", "Servicios"];

const VALUE_PROPS = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1B4D3E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3.5" /><path d="M12 17h.01" />
      </svg>
    ),
    title: "Sin Costo de Implementación",
    desc: "El uso de PO se paga con un % de los ahorros que su tecnología genera en tu operación.",
  },
  {
    icon: <IconBolt size={22} stroke="#1B4D3E" />,
    title: "Agilidad de punta a punta",
    desc: "Reduce los tiempos de negociación y de análisis de ofertas de proveedores en tu proceso de compras.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1B4D3E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="3" /><circle cx="18" cy="18" r="3" /><path d="M8.5 8.5l7 7M6 9v2a5 5 0 0 0 5 5h1" />
      </svg>
    ),
    title: "Integración con tu ERP",
    desc: "Conecta con SAP, Oracle, Dynamics o tu sistema a medida vía API, sin doble captura.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1B4D3E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" />
      </svg>
    ),
    title: "Automatización del proceso",
    desc: "Tu proceso de negociación y análisis de cotizaciones, validaciones, notificaciones y seguimiento automático en cada etapa de compras.",
  },
  {
    icon: <IconBarChart size={22} stroke="#1B4D3E" />,
    title: "Reportes por industria",
    desc: "Tableros de indicadores configurados con el desempeño de todo tu proceso de compras de punta a punta.",
  },
];

const FLUJO_STEPS = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8FE3A6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" />
      </svg>
    ),
    title: "Alta de proveedor",
    desc: "Centraliza a todos tus proveedores en un solo lugar, Se acabaron las hojas de Excel dispersas.",
  },
  { icon: <IconSend size={22} />, title: "Lanzamiento", desc: "Se publica la licitación a proveedores calificados." },
  { icon: <IconClock size={22} />, title: "En proceso", desc: "Proveedores cotizan en tiempo real, consigues reducir tus costos gracias a la tecnología." },
  { icon: <IconCheck size={22} />, title: "Selección", desc: "Comparativa y adjudicación con trazabilidad total." },
  { icon: <IconTruck size={22} />, title: "Orden de compra", desc: "Se genera y sincroniza con tu ERP." },
];

const MODULOS = [
  {
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#8FE3A6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: "Administración de Proveedores",
    desc: "Alta, edición y activación con RFC, contacto, domicilio y materiales que provee. Historial completo con soft delete.",
    highlight: "Centraliza todo en un lugar y elimina las hojas de Excel dispersas.",
  },
  {
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#8FE3A6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" />
      </svg>
    ),
    title: "Catálogo de Productos",
    desc: "Vista galería o tabla de materiales y servicios, con código único, unidad de medida y familia.",
    highlight: "Evita duplicados y acelera la creación de licitaciones.",
  },
  {
    icon: <IconSend size={19} />,
    title: "Lanzamiento de Licitaciones",
    desc: "Registro completo de materiales, precios objetivo, fechas y proveedores. Licitación abierta o cotización manual.",
    highlight: "De días a minutos: el sistema notifica a proveedores automáticamente.",
    destacado: true,
    nota: "Tecnología que reduce hasta el 20% de los costos de tus compras.",
  },
  {
    icon: <IconClock size={19} />,
    title: "Licitaciones en Proceso",
    desc: "Proveedores cotizan en tiempo real, consigues reducir tus costos gracias a la tecnología.",
    highlight: "La competencia entre rondas baja precios de forma automática.",
    destacado: true,
    nota: "Tecnología que reduce hasta el 20% de los costos de tus compras.",
  },
  {
    icon: <IconCheck size={19} />,
    title: "Selección de Proveedores",
    desc: "Asignación automática de ganadores por material, con split de cantidad y ajuste manual al final en caso de ser necesario.",
    highlight: "Reparte automáticamente entre proveedores garantizando la totalidad de tus cantidades de compra.",
    destacado: true,
    nota: "Tecnología que reduce hasta el 20% de los costos de tus compras.",
  },
  {
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#8FE3A6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="6" rx="1.5" /><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" /><path d="M10 13h4" />
      </svg>
    ),
    title: "Licitaciones Finalizadas",
    desc: "Historial con ganadores, asignación y detalle de pujas por ronda.",
    highlight: "Auditoría completa y cumplimiento de transparencia en compras.",
  },
  {
    icon: <IconTruck size={19} />,
    title: "Órdenes de Compra",
    desc: "con integración a tu ERP si lo necesitas.",
    highlight: "Trazabilidad completa de la licitación a la entrega.",
  },
  {
    icon: <IconBarChart size={19} />,
    title: "Tablero de Indicadores",
    desc: "KPIs de ahorro, precio inicial vs. final, y adherencia por proveedor.",
    highlight: "Visibilidad ejecutiva del desempeño de compras.",
  },
  {
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#8FE3A6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
    title: "Configuración",
    desc: "Catálogos, usuarios y permisos granulares por módulo (ver/crear/editar/eliminar).",
    highlight: "Adapta el sistema a tu empresa sin tocar código.",
  },
];
const LOGOS_EMPRESAS = [
  { nombre: "Gerdau", src: "/Logos/gerdau.svg" },
  { nombre: "Diaco", src: "/Logos/diaco.svg" },
  { nombre: "Metaldom", src: "/Logos/metaldom.svg" },
  { nombre: "Cyrgo", src: "/Logos/cyrgo.svg" },
  { nombre: "Riansa", src: "/Logos/riansa.svg" },
  { nombre: "Grupo Las Hadas", src: "/Logos/grupo-las-hadas.svg" },
  { nombre: "IM Solutions", src: "/Logos/im-solutions.svg" },
];
const ERP_LOGOS = [
  {
    name: "SAP",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8FE3A6" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="6" rx="1.5" /><rect x="3" y="14" width="18" height="6" rx="1.5" /><circle cx="7" cy="7" r="0.8" fill="#8FE3A6" /><circle cx="7" cy="17" r="0.8" fill="#8FE3A6" />
      </svg>
    ),
  },
  {
    name: "Oracle",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8FE3A6" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18" />
      </svg>
    ),
  },
  {
    name: "Dynamics",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8FE3A6" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" />
      </svg>
    ),
  },
  {
    name: "NetSuite",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8FE3A6" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4l16 16M20 4L4 20" /><circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  {
    name: "Odoo",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8FE3A6" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" /><circle cx="5" cy="6" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="5" cy="18" r="2" /><circle cx="19" cy="18" r="2" />
      </svg>
    ),
  },
  {
    name: "API propia",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8FE3A6" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3L4 7l4 4M16 3l4 4-4 4M11 20l2-16" />
      </svg>
    ),
  },
];

const ERP_BULLETS = [
  "Conectores nativos para los ERPs más usados.",
  "Sincronización bidireccional de datos.",
  "Implementación guiada sin interrumpir tu operación.",
];

// ── Estilos compartidos ────────────────────────────────────────────────────────
const SECTION_X = "px-5 md:px-16"; // 64px en desktop, ~20px en móvil
const EYEBROW = "text-[13px] font-bold tracking-[0.04em] text-[#1B4D3E]";

export default async function Home() {
  const session = await auth();
  if (session) {
    const tipo = (session.user as { tipoUsuario?: string })?.tipoUsuario ?? "comprador";
    redirect(tipo === "proveedor" ? "/proveedor" : "/comprador");
  }

  return (
    <div
      className="w-full overflow-x-hidden text-[#16201A]"
      style={{ background: "#FAFAF8", fontFamily: "var(--font-manrope), sans-serif" }}
    >
      {/* ── NAV ───────────────────────────────────────────────────────────── */}
      <nav
        className={`sticky top-0 z-50 flex items-center justify-between border-b border-[#E7E5DF] py-4 ${SECTION_X}`}
        style={{ background: "rgba(250,250,248,0.85)", backdropFilter: "blur(10px)" }}
      >
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#173F35]">Evolve BA</span>
        </div>

        {/* Links centrales — se ocultan en móvil */}
        <div className="hidden items-center gap-9 lg:flex">
          <a href="#modulos" className="text-[15px] font-semibold text-[#3A473F] hover:text-[#173F35]">Módulos</a>
          <a href="#flujo" className="text-[15px] font-semibold text-[#3A473F] hover:text-[#173F35]">Cómo funciona</a>
          <a href="#integracion" className="text-[15px] font-semibold text-[#3A473F] hover:text-[#173F35]">Integraciones</a>
          <a href="#reportes" className="text-[15px] font-semibold text-[#3A473F] hover:text-[#173F35]">Reportes</a>
        </div>

        {/* Dos botones — siempre visibles */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="rounded-full border-[1.5px] border-[#173F35] px-3 py-2 text-[14px] font-bold text-[#173F35] transition-colors hover:bg-[#173F35] hover:text-[#EFFBF3] sm:px-5 sm:text-[15px]"
          >
            Acceder al portal
          </Link>
          <a
            href="#contacto"
            className="rounded-full bg-[#173F35] px-3 py-2 text-[14px] font-bold text-[#EFFBF3] transition-colors hover:bg-[#0F332A] sm:px-5 sm:text-[15px]"
          >
            Solicitar demo
          </a>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section
        className={`relative overflow-hidden pt-20 md:pt-[100px] ${SECTION_X}`}
        style={{ background: "radial-gradient(1100px 560px at 82% -10%, #1F5445 0%, #173F35 55%, #0F2A22 100%)" }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{ backgroundImage: "radial-gradient(rgba(250,250,248,0.06) 1px, transparent 1px)", backgroundSize: "26px 26px" }}
        />

        {/* tarjeta de barras flotante (decorativa) — solo desktop */}
        <div
          className="absolute right-[7%] top-16 hidden rounded-[16px] border border-[rgba(250,250,248,0.18)] p-4 lg:block"
          style={{ background: "rgba(250,250,248,0.1)", backdropFilter: "blur(6px)", animation: "floatSlow 7s ease-in-out infinite", boxShadow: "0 20px 40px rgba(0,0,0,0.25)" }}
        >
          <div className="mb-2.5 flex items-center justify-between gap-5">
            <div className="text-[11.5px] font-bold tracking-[0.03em] text-[#9FB3A8]">LICITACIONES CERRADAS</div>
            <div className="text-[11.5px] font-bold text-[#8FE3A6]">+24%</div>
          </div>
          <div className="flex h-[34px] items-end gap-[5px]">
            {["40%", "55%", "45%", "70%", "60%", "100%"].map((h, i) => (
              <div key={i} className="w-[7px] rounded-t-[3px]" style={{ height: h, background: i === 5 ? "#8FE3A6" : `rgba(143,227,166,${0.35 + i * 0.06})` }} />
            ))}
          </div>
        </div>

        {/* pill "Licitación enviada" — solo desktop */}
        <div
          className="absolute right-[4%] top-[520px] z-[2] hidden items-center gap-2 rounded-full border border-[rgba(250,250,248,0.18)] px-4 py-2.5 lg:flex"
          style={{ background: "rgba(250,250,248,0.1)", animation: "floatSlow 6s ease-in-out infinite 1s" }}
        >
          <IconSend size={14} sw={2.6} />
          <div className="text-[12.5px] font-bold text-[#EFF5F1]">Licitación enviada</div>
        </div>

        {/* Copy central */}
        <div className="relative mx-auto max-w-[680px] pb-14 text-center">
          <div
            className="mb-7 inline-flex items-center gap-2 rounded-full px-4 py-[7px] text-[13px] font-bold tracking-[0.02em] text-[#8FE3A6]"
            style={{ background: "rgba(143,227,166,0.14)", animation: "fadeUp 0.6s ease both" }}
          >
            <span className="h-[7px] w-[7px] rounded-full bg-[#8FE3A6]" style={{ animation: "pulseDot 1.8s ease-in-out infinite" }} />
             ¡Conoce a PO! Tu Purchase Optimizer
          </div>
          <h1
            className="mb-[22px] text-[40px] font-extrabold leading-[1.06] tracking-[-0.03em] text-[#FAFAF8] text-pretty md:text-[58px]"
            style={{ animation: "fadeUp 0.7s ease 0.05s both" }}
          >
            Automatiza todas tus negociaciones y ahorra el 20% o más de tus Costos.
          </h1>
          <p
            className="mx-auto mb-9 max-w-[560px] text-[17px] font-medium leading-[1.55] text-[#C7D6CE] md:text-[19px]"
            style={{ animation: "fadeUp 0.7s ease 0.1s both" }}
          >
            Automatiza parcial o totalmente tu proceso de compras y reduce tus principales Costos con tecnología desarrollada por Evolve BA.
          </p>
          <p
            className="mx-auto mb-9 max-w-[520px] text-[14px] font-medium italic leading-[1.5] text-[#9FB3A8]"
            style={{ animation: "fadeUp 0.7s ease 0.13s both" }}
          >
            *Si tienes ERP, pregunta por la integración y automatización entre tecnologías (SAP, Oracle, Dynamics o tu sistema a medida vía API).
          </p>
          <div className="flex flex-wrap justify-center gap-4" style={{ animation: "fadeUp 0.7s ease 0.15s both" }}>
            <a href="#contacto" className="flex items-center gap-2 rounded-full bg-[#8FE3A6] px-7 py-[15px] text-[16px] font-bold text-[#0F332A] transition-colors hover:bg-[#A6F0BC]">
              Agendar una demo
              <IconArrowRight size={16} stroke="#0F332A" />
            </a>
            <a href="#modulos" className="rounded-full border-[1.5px] border-[rgba(250,250,248,0.3)] px-7 py-[15px] text-[16px] font-bold text-[#FAFAF8] transition-colors hover:bg-[rgba(250,250,248,0.08)]">
              Ver módulos
            </a>
          </div>
        </div>

      {/* Mock del producto (dashboard) */}
        <div className="relative mx-auto max-w-[1180px] px-0 pb-24 md:px-5">
          <div
            className="relative overflow-hidden rounded-[20px] border border-[rgba(250,250,248,0.14)] bg-[#FAFAF8]"
            style={{ boxShadow: "0 50px 100px rgba(0,0,0,0.4)", animation: "fadeUp 0.8s ease 0.2s both" }}
          >
            <img
              src="/img/mockup-tablero.png"
              alt="Tablero de indicadores de PO"
              className="w-full"
            />
          </div>

          {/* badges flotantes sobre el mock — solo desktop */}
          <div
            className="absolute -left-1.5 top-[60px] hidden items-center gap-2.5 rounded-[14px] bg-white px-[18px] py-3.5 lg:flex"
            style={{ boxShadow: "0 20px 40px rgba(0,0,0,0.25)", animation: "floatSlow 5.5s ease-in-out infinite" }}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EFFBF3]">
              <IconCheck size={17} stroke="#1B4D3E" sw={2.4} />
            </div>
            <div>
              <div className="text-[12.5px] font-bold text-[#173F35]">Proveedor validado</div>
              <div className="text-[11px] text-[#8B968F]">Catálogo aprobado</div>
            </div>
          </div>
          <div
            className="absolute bottom-[120px] right-0 hidden items-center gap-2.5 rounded-[14px] bg-white px-[18px] py-3.5 lg:flex"
            style={{ boxShadow: "0 20px 40px rgba(0,0,0,0.25)", animation: "floatSlow 6.5s ease-in-out infinite 0.6s" }}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EFFBF3]">
              <IconBolt size={17} stroke="#1B4D3E" sw={2.2} />
            </div>
            <div>
              <div className="text-[12.5px] font-bold text-[#173F35]">Sincronizado con ERP</div>
              <div className="text-[11px] text-[#8B968F]">Hace 2 minutos</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ───────────────────────────────────────────────────── */}
      <section className={`mx-auto grid max-w-[1100px] grid-cols-1 gap-6 border-b border-[#EFEEE8] py-10 sm:grid-cols-2 lg:grid-cols-4 ${SECTION_X}`}>
        {[
          {
            icon: (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#173F35" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M13 2v8h8" /><path d="M20.5 15a8.5 8.5 0 1 1-6-8.1" /></svg>
            ),
            value: "70%",
            label: "de Reducción en el tiempo de compras",
          },
          {
            icon: (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#173F35" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
            ),
            value: "hasta 30%",
            label: "de Ahorro en Costos",
          },
          {
            icon: (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#173F35" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
            ),
            value: "1 sola",
            label: "Platarforma Centralizada",
          },
          {
            icon: (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#173F35" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" /><rect x="12" y="8" width="3" height="10" /><rect x="17" y="5" width="3" height="13" /></svg>
            ),
            value: "100% de trasabilidad",
            label: "Indicadores del Proceso de Punta a Punta",
          },
        ].map((s) => (
          <div key={s.label} className="flex items-center justify-center gap-4">
            {s.icon}
            <div>
              <div className="text-[26px] font-extrabold text-[#173F35]">{s.value}</div>
              <div className="text-[13.5px] font-semibold text-[#6B756E]">{s.label}</div>
            </div>
          </div>
        ))}
      </section>

     {/* ── TRUST BAR ─────────────────────────────────────────────────────── */}
      <section className={`mx-auto max-w-[1280px] border-b border-[#EFEEE8] py-14 ${SECTION_X}`}>
        <div className="mb-8 text-center text-[13px] font-bold tracking-[0.03em] text-[#8B968F]">
          Sectores que Confían en las Compras Automatizadas
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-7">
          {[
            { nombre: "Energía", icon: <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" /> },
            { nombre: "Construcción", icon: <><path d="M2 20h20" /><path d="M4 20V8l8-5 8 5v12" /><rect x="9" y="12" width="6" height="8" /></> },
            { nombre: "Manufactura", icon: <><path d="M2 20h20V9l-6 4V9l-6 4V4L2 9v11z" /></> },
            { nombre: "Agroindustria & Acuacultura", icon: <><path d="M11 20A7 7 0 0 1 4 13c3.5 0 7 2 7 7z" /><path d="M11 20a7 7 0 0 1 7-7c0 4-3.5 7-7 7z" /><path d="M11 20v-8" /></> },
            { nombre: "Retail", icon: <><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></> },
            { nombre: "Bienes de Consumo", icon: <><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /></> },
            { nombre: "Hotelería", icon: <><path d="M3 21V7l9-4 9 4v14" /><path d="M9 21v-6h6v6" /><path d="M9 11h.01M15 11h.01" /></> },
          ].map((x) => (
            <div key={x.nombre} className="flex flex-col items-center gap-3 text-center">
              <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-[#EFFBF3]">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#173F35" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  {x.icon}
                </svg>
              </span>
              <span className="text-[13px] font-bold leading-[1.3] text-[#5C665F]">{x.nombre}</span>
            </div>
          ))}
        </div>
      </section>
{/* ── LOGOS MARQUEE ─────────────────────────────────────────────────── */}
      <section className="border-b border-[#EFEEE8] py-12">
        <div className="mb-8 text-center text-[13px] font-bold tracking-[0.03em] text-[#8B968F]">
          Empresas que han confiado en nosotros
        </div>
        <div className="marquee-pause relative overflow-hidden">
          {/* Difuminado en los bordes */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#FAFAF8] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#FAFAF8] to-transparent" />
          <div className="flex w-max animate-marquee items-center gap-16">
            {/* La lista se duplica para que el loop sea continuo */}
            {[...LOGOS_EMPRESAS, ...LOGOS_EMPRESAS].map((logo, i) => (
              <div
                key={`${logo.nombre}-${i}`}
                className="flex h-16 flex-shrink-0 items-center justify-center px-4"
              >
                <img
                  src={logo.src}
                  alt={logo.nombre}
                  className="max-h-12 w-auto object-contain opacity-60 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VALUE PROPS ───────────────────────────────────────────────────── */}
      <section className={`mx-auto max-w-[1280px] py-16 md:py-[100px] ${SECTION_X}`}>
        <div className="mx-auto mb-16 max-w-[640px] text-center">
          <div className={`${EYEBROW} mb-3.5`}>¿Porque integrar a PO en tu Cadena de Suministro?</div>
          <h2 className="text-[30px] font-extrabold tracking-[-0.02em] text-[#173F35] text-pretty md:text-[40px]">Sin Costo real para Tu operación, Eficiencia y Control.</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {VALUE_PROPS.map((v) => (
            <div
              key={v.title}
              className="rounded-[18px] border border-[#EFEEE8] bg-white p-[30px] transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(23,63,53,0.1)]"
            >
              <div className="mb-[22px] flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#EFFBF3]">{v.icon}</div>
              <div className="mb-2 text-[17px] font-bold text-[#173F35]">{v.title}</div>
              <div className="text-[14.5px] leading-[1.55] text-[#5C665F]">{v.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TRANSFORMACIÓN ────────────────────────────────────────────────── */}
      <section className={`mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-12 pb-16 pt-5 md:grid-cols-2 md:gap-16 md:pb-[100px] ${SECTION_X}`}>
        {/* TODO: reemplazar con imagen real (ilustración de transformación) */}
        <div className="h-[300px] md:h-[380px]">
          <img
                src="/img/transformacion.jpg"
                alt="Compras y proveedor cerrando una licitación"
                className="h-full w-full rounded-[20px] object-cover"
              />
        </div>
        <div>
          <div className={`${EYEBROW} mb-3.5`}> Menos operacion manual, Automatización y Reducción de Costos</div>
          <h2 className="mb-5 text-[28px] font-extrabold tracking-[-0.02em] text-[#173F35] text-pretty md:text-[36px]">Tu equipo de compras deja de perseguir correos y hojas de cálculo</h2>
          <p className="mb-7 text-[16px] leading-[1.65] text-[#5C665F]">
            Creación de licitaciones automaticas, Negociación de Precios Automatica y Analisis de Ofertas Automatico.
          </p>

        </div>
      </section>

      {/* ── FLUJO ─────────────────────────────────────────────────────────── */}
      <section id="flujo" className={`bg-[#F1F0E9] py-16 md:py-[100px] ${SECTION_X}`}>
        <div className="mx-auto max-w-[1280px]">
          <div className="mx-auto mb-16 max-w-[640px] text-center md:mb-[72px]">
            <div className={`${EYEBROW} mb-3.5`}>EL FLUJO COMPLETO</div>
            <h2 className="text-[30px] font-extrabold tracking-[-0.02em] text-[#173F35] md:text-[40px]">Del alta de proveedor a la orden de compra</h2>
          </div>
          <div className="relative grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-5">
            {/* línea conectora — solo desktop */}
            <div className="absolute left-[10%] right-[10%] top-[27px] z-0 hidden h-0.5 bg-[#D8D5CB] lg:block" />
            {FLUJO_STEPS.map((step) => (
              <div key={step.title} className="relative z-[1] flex flex-col items-center text-center">
                <div className="mb-[18px] flex h-[54px] w-[54px] flex-shrink-0 items-center justify-center rounded-full bg-[#173F35]">{step.icon}</div>
                <div className="mb-1.5 text-[15.5px] font-bold text-[#173F35]">{step.title}</div>
                <div className="text-[13.5px] leading-[1.5] text-[#6B756E]">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MÓDULOS ───────────────────────────────────────────────────────── */}
      <section id="modulos" className={`mx-auto max-w-[1280px] py-16 md:py-[100px] ${SECTION_X}`}>
        <div className="mx-auto mb-16 max-w-[680px] text-center">
          <div className={`${EYEBROW} mb-3.5`}>MÓDULOS DE LA PLATAFORMA</div>
          <h2 className="mb-4 text-[30px] font-extrabold tracking-[-0.02em] text-[#173F35] md:text-[40px]">Todo el ciclo de compras, sin salir de una sola pantalla</h2>
          <p className="text-[16px] leading-[1.6] text-[#5C665F]">Cada área de tu operación —proveedores, catálogo, licitaciones y compras— vive en un módulo dedicado, conectado en tiempo real.</p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {MODULOS.map((m) => (
            <div
              key={m.title}
              className={`flex items-start gap-4 rounded-[16px] border p-[26px] transition-colors ${
                m.destacado
                  ? "border-[#8FE3A6] bg-[#EFFBF3]"
                  : "border-[#EFEEE8] bg-white hover:border-[#8FE3A6]"
              }`}
            >
              <div className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-[11px] bg-[#173F35]">{m.icon}</div>
              <div>
                <div className="mb-1.5 text-[16px] font-bold text-[#173F35]">{m.title}</div>
                <div className="mb-2 text-[14px] leading-[1.55] text-[#5C665F]">{m.desc}</div>
                <div className="text-[12.5px] font-semibold leading-[1.5] text-[#1B4D3E]">{m.highlight}</div>
                {m.nota && (
                  <div className="mt-3 border-t border-[#8FE3A6]/40 pt-2.5 text-[12.5px] font-bold italic leading-[1.45] text-[#173F35]">
                    {m.nota}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── INTEGRACIONES ERP ─────────────────────────────────────────────── */}
      <section id="integracion" className={`relative overflow-hidden bg-[#173F35] py-16 md:py-[100px] ${SECTION_X}`}>
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ backgroundImage: "radial-gradient(rgba(250,250,248,0.05) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
        />
        <div className="relative mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-16">
          <div>
            <div className="mb-3.5 text-[13px] font-bold tracking-[0.04em] text-[#8FE3A6]">INTEGRACIÓN CON TU ERP (Para las empresas que usen ERP)</div>
            <h2 className="mb-5 text-[30px] font-extrabold tracking-[-0.02em] text-[#FAFAF8] text-pretty md:text-[38px]">PO se integra con Tu ERP para automatizar tu operación, consultado automaticamente Solicitudes de Pedido, Catalogo de Compras, Catalogo de Proveedores, etc</h2>
            <p className="mb-7 text-[16px] leading-[1.65] text-[#C7D6CE]">
              El optimizador de compras se integra vía API con SAP, Oracle, Microsoft Dynamics y sistemas a medida. Sincroniza catálogo, proveedores y órdenes de compra en ambas direcciones, sin doble captura.
            </p>
            <div className="flex flex-col gap-4">
              {ERP_BULLETS.map((b) => (
                <div key={b} className="flex items-start gap-3">
                  <div className="mt-px flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full bg-[rgba(143,227,166,0.15)]">
                    <IconCheck size={12} stroke="#8FE3A6" sw={3} />
                  </div>
                  <div className="text-[15px] font-medium text-[#EFF5F1]">{b}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 rounded-[20px] border border-[rgba(250,250,248,0.14)] p-9" style={{ background: "rgba(250,250,248,0.06)" }}>
            {ERP_LOGOS.map((erp) => (
              <div key={erp.name} className="flex flex-col items-center gap-2.5 rounded-[12px] px-3.5 py-[22px]" style={{ background: "rgba(250,250,248,0.08)" }}>
                {erp.icon}
                <div className="text-[14px] font-bold text-[#DCE7E0]">{erp.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── REPORTES ──────────────────────────────────────────────────────── */}
      <section id="reportes" className={`mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-12 py-16 md:grid-cols-2 md:gap-16 md:py-[100px] ${SECTION_X}`}>
        {/* Texto (izquierda en desktop, arriba en móvil) */}
        <div>
          <div className={`${EYEBROW} mb-3.5`}>REPORTES POR INDUSTRIA</div>
          <h2 className="mb-5 text-[30px] font-extrabold tracking-[-0.02em] text-[#173F35] text-pretty md:text-[38px]">Indicadores hechos para tu sector, no genéricos</h2>
          <p className="mb-7 text-[16px] leading-[1.65] text-[#5C665F]">
            Configura tableros con los KPIs que importan a manufactura, energía, retail o construcción: tiempos de respuesta de proveedores, ahorro por licitación, cumplimiento normativo y más.
          </p>
          <div className="flex flex-wrap gap-2.5">
            {INDUSTRIES.map((ind) => (
              <div key={ind} className="rounded-full border-[1.5px] border-[#D8D5CB] px-4 py-[9px] text-[13.5px] font-bold text-[#3A473F]">{ind}</div>
            ))}
          </div>
        </div>
        {/* Card tablero (derecha en desktop) */}
        <div className="rounded-[20px] border border-[#EFEEE8] bg-white p-8 shadow-[0_30px_60px_rgba(23,63,53,0.06)]">
          <div className="mb-[22px] flex items-center gap-2.5">
            <IconBarChart size={18} stroke="#173F35" />
            <div className="text-[15px] font-bold text-[#173F35]">Tablero de Indicadores · Sector Construcción</div>
          </div>
          <div className="mb-[26px] flex flex-col gap-4">
            {INDUSTRY_REPORTS.map((r) => (
              <div key={r.label}>
                <div className="mb-1.5 flex justify-between text-[13.5px] font-semibold text-[#3A473F]">
                  <div>{r.label}</div>
                  <div className="font-extrabold text-[#173F35]">{r.value}</div>
                </div>
                <div className="h-2 rounded-full bg-[#F1F0E9]">
                  <div className="h-full rounded-full bg-[#8FE3A6]" style={{ width: r.pct }} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-6 border-t border-[#EFEEE8] pt-[22px]">
            <div
              className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full"
              style={{ background: "conic-gradient(#173F35 0% 54%, #8FE3A6 54% 82%, #D8D5CB 82% 100%)" }}
            >
              <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-white">
                <div className="text-[15px] font-extrabold text-[#173F35]">7</div>
                <div className="text-[9px] font-bold text-[#8B968F]">PROVEEDORES</div>
              </div>
            </div>
            <div className="flex flex-col gap-2 text-[13px] font-semibold text-[#3A473F]">
              <div className="flex items-center gap-2"><span className="h-[9px] w-[9px] rounded-[2px] bg-[#173F35]" />Catálogo validado (54%)</div>
              <div className="flex items-center gap-2"><span className="h-[9px] w-[9px] rounded-[2px] bg-[#8FE3A6]" />Pendiente de validación (28%)</div>
              <div className="flex items-center gap-2"><span className="h-[9px] w-[9px] rounded-[2px] bg-[#D8D5CB]" />Sin acceso aún (18%)</div>
            </div>
          </div>
        </div>
      </section>

    

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section
        id="contacto"
        className={`relative overflow-hidden py-24 md:py-[110px] ${SECTION_X}`}
        style={{ background: "radial-gradient(900px 500px at 50% 0%, #1F5445 0%, #173F35 60%, #0F2A22 100%)" }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{ backgroundImage: "radial-gradient(rgba(250,250,248,0.05) 1px, transparent 1px)", backgroundSize: "26px 26px" }}
        />
        <div className="relative mx-auto max-w-[640px] text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-[16px] bg-[rgba(143,227,166,0.15)]">
            <IconSend size={26} stroke="#8FE3A6" />
          </div>
          <h2 className="mb-[18px] text-[30px] font-extrabold tracking-[-0.02em] text-[#FAFAF8] text-pretty md:text-[38px]">Lleva tu proceso de compras al siguiente nivel</h2>
          <p className="mb-9 text-[17px] leading-[1.6] text-[#C7D6CE]">Agenda una demo y te mostramos cómo Evolve BA se adapta a tu ERP y a los flujos de tu industria en menos de dos semanas.</p>
          <div className="flex flex-wrap justify-center gap-3.5">
            <div className="flex items-center gap-2.5 rounded-full bg-white py-1.5 pl-5 pr-1.5">
              <input
                placeholder="Tu correo de trabajo"
                className="w-[180px] border-none bg-transparent text-[15px] text-[#173F35] outline-none placeholder:text-[#8B968F] sm:w-[220px]"
              />
              {/* Visual por ahora (sin backend), igual que la referencia */}
              <a href="#" className="whitespace-nowrap rounded-full bg-[#173F35] px-[22px] py-3 text-[14.5px] font-bold text-[#8FE3A6] transition-colors hover:bg-[#0F332A]">
                Solicitar demo
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className={`flex flex-col items-center justify-between gap-4 border-t border-[#EFEEE8] py-12 sm:flex-row ${SECTION_X}`}>
        <div className="flex items-center gap-2.5">
          <Logo box={28} bar={14} thick={2} radius={8} />
          <div className="text-[14px] font-bold text-[#173F35]">Evolve BA © 2026</div>
        </div>
        <div className="flex gap-7 text-[13.5px] font-semibold text-[#6B756E]">
          <a href="#modulos" className="text-[#6B756E] hover:text-[#173F35]">Módulos</a>
          <a href="#integracion" className="text-[#6B756E] hover:text-[#173F35]">Integraciones</a>
          <a href="#contacto" className="text-[#6B756E] hover:text-[#173F35]">Contacto</a>
        </div>
      </footer>
    </div>
  );
}
