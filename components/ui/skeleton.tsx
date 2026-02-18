import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

function FileListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4"
        >
          <Skeleton className="h-10 w-10 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      ))}
    </div>
  );
}

function UploadSectionSkeleton() {
  return (
    <div className="w-full rounded-xl border-2 border-dashed border-gray-200 bg-gray-50">
      <div className="flex flex-col items-center justify-center gap-4 px-6 py-12">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2 text-center">
          <Skeleton className="mx-auto h-5 w-40" />
          <Skeleton className="mx-auto h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-28 rounded-md" />
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );
}

export { Skeleton, FileListSkeleton, UploadSectionSkeleton };
