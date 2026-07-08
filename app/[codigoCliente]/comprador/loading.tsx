import { SkeletonCard, SkeletonKPI } from "@/src/components/SkeletonLoader";

export default function Loading() {
  return (
    <div className="max-w-3xl">
      <div className="h-5 w-44 animate-pulse rounded bg-gray-200" />
      <div className="mt-2 h-4 w-64 animate-pulse rounded bg-gray-200" />

      <div className="mt-6 grid grid-cols-3 gap-4">
        <SkeletonKPI />
        <SkeletonKPI />
        <SkeletonKPI />
      </div>

      <div className="mt-6">
        <SkeletonCard className="h-64" />
      </div>
    </div>
  );
}
