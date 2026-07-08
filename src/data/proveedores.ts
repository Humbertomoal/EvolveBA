export type TipoPersona = "Fisica" | "Moral";

export type EstadoProveedor = "Activo" | "Inactivo";

export type Proveedor = {
  id: string;
  razonSocial: string;
  vendedorNombre: string;
  vendedorCelular: string;
  vendedorCorreo: string;
  contactoAdminNombre: string;
  contactoAdminTelefono: string;
  contactoAdminCorreo: string;
  tipoPersona: TipoPersona;
  rfc: string;
  domicilio: string;
  domicilioComercial: string;
  estado: EstadoProveedor;
};

export type ProveedorInput = Omit<Proveedor, "id">;

export const proveedoresMock: Proveedor[] = [
  {
    id: "prov_001",
    razonSocial: "Distribuidora Andina S.A. de C.V.",
    vendedorNombre: "Carlos Pérez",
    vendedorCelular: "55 1234 5678",
    vendedorCorreo: "carlos.perez@distandina.com",
    contactoAdminNombre: "Laura Jiménez",
    contactoAdminTelefono: "55 8765 4321",
    contactoAdminCorreo: "laura.jimenez@distandina.com",
    tipoPersona: "Moral",
    rfc: "DAN180523AB1",
    domicilio: "Av. Insurgentes Sur 1234, Col. Del Valle, CDMX, CP 03100",
    domicilioComercial: "",
    estado: "Activo",
  },
  {
    id: "prov_002",
    razonSocial: "Juan Manuel Torres Reyes",
    vendedorNombre: "",
    vendedorCelular: "",
    vendedorCorreo: "",
    contactoAdminNombre: "Juan Manuel Torres",
    contactoAdminTelefono: "33 2233 4455",
    contactoAdminCorreo: "jm.torres@gmail.com",
    tipoPersona: "Fisica",
    rfc: "TORJ850214XY2",
    domicilio: "Av. Patria 800, Zapopan, Jalisco, CP 45040",
    domicilioComercial: "",
    estado: "Activo",
  },
  {
    id: "prov_003",
    razonSocial: "Grupo Industrial Pacífico S.A. de C.V.",
    vendedorNombre: "Mariana López",
    vendedorCelular: "81 5566 7788",
    vendedorCorreo: "mariana.lopez@gip.com.mx",
    contactoAdminNombre: "Roberto Salinas",
    contactoAdminTelefono: "81 4455 6677",
    contactoAdminCorreo: "r.salinas@gip.com.mx",
    tipoPersona: "Moral",
    rfc: "GIP990101QW3",
    domicilio: "Blvd. Díaz Ordaz 500, Monterrey, NL, CP 64000",
    domicilioComercial: "",
    estado: "Activo",
  },
  {
    id: "prov_004",
    razonSocial: "María Fernanda Ríos Castillo",
    vendedorNombre: "",
    vendedorCelular: "",
    vendedorCorreo: "",
    contactoAdminNombre: "María Fernanda Ríos",
    contactoAdminTelefono: "999 123 4567",
    contactoAdminCorreo: "mf.rios@hotmail.com",
    tipoPersona: "Fisica",
    rfc: "RICM920731LK5",
    domicilio: "Calle 60 #220, Mérida, Yucatán, CP 97000",
    domicilioComercial: "",
    estado: "Inactivo",
  },
  {
    id: "prov_005",
    razonSocial: "Suministros del Bajío S.A. de C.V.",
    vendedorNombre: "Sofía Hernández",
    vendedorCelular: "477 998 1122",
    vendedorCorreo: "sofia.hernandez@subajio.com",
    contactoAdminNombre: "Eduardo Ramírez",
    contactoAdminTelefono: "477 112 2334",
    contactoAdminCorreo: "e.ramirez@subajio.com",
    tipoPersona: "Moral",
    rfc: "SBA050912ZT8",
    domicilio: "Carretera Panamericana km 5, León, Gto, CP 37000",
    domicilioComercial: "",
    estado: "Activo",
  },
  {
    id: "prov_006",
    razonSocial: "Pedro Alberto Domínguez Vega",
    vendedorNombre: "",
    vendedorCelular: "",
    vendedorCorreo: "",
    contactoAdminNombre: "Pedro Domínguez",
    contactoAdminTelefono: "222 334 5566",
    contactoAdminCorreo: "pedro.dominguez@outlook.com",
    tipoPersona: "Fisica",
    rfc: "DOVP880405MN9",
    domicilio: "Privada de las Flores 12, Puebla, Pue, CP 72000",
    domicilioComercial: "",
    estado: "Inactivo",
  },
];
