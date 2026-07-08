import { SkeletonTable } from "@/src/components/SkeletonLoader";

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-9 flex-1 animate-pulse rounded-md bg-gray-200" />
        <div className="h-9 w-40 shrink-0 animate-pulse rounded-md bg-gray-200" />
      </div>
      <SkeletonTable rows={6} columns={7} />
    </div>
  );
}
