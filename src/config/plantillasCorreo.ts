export type TipoCorreo =
  | "ALTA_PROVEEDOR"
  | "RECORDATORIO_PRODUCTOS"
  | "INVITACION_LICITACION"
  | "CAMBIO_FECHA"
  | "RESULTADO_INTERNO"
  | "NOTIFICACION_GANADORES"
  | "CONFIRMACION_CIERRE";

export interface PlantillaCorreo {
  asunto: string;
  cuerpo: string;
  activo: boolean;
}

// Textos placeholder — se reemplazan por los definitivos en un paso posterior.
// Las variables entre {llaves} sí son las reales de cada tipo de correo.
export const plantillasCorreo: Record<TipoCorreo, PlantillaCorreo> = {
  ALTA_PROVEEDOR: {
    asunto: "Bienvenido a {nombreComercial} — acceso a tu portal de proveedor",
    cuerpo: `Hola {nombreContacto},

{nombreProveedor} ya tiene acceso al portal de proveedores de {nombreEmpresa}.

Usuario: {usuarioAcceso}
Contraseña temporal: {passwordTemporal}

Ingresa en {urlPortal} para completar tu catálogo y comenzar a recibir invitaciones a licitaciones.

Cualquier duda, contáctanos al {telefonoContacto}.

{firmaCorreo}`,
    activo: true,
  },
  RECORDATORIO_PRODUCTOS: {
    asunto: "Recordatorio: actualiza tu catálogo de productos en {nombreComercial}",
    cuerpo: `Hola {nombreContacto},

Te recordamos mantener actualizado el catálogo de productos de {nombreProveedor} en el portal de {nombreEmpresa}.

Ingresa en {urlPortal} para revisar y actualizar tu información.

{firmaCorreo}`,
    activo: true,
  },
  INVITACION_LICITACION: {
    asunto: "Invitación a licitación {numeroLicitacion} — {nombreComercial}",
    cuerpo: `Hola {nombreContacto},

{nombreProveedor} ha sido invitado a participar en la licitación {numeroLicitacion}.

Comprador: {nombreComprador}
Contacto: {correoComprador} / {telefonoComprador}
Vigencia: del {fechaInicio} al {fechaFin}

Materiales solicitados:
{tablaMateriales}

Ingresa en {urlPortal} para enviar tu cotización.

{firmaCorreo}`,
    activo: true,
  },
  CAMBIO_FECHA: {
    asunto: "Cambio de fechas — licitación {numeroLicitacion}",
    cuerpo: `Hola {nombreContacto},

Las fechas de la licitación {numeroLicitacion} ({nombreComprador}) han cambiado:

Nueva vigencia: del {fechaInicio} al {fechaFin}

Ingresa en {urlPortal} para revisar los detalles actualizados.

{firmaCorreo}`,
    activo: true,
  },
  RESULTADO_INTERNO: {
    asunto: "Resultado de licitación {numeroLicitacion} — uso interno",
    cuerpo: `Hola {nombreComprador},

La licitación {numeroLicitacion} ha finalizado. Resumen de resultados:

{tablaGanadores}

Ahorro total: {ahorroTotal}

{excelAdjunto}

{firmaCorreo}`,
    activo: true,
  },
  NOTIFICACION_GANADORES: {
    asunto: "Resultado de tu cotización — licitación {numeroLicitacion}",
    cuerpo: `Hola {nombreContacto},

{nombreProveedor} ha resultado ganador en la licitación {numeroLicitacion} para los siguientes materiales:

{tablaMateriales}

Comprador: {nombreComprador}
Contacto: {correoComprador} / {telefonoComprador}

Ingresa en {urlPortal} para confirmar tu participación.

{firmaCorreo}`,
    activo: true,
  },
  CONFIRMACION_CIERRE: {
    asunto: "Confirmación de cierre — licitación {numeroLicitacion}",
    cuerpo: `Hola {nombreComprador},

La licitación {numeroLicitacion} se cerró correctamente. Ahorro total obtenido: {ahorroTotal}.

{excelAdjunto}

{firmaCorreo}`,
    activo: true,
  },
};
