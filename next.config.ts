import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /**
       * Los correos a proveedores se envían con `enviarCorreoAction`, una
       * Server Action invocada DESDE EL CLIENTE, y las fichas técnicas viajan
       * en su payload como `contenidoBase64`.
       *
       * El default de Next para el body de una Server Action es 1 MB, mientras
       * que LIMITE_BYTES_ADJUNTOS (adjuntosCorreoActions.ts) permite 3 MB
       * crudos ≈ 4 MB en base64 — está calibrado al techo de Microsoft Graph,
       * no al de Next. Con ese desfase, cualquier correo con más de ~750 KB de
       * fichas era rechazado por el framework y el navegador solo mostraba
       * "Failed to fetch", sin pista de la causa.
       *
       * 5 MB deja holgura sobre esos ~4 MB. Si algún día sube
       * LIMITE_BYTES_ADJUNTOS, este valor tiene que subir con él.
       */
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
