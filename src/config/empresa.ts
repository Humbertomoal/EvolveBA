export interface ConfigEmpresa {
  nombreEmpresa: string;
  nombreComercial: string;
  nombreAsistente: string;
  tituloAsistente: string;
  telefonoContacto: string;
  correoContacto: string;
  urlPortal: string;
  logoUrl: string;
  colorPrimario: string;
  firmaCorreo: string;
}

export const CODIGO_EMPRESA_DEFAULT = "evolve-ba";

export const configEmpresa: Record<string, ConfigEmpresa> = {
  "evolve-ba": {
    nombreEmpresa: "Evolve BA",
    nombreComercial: "Evolve BA App Comercial",
    nombreAsistente: "Etiquetin",
    tituloAsistente: "Asistente de Inteligencia Artificial",
    telefonoContacto: "9982884736",
    correoContacto: "",
    urlPortal: "https://evolve-ba.vercel.app",
    logoUrl: "",
    colorPrimario: "#004439",
    firmaCorreo: "",
  },
};

/**
 * Devuelve la config de empresa del cliente indicado, con fallback a
 * CODIGO_EMPRESA_DEFAULT si el código no existe en configEmpresa.
 */
export function getConfigEmpresa(codigoCliente?: string | null): ConfigEmpresa {
  if (codigoCliente && configEmpresa[codigoCliente]) {
    return configEmpresa[codigoCliente];
  }
  return configEmpresa[CODIGO_EMPRESA_DEFAULT];
}
