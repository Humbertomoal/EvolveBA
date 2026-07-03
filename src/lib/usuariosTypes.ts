// Shared constants and types for the Usuarios/Roles module.
// No server imports — safe to use in Client Components.

export const MODULOS = [
  { key: "proveedores", label: "Administración de Proveedores" },
  { key: "catalogo", label: "Catálogo de Productos" },
  { key: "licitaciones", label: "Lanzamiento de Licitaciones" },
  { key: "licitaciones_proceso", label: "Licitaciones en Proceso" },
  { key: "seleccion_proveedores", label: "Selección de Proveedores" },
  { key: "ordenes_compra", label: "Órdenes de Compra" },
  { key: "licitaciones_finalizadas", label: "Licitaciones Finalizadas" },
  { key: "tablero", label: "Tablero de Indicadores" },
  { key: "configuracion", label: "Configuración (Catálogos)" },
  { key: "usuarios", label: "Usuarios y Roles" },
] as const;

export type ModuloKey = (typeof MODULOS)[number]["key"];

export type RolPermisoDTO = {
  modulo: string;
  ver: boolean;
  crear: boolean;
  editar: boolean;
  eliminar: boolean;
};

export type RolDTO = {
  id: string;
  nombre: string;
  descripcion: string | null;
  esAdmin: boolean;
  esSupervisor: boolean;
  clienteId: string;
  usuariosCount: number;
  permisos: RolPermisoDTO[];
};

export type UsuarioDTO = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  avatar: string | null;
  activo: boolean;
  usaMicrosoft: boolean;
  rolId: string;
  rolNombre: string;
  ultimoAcceso: string | null;
};
