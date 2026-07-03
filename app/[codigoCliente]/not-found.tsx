export default function ClienteNoEncontrado() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-6 text-center">
      <h1 className="text-2xl font-semibold text-zinc-900">
        Cliente no encontrado
      </h1>
      <p className="text-sm text-zinc-500">
        El código de cliente indicado en la URL no existe.
      </p>
    </div>
  );
}
