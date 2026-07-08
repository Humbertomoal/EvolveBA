export type TipoItem = "Producto" | "Servicio";

export type Producto = {
  id: string;
  codigo: string;
  nombre: string;
  tipoItem: TipoItem;
  familia?: string;
  unidadMedida: string;
  descripcion?: string;
  imagenUrl?: string;
  especificacionesTecnicas?: string;
  archivosEspecificaciones?: string;
  monedaPredeterminada?: string;
  createdAt?: Date;
};

export type ProductoInput = Omit<Producto, "id" | "createdAt">;

export const productosMock: Producto[] = [
  {
    id: "prod_001",
    codigo: "MAT-001",
    nombre: "Acero inoxidable 304",
    tipoItem: "Producto",
    familia: "Materias Primas",
    unidadMedida: "Toneladas",
    descripcion: "Acero inoxidable austenítico para aplicaciones de alta resistencia a la corrosión.",
    createdAt: new Date("2024-11-03"),
  },
  {
    id: "prod_002",
    codigo: "EMP-001",
    nombre: "Caja de cartón corrugado T3",
    tipoItem: "Producto",
    familia: "Empaques",
    unidadMedida: "Piezas",
    createdAt: new Date("2024-11-10"),
  },
  {
    id: "prod_003",
    codigo: "QUI-001",
    nombre: "Solvente industrial dieléctrico",
    tipoItem: "Producto",
    familia: "Químicos",
    unidadMedida: "Litros",
    descripcion: "Solvente para limpieza de superficies metálicas y componentes electrónicos.",
    createdAt: new Date("2024-12-01"),
  },
  {
    id: "prod_004",
    codigo: "SRV-001",
    nombre: "Mantenimiento preventivo de maquinaria",
    tipoItem: "Servicio",
    familia: "Mantenimiento",
    unidadMedida: "Servicio",
    descripcion: "Servicio periódico de mantenimiento preventivo para líneas de producción.",
    createdAt: new Date("2024-12-15"),
  },
  {
    id: "prod_005",
    codigo: "EQP-001",
    nombre: "Compresor de aire industrial",
    tipoItem: "Producto",
    familia: "Equipos",
    unidadMedida: "Piezas",
    descripcion: "Compresor de tornillo 50 HP para sistemas neumáticos industriales.",
    createdAt: new Date("2025-01-08"),
  },
  {
    id: "prod_006",
    codigo: "PAP-001",
    nombre: "Resma de papel bond 75g",
    tipoItem: "Producto",
    familia: "Papelería",
    unidadMedida: "Resmas",
    createdAt: new Date("2025-01-20"),
  },
  {
    id: "prod_007",
    codigo: "SRV-002",
    nombre: "Servicio de transporte y logística",
    tipoItem: "Servicio",
    familia: "Logística",
    unidadMedida: "Viaje",
    descripcion: "Transporte terrestre de mercancía en rutas nacionales.",
    createdAt: new Date("2025-02-05"),
  },
  {
    id: "prod_008",
    codigo: "MAT-002",
    nombre: "Polipropileno homopolímero",
    tipoItem: "Producto",
    familia: "Materias Primas",
    unidadMedida: "kg",
    descripcion: "Resina plástica grado inyección para fabricación de piezas industriales.",
    createdAt: new Date("2025-02-18"),
  },
  {
    id: "prod_009",
    codigo: "EMP-002",
    nombre: "Bolsa de polietileno 30x40 cm",
    tipoItem: "Producto",
    familia: "Empaques",
    unidadMedida: "Millar",
    createdAt: new Date("2025-03-02"),
  },
  {
    id: "prod_010",
    codigo: "SRV-003",
    nombre: "Limpieza industrial de instalaciones",
    tipoItem: "Servicio",
    familia: "Mantenimiento",
    unidadMedida: "Servicio",
    createdAt: new Date("2025-03-14"),
  },
  {
    id: "prod_011",
    codigo: "QUI-002",
    nombre: "Aceite hidráulico ISO VG 46",
    tipoItem: "Producto",
    familia: "Químicos",
    unidadMedida: "Litros",
    createdAt: new Date("2025-04-07"),
  },
  {
    id: "prod_012",
    codigo: "EQP-002",
    nombre: "Montacargas eléctrico 2.5 ton",
    tipoItem: "Producto",
    familia: "Equipos",
    unidadMedida: "Piezas",
    descripcion: "Montacargas eléctrico de contrapeso con capacidad de 2,500 kg.",
    createdAt: new Date("2025-04-22"),
  },
];
