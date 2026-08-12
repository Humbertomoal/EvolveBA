import { SkeletonCard, SkeletonKPI } from "@/src/components/SkeletonLoader";

// Refleja el layout de page.tsx (saludo · accesos · métricas 7-col · gráfica
// 2/3 + atención 1/3) para que no haya salto al hidratar.
export default function Loading() {
  return (
    <div className="max-w-7xl space-y-6">
      <div>
        <div className="h-6 w-40 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-4 w-56 animate-pulse rounded bg-gray-200" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SkeletonCard className="h-[76px]" />
        <SkeletonCard className="h-[76px]" />
        <SkeletonCard className="h-[76px]" />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-7">
        <div className="col-span-2 md:col-span-3 xl:col-span-2">
          <SkeletonKPI />
        </div>
        <SkeletonKPI />
        <SkeletonKPI />
        <SkeletonKPI />
        <SkeletonKPI />
        <SkeletonKPI />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <SkeletonCard className="h-[375px]" />
          <SkeletonCard className="h-[500px]" />
        </div>
        <SkeletonCard className="h-[891px]" />
      </div>
    </div>
  );
}
