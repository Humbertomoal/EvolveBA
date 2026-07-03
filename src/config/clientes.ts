export type Cliente = {
  id: string;
  codigo: string;
  nombreEmpresa: string;
  logoUrl: string;
  colorPrimario: string;
  colorSecundario: string;
  faviconUrl: string;
};

export const CODIGO_CLIENTE_DEFAULT = "evolve-ba";

export const clientes: Cliente[] = [
  {
    id: "cli_001",
    codigo: "evolve-ba",
    nombreEmpresa: "Evolve BA",
    logoUrl: "/clientes/evolve-ba/logo.svg",
    colorPrimario: "#004439",
    colorSecundario: "#003433",
    faviconUrl: "/clientes/evolve-ba/logo.svg",
  },
  {
    id: "cli_002",
    codigo: "grupo-andino",
    nombreEmpresa: "Grupo Andino",
    logoUrl: "/clientes/grupo-andino/logo.svg",
    colorPrimario: "#1d4ed8",
    colorSecundario: "#1e3a8a",
    faviconUrl: "/clientes/grupo-andino/logo.svg",
  },
];
