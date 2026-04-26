import { createClient } from '../../../../utils/supabase/server'

type PaintRef = {
  source: 'catalog' | 'custom'
  paintId: string
  userId: string
}

export default async function PaintTechnicalSpecs({
  paintRef,
}: {
  paintRef: PaintRef
}) {
  const supabase = await createClient()

  let specs: {
    sku?: string | null
    finish?: string | null
    paint_type?: string | null
  } | null = null

  if (paintRef.source === 'catalog') {
    const { data } = await supabase
      .from('paint_catalog')
      .select('sku, finish, paint_type')
      .eq('id', paintRef.paintId)
      .maybeSingle()

    specs = data
  } else {
    const { data } = await supabase
      .from('paints')
      .select('paint_type')
      .eq('id', paintRef.paintId)
      .eq('user_id', paintRef.userId)
      .maybeSingle()

    specs = {
      sku: null,
      finish: null,
      paint_type: data?.paint_type,
    }
  }

  if (!specs) return null

  return (
    <section className="rounded-2xl bg-slate-900/80 p-6 shadow-lg">
      <h2 className="mb-5 text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
        Technical Specs
      </h2>

      <div className="divide-y divide-white/10">
        <SpecRow label="SKU" value={specs.sku || '—'} />
        <SpecRow label="Finish" value={specs.finish || '—'} />
        <SpecRow label="Paint Type" value={specs.paint_type || '—'} />
      </div>
    </section>
  )
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-4">
      <span className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
        {label}
      </span>
      <span className="text-right text-base font-bold text-white">
        {value}
      </span>
    </div>
  )
}