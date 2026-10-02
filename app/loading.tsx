import { MobileTopBar } from "@/components/TopBar";
import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <MobileTopBar />
      <div className="hidden md:block">
        <Skeleton className="mb-2 h-3 w-40 rounded-full" />
        <Skeleton className="mb-6 h-9 w-72 rounded-xl" />
      </div>
      <Skeleton className="mb-6 h-4 w-64 rounded-full" />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}
