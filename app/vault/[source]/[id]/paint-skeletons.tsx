function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-900 ${className}`} />
}

export function PaintHeroSkeleton() {
  return <SkeletonBlock className="h-72" />
}

export function PaintTechnicalSpecsSkeleton() {
  return <SkeletonBlock className="h-56" />
}

export function PaintOwnershipSkeleton() {
  return <SkeletonBlock className="h-44" />
}

export function PaintRecipesSkeleton() {
  return (
    <div className="space-y-3">
      <SkeletonBlock className="h-24" />
      <SkeletonBlock className="h-24" />
    </div>
  )
}