export type TipoCorreo =
  | "ALTA_PROVEEDOR"
  | "RECORDATORIO_PRODUCTOS"
  | "INVITACION_LICITACION"
  | "CAMBIO_FECHA"
  | "RESULTADO_INTERNO"
  | "NOTIFICACION_GANADORES"
  | "NOTIFICACION_NO_GANADORES"
  | "CONFIRMACION_CIERRE";

export interface PlantillaCorreo {
  asunto: string;
  cuerpo: string;
  activo: boolean;
}

export const plantillasCorreo: Record<TipoCorreo, PlantillaCorreo> = {
  ALTA_PROVEEDOR: {
    asunto: "¡Felicidades! Ya eres proveedor de {nombreEmpresa} - {nombreContacto}",
    cuerpo: `Qué tal {nombreContacto}.

Espero que estés bien.

Te escribe {nombreAsistente}, el {tituloAsistente} de {nombreEmpresa}.

¡Me da mucho gusto hacerte saber que ya eres un nuevo proveedor de {nombreEmpresa}! Ahora, el siguiente paso es que nos indiques cuáles de todos los productos que compramos nos puedes proveer. Te dejo los pasos para ingresar a nuestro portal de proveedores:

1. Ingresa a: {urlPortal}
2. Usuario: {usuarioAcceso}
3. Contraseña temporal: {passwordTemporal}
4. Selecciona todos los productos de nuestro catálogo que nos puedes proveer.

Nuestro proceso de compra es digitalizado y se realiza mediante licitaciones dentro de este mismo portal. Para que el sistema te identifique e incluya en las licitaciones necesitas indicar qué productos nos puedes proveer. Si no realizas este paso, no serás considerado en ninguna de las compras que realizamos.

Te deseo mucha suerte en todas las licitaciones en las que participes. Una vez que termines el proceso, yo mismo te estaré invitando a participar en las licitaciones que contengan los productos que ofreces.

Sin más por ahora, agradezco tu tiempo.

{nombreAsistente}
{tituloAsistente} - {nombreEmpresa}
{telefonoContacto}
{urlPortal}
{firmaCorreo}`,
    activo: true,
  },
  RECORDATORIO_PRODUCTOS: {
    asunto: "{nombreEmpresa} - Alta de catálogo de productos pendiente",
    cuerpo: `Qué tal {nombreContacto}.

¡Espero que estés bien!

Te escribe {nombreAsistente}, {tituloAsistente} de {nombreEmpresa}.

Me he dado cuenta de que aún no nos has confirmado qué productos puedes proveernos dentro de las categorías habilitadas para tu perfil. Te dejo de nuevo los pasos para ingresar al portal de proveedores y dar de alta tu catálogo:

1. Ingresa a: {urlPortal}
2. Usuario: {usuarioAcceso}
3. Contraseña: {passwordTemporal}
4. Selecciona los productos que nos puedes proveer dentro de las categorías asignadas a tu perfil.

Como aún no nos has indicado qué productos puedes proveer, has perdido la oportunidad de participar en las licitaciones realizadas desde tu alta como proveedor. Si quieres que te consideremos en las próximas, es importante que ingreses hoy mismo al portal y concluyas este proceso.

Que tengas excelente día, agradezco tu tiempo y atención.

{nombreAsistente}
{tituloAsistente} - {nombreEmpresa}
{telefonoContacto}
{urlPortal}
{firmaCorreo}`,
    activo: true,
  },
  INVITACION_LICITACION: {
    asunto: "Invitación Licitación {numeroLicitacion} - {nombreEmpresa}",
    cuerpo: `Estimado Proveedor.

Bienvenido a nuestro proceso de licitación digital. Nos da gusto que seas uno de los proveedores que estará participando y compitiendo en esta licitación.

A continuación, te compartimos las instrucciones, con el objetivo de que cuentes con toda la información que necesitas para realizar la mejor propuesta posible:

1. Ingresa a la plataforma el día {fechaInicio}, 30 minutos antes de la hora de inicio.
2. El acceso a la licitación iniciará 15 minutos antes de la hora programada.
3. La modalidad de la licitación es simultánea y de subasta: habrá varias rondas en las que tendrás la oportunidad de mejorar tu oferta, y todos los participantes ofertan al mismo tiempo.
4. Cada vez que alguno de los competidores mejore la oferta anterior, se activará una nueva ronda para darles la oportunidad de mejorar de nuevo.
5. Te recomendamos revisar los materiales y cantidades que se licitarán, así como los archivos adjuntos, para tener claro cuál puede ser tu mejor precio para cada producto.

Fecha de inicio: {fechaInicio}
Fecha de cierre: {fechaFin}

Materiales a licitar:
{tablaMateriales}

{instruccionesLicitacion}

Si deseas entender cómo funciona la plataforma, contacta al comprador asignado para agendar una sesión de tutorial.

Comprador asignado: {nombreComprador}
Teléfono: {telefonoComprador}
Correo: {correoComprador}

Cualquier duda quedamos atentos.

Atentamente,
{nombreAsistente}
{tituloAsistente} - {nombreEmpresa}
{urlPortal}
{firmaCorreo}`,
    activo: true,
  },
  CAMBIO_FECHA: {
    asunto: "Notificación Licitación {numeroLicitacion} {nombreEmpresa} - Cambio de fecha",
    cuerpo: `Estimado Proveedor.

Espero que te encuentres bien.

El objetivo de este correo es informarte que la fecha de inicio de la licitación {numeroLicitacion}, originalmente programada para el {fechaAnterior}, ha sido modificada.

La nueva fecha en la que deberás ingresar al portal de proveedores ({urlPortal}) es el {fechaInicio}.

Cualquier duda o necesidad de apoyo para que puedas participar y hacer tu mejor oferta, favor de comunicarte con el comprador asignado a esta licitación:

{nombreComprador}
{telefonoComprador}
{correoComprador}

Sin más por el momento, agradezco tu tiempo y atención.

¡Mucha suerte en la licitación!

Atentamente,
{nombreAsistente}
{tituloAsistente} - {nombreEmpresa}
{firmaCorreo}`,
    activo: true,
  },
  RESULTADO_INTERNO: {
    asunto: "Resultado Licitación {numeroLicitacion} - {nombreEmpresa}",
    cuerpo: `Hola {nombreComprador}.

La licitación {numeroLicitacion} ha finalizado. A continuación el resumen de resultados:

Presupuesto objetivo: {presupuestoObjetivo}
Total primera ronda: {totalPrimeraRonda}
Mejor costo total: {mejorCostoTotal}
Adherencia de precio: {adherenciaPrecio}
Ahorro obtenido: {ahorroTotal}

Ganadores por material:
{tablaGanadores}

Se adjunta el archivo Excel con el detalle de todas las rondas y ofertas recibidas.

Atentamente,
{nombreAsistente}
{tituloAsistente} - {nombreEmpresa}
{firmaCorreo}`,
    activo: true,
  },
  NOTIFICACION_GANADORES: {
    asunto: "Resultado Licitación {numeroLicitacion} - Materiales asignados",
    cuerpo: `Estimado {nombreProveedor}.

Nos complace informarte que has resultado ganador en la licitación {numeroLicitacion} para los siguientes materiales:

{tablaMateriales}

El siguiente paso es que ingreses al portal para revisar y confirmar la asignación:

{urlPortal}

Una vez confirmada tu aceptación, procederemos con la generación de la orden de compra correspondiente.

Agradecemos tu participación y confianza.

Atentamente,
{nombreAsistente}
{tituloAsistente} - {nombreEmpresa}
{firmaCorreo}`,
    activo: true,
  },
  NOTIFICACION_NO_GANADORES: {
    asunto: "Resultado Licitación {numeroLicitacion} - {nombreEmpresa}",
    cuerpo: `Estimado {nombreProveedor}.

Te agradecemos sinceramente tu participación en la licitación {numeroLicitacion}.

En esta ocasión los materiales fueron asignados a otros participantes, pero valoramos mucho el tiempo y esfuerzo que dedicaste a preparar tu propuesta.

Seguiremos invitándote a futuras licitaciones que incluyan los productos de tu catálogo. Te animamos a seguir participando.

Cualquier duda, quedamos a tus órdenes.

Atentamente,
{nombreAsistente}
{tituloAsistente} - {nombreEmpresa}
{firmaCorreo}`,
    activo: true,
  },
  CONFIRMACION_CIERRE: {
    asunto: "Licitación {numeroLicitacion} cerrada - Seguimiento de orden de compra",
    cuerpo: `Estimado {nombreProveedor}.

Te confirmamos que la licitación {numeroLicitacion} ha sido cerrada formalmente y tu asignación quedó registrada.

Materiales asignados:
{tablaMateriales}

En breve el comprador asignado se pondrá en contacto contigo para dar seguimiento a la orden de compra y coordinar los detalles de entrega.

Comprador asignado: {nombreComprador}
Teléfono: {telefonoComprador}
Correo: {correoComprador}

Agradecemos tu participación y confianza.

Atentamente,
{nombreAsistente}
{tituloAsistente} - {nombreEmpresa}
{firmaCorreo}`,
    activo: true,
  },
};
