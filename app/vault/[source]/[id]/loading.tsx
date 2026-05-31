import {
  PaintEditorSkeleton,
  PaintHeroSkeleton,
  PaintOwnershipSkeleton,
  PaintRecipesSkeleton,
  PaintTechnicalSpecsSkeleton,
} from './paint-skeletons'

export default function PaintDetailLoading() {
  return (
    <main className="min-h-screen bg-[#061012] pb-24 text-slate-100">
      <div className="mx-auto w-full max-w-md px-4">
        <div className="h-12 animate-pulse rounded-full bg-white/10" />
      </div>

      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-5">
        <div className="h-5 w-28 animate-pulse rounded bg-cyan-400/20" />
        <PaintHeroSkeleton />
        <PaintTechnicalSpecsSkeleton />
        <PaintOwnershipSkeleton />
        <PaintEditorSkeleton />
        <PaintRecipesSkeleton />
      </div>
    </main>
  )
}
