import { NextResponse, type NextRequest } from "next/server";
import { actualizarTiposCambioDesdeBanxico } from "@/src/lib/banxicoCore";

// Prisma + fetch a Banxico requieren runtime Node y ejecución en cada request
// (nunca cacheado): este endpoint muta datos y llama a una API externa.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron diario (configurado en vercel.json) que actualiza el/los tipo(s) de
 * cambio desde Banxico. Reutiliza el núcleo compartido banxicoCore.ts — la
 * misma lógica del botón manual de Settings, sin duplicar.
 *
 * Seguridad: solo Vercel Cron (o quien tenga CRON_SECRET) puede dispararlo.
 * Vercel Cron envía automáticamente `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");

  // Si no hay secret configurado, el endpoint queda cerrado (nunca abierto).
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  try {
    const resultado = await actualizarTiposCambioDesdeBanxico("default");

    if (!resultado.ok) {
      // Alguna moneda falló — loguea el detalle server-side y responde 500.
      console.error(
        "[cron actualizar-tipo-cambio] fallo al actualizar desde Banxico:",
        JSON.stringify(resultado.resultados)
      );
      const primerError =
        resultado.resultados.find((r) => !r.ok)?.error ??
        "No se pudo actualizar el tipo de cambio.";
      return NextResponse.json(
        { ok: false, error: primerError, resultados: resultado.resultados },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      actualizadoEn: new Date().toISOString(),
      resultados: resultado.resultados.map((r) => ({
        codigo: r.codigo,
        tipoCambio: r.tipoCambio,
        fechaDato: r.fechaDatoLabel,
      })),
    });
  } catch (error) {
    // Salvaguarda: el núcleo nunca debería lanzar, pero por si acaso.
    console.error("[cron actualizar-tipo-cambio] error inesperado:", error);
    return NextResponse.json(
      { ok: false, error: "Error inesperado al actualizar el tipo de cambio." },
      { status: 500 }
    );
  }
}
