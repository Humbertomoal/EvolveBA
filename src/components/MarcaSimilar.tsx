// ─────────────────────────────────────────────────────────────────────────────
// Marca de PRODUCTO SIMILAR.
//
// El proveedor puede surtir una partida con algo que no es exactamente lo
// solicitado (se pide el 715, ofrece el 720). Es una marca SOBRE la cotización,
// no un estado aparte: el precio compite con normalidad y puede ganar.
//
// ── Por qué va pegada al NOMBRE DEL MATERIAL y no al precio ────────────────
// Marcar el precio sugeriría que compite distinto, y no es el caso: para
// `esOfertaValida` esta oferta es como cualquier otra. Lo que cambia es QUÉ se
// está comprando, y eso se lee junto al material.
//
// El detalle se muestra siempre que exista, nunca escondido en un tooltip: el
// comprador tiene que poder compararlo de un vistazo contra lo que pidió.
//
// Módulo de presentación puro: sin estado, sin imports de servidor. Lo usan por
// igual pantallas del comprador y del proveedor.
// ─────────────────────────────────────────────────────────────────────────────

export default function MarcaSimilar({
  detalle,
  soloChip = false,
  className = "mt-1 block",
  detalleClassName = "text-xs",
}: {
  /** Qué producto ofrece. `null` en filas antiguas o si no se capturó. */
  detalle: string | null;
  /**
   * Solo la píldora, sin el detalle debajo. Para columnas estrechas (el
   * historial de ofertas) o cuando el detalle ya se muestra al lado.
   */
  soloChip?: boolean;
  /** Clases del contenedor. */
  className?: string;
  /**
   * Tamaño del detalle. Existe porque las tablas densas de la pantalla de
   * asignación usan `text-[11px]` y el resto `text-xs`; unificarlo cambiaría
   * cómo se ven pantallas que ya estaban aprobadas.
   */
  detalleClassName?: string;
}) {
  const chip = (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
      Similar
    </span>
  );

  if (soloChip) return <span className={className}>{chip}</span>;

  return (
    <span className={className}>
      {chip}
      {detalle && (
        <span
          className={`mt-0.5 block font-normal italic text-amber-700 ${detalleClassName}`}
        >
          {detalle}
        </span>
      )}
    </span>
  );
}
