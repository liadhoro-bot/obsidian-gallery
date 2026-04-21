'use client'

import { useEffect, useMemo, useState } from 'react'
type RecipeImage = {
  id: string
  image_url: string
  is_featured: boolean | null
  alt_text: string | null
}

type Paint = {
  id: string
  source: 'catalog' | 'custom'
  brand: string | null
  line: string | null
  name: string | null
  sku: string | null
  hex_approx: string | null
  swatch_image_url: string | null
  paint_type: string | null
  is_owned: boolean
}

type StepPaintLink = {
  id: string
  recipe_step_id: string
  paint_order: number
  ratio_text: string | null
  paint: {
    id: string
    brand: string | null
    line: string | null
    name: string | null
    hex_approx: string | null
    swatch_image_url: string | null
  } | null
}

type RecipeStep = {
  id: string
  step_number: number
  title: string
  instructions: string
}

type Recipe = {
  id: string
  name: string
  description: string | null
  inventory_required: string | null
  expert_tips: string | null
}

type Props = {
  recipe: Recipe
  steps: RecipeStep[]
  stepPaintLinks: StepPaintLink[]
  recipeImages: RecipeImage[]
  featuredImage: RecipeImage | null
  paints: Paint[]
  updateRecipeHeaderAction: (formData: FormData) => Promise<void>
  updateRecipeInventoryAction: (formData: FormData) => Promise<void>
  updateRecipeTipsAction: (formData: FormData) => Promise<void>
  createCustomPaintAction: (formData: FormData) => Promise<void>
  addRecipeStepAction: (formData: FormData) => Promise<void>
  updateRecipeStepAction: (formData: FormData) => Promise<void>
  deleteRecipeStepAction: (formData: FormData) => Promise<void>
  moveRecipeStepAction: (formData: FormData) => Promise<void>
  uploadRecipeImageAction: (formData: FormData) => Promise<void>
  setFeaturedRecipeImageAction: (formData: FormData) => Promise<void>
  deleteRecipeImageAction: (formData: FormData) => Promise<void>
}
type PaintPickerOption = {
  id: string
  source: 'catalog' | 'custom'
  brand: string | null
  line: string | null
  name: string | null
  sku: string | null
  hex_approx: string | null
  swatch_image_url: string | null
  paint_type: string | null
  is_owned: boolean
}

function PaintSwatch({
  paint,
  size = 'md',
}: {
  paint: Pick<PaintPickerOption, 'hex_approx' | 'swatch_image_url' | 'name'>
  size?: 'sm' | 'md'
}) {
  const sizeClass = size === 'sm' ? 'h-5 w-5 rounded-md' : 'h-6 w-6 rounded-md'

  return (
    <div
      className={`${sizeClass} overflow-hidden border border-neutral-700 bg-neutral-800`}
      title={paint.name || 'Paint'}
    >
      {paint.swatch_image_url ? (
        <img
          src={paint.swatch_image_url}
          alt={paint.name || 'Paint'}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className="h-full w-full"
          style={{ backgroundColor: paint.hex_approx || '#888888' }}
        />
      )}
    </div>
  )
}

function formatPaintLabel(paint: PaintPickerOption) {
  return [paint.brand, paint.line, paint.name].filter(Boolean).join(' • ')
}

function PaintPicker({
  name,
  paints,
  defaultValue,
}: {
  name: string
  paints: PaintPickerOption[]
  defaultValue?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedValue, setSelectedValue] = useState(defaultValue || '')

  useEffect(() => {
    setSelectedValue(defaultValue || '')
  }, [defaultValue])

  const selectedPaint = useMemo(
    () =>
      paints.find((paint) => `${paint.source}:${paint.id}` === selectedValue) ||
      null,
    [paints, selectedValue]
  )

  return (
    <div className="relative">
      <input
        type="hidden"
        name={name}
        value={selectedValue}
        readOnly
      />

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl border border-neutral-700 bg-black px-3 py-2 text-left text-white"
      >
        <div className="flex min-w-0 items-center gap-3">
          {selectedPaint ? (
            <>
              <PaintSwatch paint={selectedPaint} size="sm" />
              <span className="truncate">{formatPaintLabel(selectedPaint)}</span>
            </>
          ) : (
            <span className="text-neutral-400">No paint selected</span>
          )}
        </div>

        <span className="ml-3 text-neutral-400">▾</span>
      </button>

      {isOpen ? (
        <div className="absolute z-20 mt-2 max-h-96 w-full overflow-auto rounded-xl border border-neutral-700 bg-neutral-950 shadow-2xl">
          <button
            type="button"
            onClick={() => {
              setSelectedValue('')
              setIsOpen(false)
            }}
            className="flex w-full items-center gap-3 border-b border-neutral-800 px-3 py-2 text-left text-neutral-300 hover:bg-neutral-900"
          >
            <div className="h-5 w-5 rounded-md border border-neutral-700 bg-neutral-800" />
            <span>No paint selected</span>
          </button>

          {paints.map((paint) => {
            const value = `${paint.source}:${paint.id}`

            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setSelectedValue(value)
                  setIsOpen(false)
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-neutral-900"
              >
                <PaintSwatch paint={paint} size="sm" />

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-white">
                    {formatPaintLabel(paint)}
                  </div>
                  <div className="truncate text-xs text-neutral-500">
                    {paint.source === 'custom'
                      ? 'Custom paint'
                      : paint.sku || 'Catalog paint'}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
export default function RecipeDetailClient({
  recipe,
  steps,
  stepPaintLinks,
  recipeImages,
  featuredImage,
  paints,
  updateRecipeHeaderAction,
  updateRecipeInventoryAction,
  updateRecipeTipsAction,
  createCustomPaintAction,
  addRecipeStepAction,
  updateRecipeStepAction,
  deleteRecipeStepAction,
  moveRecipeStepAction,
  uploadRecipeImageAction,
  setFeaturedRecipeImageAction,
  deleteRecipeImageAction,
}: Props) {
  const [isEditingHeader, setIsEditingHeader] = useState(false)
  const [isEditingInventory, setIsEditingInventory] = useState(false)
  const [isEditingTips, setIsEditingTips] = useState(false)
  const [isAddingStep, setIsAddingStep] = useState(false)
  const [isAddingImage, setIsAddingImage] = useState(false)
  const [isAddingCustomPaint, setIsAddingCustomPaint] = useState(false)
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [deleteConfirmStepId, setDeleteConfirmStepId] = useState<string | null>(null)
  const [deleteConfirmImageId, setDeleteConfirmImageId] = useState<string | null>(null)

  const [paintSearch, setPaintSearch] = useState('')
  const [paintBrand, setPaintBrand] = useState('all')
  const [paintLine, setPaintLine] = useState('all')
  const [paintOwnership, setPaintOwnership] = useState('all')

  const availableBrands = Array.from(
    new Set(
      (paints || [])
        .map((paint) => paint.brand)
        .filter((brand): brand is string => Boolean(brand))
    )
  ).sort((a, b) => a.localeCompare(b))

  const availableLines = Array.from(
    new Set(
      (paints || [])
        .filter((paint) => paintBrand === 'all' || paint.brand === paintBrand)
        .map((paint) => paint.line)
        .filter((line): line is string => Boolean(line))
    )
  ).sort((a, b) => a.localeCompare(b))

  const filteredPaints = (paints || []).filter((paint) => {
    const search = paintSearch.trim().toLowerCase()

    const matchesSearch =
      !search ||
      (paint.name || '').toLowerCase().includes(search) ||
      (paint.sku || '').toLowerCase().includes(search)

    const matchesBrand = paintBrand === 'all' || paint.brand === paintBrand
    const matchesLine = paintLine === 'all' || paint.line === paintLine

    const matchesOwnership =
      paintOwnership === 'all' ||
      (paintOwnership === 'owned' && paint.is_owned) ||
      (paintOwnership === 'not_owned' && !paint.is_owned)

    return matchesSearch && matchesBrand && matchesLine && matchesOwnership
  })

  function getPaintSelectValue(
    paint: StepPaintLink['paint'] | null
  ) {
    if (!paint) return ''

    const matchedPaint = paints.find((p) => p.id === paint.id)
    if (!matchedPaint) return ''

    return `${matchedPaint.source}:${matchedPaint.id}`
  }

  return (
    <div className="mx-auto max-w-xl">
      <section className="relative mt-4 overflow-hidden border-y border-neutral-800 bg-neutral-950">
        {featuredImage ? (
          <>
            <div
              className="h-56 w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${featuredImage.image_url})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/20" />
          </>
        ) : (
          <div className="h-56 w-full bg-neutral-900" />
        )}

        <div className="absolute inset-x-0 bottom-0 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-orange-400">
                Recipe Detail
              </p>

              <h1 className="mt-2 text-4xl font-bold text-white">
                {recipe.name}
              </h1>

              <p className="mt-3 max-w-lg text-sm text-neutral-300">
                {recipe.description || 'No description yet.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsEditingHeader((prev) => !prev)}
              className="rounded-full border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
            >
              ✎
            </button>
          </div>

          {isEditingHeader ? (
            <form
              action={updateRecipeHeaderAction}
              className="mt-4 rounded-2xl border border-neutral-700 bg-black/70 p-4"
            >
              <input type="hidden" name="recipeId" value={recipe.id} />

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm text-neutral-300">
                    Recipe Name
                  </label>
                  <input
                    name="name"
                    type="text"
                    defaultValue={recipe.name}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-neutral-300">
                    Description
                  </label>
                  <textarea
                    name="description"
                    defaultValue={recipe.description || ''}
                    rows={3}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-black"
                  >
                    Save
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsEditingHeader(false)}
                    className="rounded-xl border border-neutral-700 px-4 py-2 text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          ) : null}
        </div>
      </section>

      <div className="space-y-6 px-4 py-6">
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-white">
              Inventory Required
            </h2>

            <button
              type="button"
              onClick={() => setIsEditingInventory((prev) => !prev)}
              className="rounded-full border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
            >
              ✎
            </button>
          </div>

          {isEditingInventory ? (
            <form action={updateRecipeInventoryAction} className="mt-4 space-y-4">
              <input type="hidden" name="recipeId" value={recipe.id} />

              <textarea
                name="inventoryRequired"
                defaultValue={recipe.inventory_required || ''}
                rows={5}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
              />

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-black"
                >
                  Save
                </button>

                <button
                  type="button"
                  onClick={() => setIsEditingInventory(false)}
                  className="rounded-xl border border-neutral-700 bg-black px-4 py-2 text-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : recipe.inventory_required ? (
            <ul className="mt-4 space-y-2 text-sm text-neutral-300">
              {recipe.inventory_required
                .split('\n')
                .filter(Boolean)
                .map((item, index) => (
                  <li key={index}>• {item}</li>
                ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-neutral-400">
              No inventory listed yet.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-white">Expert Tips</h2>

            <button
              type="button"
              onClick={() => setIsEditingTips((prev) => !prev)}
              className="rounded-full border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
            >
              ✎
            </button>
          </div>

          {isEditingTips ? (
            <form action={updateRecipeTipsAction} className="mt-4 space-y-4">
              <input type="hidden" name="recipeId" value={recipe.id} />

              <textarea
                name="expertTips"
                defaultValue={recipe.expert_tips || ''}
                rows={5}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
              />

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-black"
                >
                  Save
                </button>

                <button
                  type="button"
                  onClick={() => setIsEditingTips(false)}
                  className="rounded-xl border border-neutral-700 bg-black px-4 py-2 text-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : recipe.expert_tips ? (
            <div className="mt-4 space-y-4">
              {recipe.expert_tips
                .split('\n')
                .filter(Boolean)
                .map((tip, index) => (
                  <p
                    key={index}
                    className="text-sm italic leading-6 text-neutral-300"
                  >
                    “{tip}”
                  </p>
                ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-400">No tips added yet.</p>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">Steps</h2>

          <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Paint Filters</h3>
                <p className="mt-1 text-xs text-neutral-400">
                  Narrow the paint list used in the step paint dropdowns.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingCustomPaint((prev) => !prev)}
                  className="rounded-lg border border-cyan-500 px-3 py-2 text-xs text-cyan-400 transition hover:bg-cyan-500/10"
                >
                  {isAddingCustomPaint ? 'Close' : '+ Add Paint'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaintSearch('')
                    setPaintBrand('all')
                    setPaintLine('all')
                    setPaintOwnership('all')
                  }}
                  className="rounded-lg border border-neutral-700 bg-black px-3 py-2 text-xs text-white transition hover:bg-neutral-800"
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm text-neutral-300">
                  Search
                </label>
                <input
                  type="text"
                  value={paintSearch}
                  onChange={(e) => setPaintSearch(e.target.value)}
                  placeholder="Search by name or SKU"
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-neutral-300">
                  Brand
                </label>
                <select
                  value={paintBrand}
                  onChange={(e) => {
                    setPaintBrand(e.target.value)
                    setPaintLine('all')
                  }}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                >
                  <option value="all">All brands</option>
                  {availableBrands.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-neutral-300">
                  Line
                </label>
                <select
                  value={paintLine}
                  onChange={(e) => setPaintLine(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                >
                  <option value="all">All lines</option>
                  {availableLines.map((line) => (
                    <option key={line} value={line}>
                      {line}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-neutral-300">
                  Ownership
                </label>
                <select
                  value={paintOwnership}
                  onChange={(e) => setPaintOwnership(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                >
                  <option value="all">All</option>
                  <option value="owned">Owned</option>
                  <option value="not_owned">Not owned</option>
                </select>
              </div>
            </div>

            <p className="mt-3 text-xs text-neutral-400">
              Showing {filteredPaints.length} paints
            </p>

            {isAddingCustomPaint && (
              <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                <form action={createCustomPaintAction} className="grid gap-3 md:grid-cols-2">
                  <input type="hidden" name="recipeId" value={recipe.id} />

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm text-neutral-300">Name</label>
                    <input
                      name="name"
                      type="text"
                      required
                      placeholder="For example: Necro Violet"
                      className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-neutral-300">Brand</label>
                    <input
                      name="manufacturer"
                      type="text"
                      placeholder="Scale75"
                      className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-neutral-300">Line</label>
                    <input
                      name="series"
                      type="text"
                      placeholder="Layer Paint"
                      className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-neutral-300">Paint Type</label>
                    <input
                      name="paintType"
                      type="text"
                      placeholder="Acrylic"
                      className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-neutral-300">Color Hex</label>
                    <input
                      name="colorHex"
                      type="text"
                      placeholder="#7a5ca8"
                      className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
                    />
                  </div>

                  <div className="md:col-span-2 flex items-center gap-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-black transition hover:bg-cyan-400"
                    >
                      Save Paint
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsAddingCustomPaint(false)}
                      className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-white transition hover:bg-neutral-700"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {steps.length > 0 ? (
            <div className="mt-4 space-y-4">
              {steps.map((step) => {
                const paintsForStep =
                  stepPaintLinks?.filter(
                    (link) => link.recipe_step_id === step.id
                  ) || []

                const paint1 = paintsForStep[0]?.paint || null
                const paint2 = paintsForStep[1]?.paint || null
                const paint3 = paintsForStep[2]?.paint || null

                const isEditingThisStep = editingStepId === step.id

                return (
                  <div
                    key={step.id}
                    className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
  <div className="min-w-0 flex-1">
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
      Step {String(step.step_number).padStart(2, '0')}
    </p>

    <div className="mt-2 flex items-center gap-2">
      <h3 className="min-w-0 truncate text-2xl font-semibold text-white">
        {step.title}
      </h3>

      {paintsForStep.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {paintsForStep.map((link) => {
            const paint = link.paint

            return (
              <div
                key={link.id}
                className="h-8 w-8 rounded-xl border border-neutral-700"
                style={{
                  backgroundColor: paint?.hex_approx || '#888888',
                  backgroundImage: paint?.swatch_image_url
                    ? `url(${paint.swatch_image_url})`
                    : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
                title={
                  [paint?.brand, paint?.line, paint?.name]
                    .filter(Boolean)
                    .join(' • ') || 'Paint'
                }
              />
            )
          })}
        </div>
      ) : null}
    </div>
  </div>

  <div className="flex items-center gap-2">
    <form action={moveRecipeStepAction}>
      <input type="hidden" name="recipeId" value={recipe.id} />
      <input type="hidden" name="stepId" value={step.id} />
      <input type="hidden" name="direction" value="up" />
      <button
        type="submit"
        disabled={step.step_number === 1}
        className="rounded-full border border-neutral-700 bg-black px-3 py-2 text-sm text-white disabled:opacity-30"
        title="Move step up"
      >
        ↑
      </button>
    </form>

    <form action={moveRecipeStepAction}>
      <input type="hidden" name="recipeId" value={recipe.id} />
      <input type="hidden" name="stepId" value={step.id} />
      <input type="hidden" name="direction" value="down" />
      <button
        type="submit"
        disabled={step.step_number === steps.length}
        className="rounded-full border border-neutral-700 bg-black px-3 py-2 text-sm text-white disabled:opacity-30"
        title="Move step down"
      >
        ↓
      </button>
    </form>

    <button
      type="button"
      onClick={() =>
        setEditingStepId((prev) =>
          prev === step.id ? null : step.id
        )
      }
      className="rounded-full border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
      title="Edit step"
    >
      ✎
    </button>

    <button
      type="button"
      onClick={() =>
        setDeleteConfirmStepId((prev) =>
          prev === step.id ? null : step.id
        )
      }
      className="rounded-full border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
      title="Delete step"
    >
      X
    </button>
  </div>
</div>

                    {deleteConfirmStepId === step.id ? (
                      <div className="mt-4 rounded-2xl border border-neutral-700 bg-black p-4">
                        <p className="text-sm text-white">
                          Delete this step?
                        </p>

                        <div className="mt-3 flex gap-2">
                          <form action={deleteRecipeStepAction}>
                            <input
                              type="hidden"
                              name="recipeId"
                              value={recipe.id}
                            />
                            <input
                              type="hidden"
                              name="stepId"
                              value={step.id}
                            />
                            <button
                              type="submit"
                              className="rounded-xl border border-neutral-700 bg-white px-4 py-2 text-sm font-medium text-black"
                            >
                              Delete
                            </button>
                          </form>

                          <button
                            type="button"
                            onClick={() => setDeleteConfirmStepId(null)}
                            className="rounded-xl border border-neutral-700 bg-black px-4 py-2 text-sm text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {isEditingThisStep ? (
                      <form
                        action={updateRecipeStepAction}
                        className="mt-4 space-y-4 rounded-2xl border border-neutral-800 bg-black p-4"
                      >
                        <input type="hidden" name="recipeId" value={recipe.id} />
                        <input type="hidden" name="stepId" value={step.id} />

                        <div>
                          <label className="mb-1 block text-sm text-neutral-300">
                            Step Title
                          </label>
                          <input
                            name="title"
                            type="text"
                            required
                            defaultValue={step.title}
                            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-sm text-neutral-300">
                            Instructions
                          </label>
                          <textarea
                            name="instructions"
                            rows={4}
                            required
                            defaultValue={step.instructions}
                            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                          />
                        </div>

                        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                          <p className="text-sm font-medium text-white">Paint 1</p>

                          <div className="mt-3 space-y-3">
                            <PaintPicker
  key={`${step.id}-paint1-${getPaintSelectValue(paint1)}`}
  name="paintId1"
  paints={filteredPaints}
  defaultValue={getPaintSelectValue(paint1)}
/>

                            <input
                              name="ratio1"
                              type="text"
                              defaultValue={paintsForStep[0]?.ratio_text || ''}
                              placeholder="Optional ratio"
                              className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-white"
                            />
                          </div>
                        </div>

                        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                          <p className="text-sm font-medium text-white">Paint 2</p>

                          <div className="mt-3 space-y-3">
                            <PaintPicker
  key={`${step.id}-paint2-${getPaintSelectValue(paint2)}`}
  name="paintId2"
  paints={filteredPaints}
  defaultValue={getPaintSelectValue(paint2)}
/>

                            <input
                              name="ratio2"
                              type="text"
                              defaultValue={paintsForStep[1]?.ratio_text || ''}
                              placeholder="Optional ratio"
                              className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-white"
                            />
                          </div>
                        </div>

                        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                          <p className="text-sm font-medium text-white">Paint 3</p>

                          <div className="mt-3 space-y-3">
                            <PaintPicker
  key={`${step.id}-paint3-${getPaintSelectValue(paint3)}`}
  name="paintId3"
  paints={filteredPaints}
  defaultValue={getPaintSelectValue(paint3)}
/>

                            <input
                              name="ratio3"
                              type="text"
                              defaultValue={paintsForStep[2]?.ratio_text || ''}
                              placeholder="Optional ratio"
                              className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-white"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-black"
                          >
                            Save Step
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingStepId(null)}
                            className="rounded-xl border border-neutral-700 px-4 py-2 text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        {paintsForStep.length > 0 ? (
                          <div className="mt-4 space-y-3">
                            {paintsForStep.map((link, index) => {
                              const paint = link.paint

                              if (!paint) return null

                              return (
                                <div
                                  key={link.id}
                                  className="rounded-xl bg-black p-4"
                                >
                                  <p className="text-xs uppercase tracking-wide text-neutral-500">
                                    Paint {index + 1}
                                    {link.ratio_text
                                      ? ` (${link.ratio_text})`
                                      : ''}
                                  </p>

                                  <div className="mt-2 flex items-start gap-3">
                                    <div
                                      className="mt-1 h-5 w-5 rounded-full border border-neutral-700"
                                      style={{
                                        backgroundColor: paint.hex_approx || '#888888',
                                        backgroundImage: paint.swatch_image_url
                                          ? `url(${paint.swatch_image_url})`
                                          : undefined,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                      }}
                                    />

                                    <div>
                                      <p className="font-medium text-white">
                                        {paint.name}
                                      </p>
                                      <p className="text-sm text-orange-400">
                                        {[paint.brand, paint.line].filter(Boolean).join(' • ') || 'Unknown brand'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : null}

                        <div className="mt-4 rounded-xl bg-black p-4">
                          <p className="text-xs uppercase tracking-wide text-neutral-500">
                            Instructions
                          </p>
                          <p className="mt-2 text-sm leading-6 text-neutral-300">
                            {step.instructions}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="mt-4 text-neutral-400">No steps yet.</p>
          )}

          <div className="mt-6">
            {!isAddingStep ? (
              <button
                type="button"
                onClick={() => setIsAddingStep(true)}
                className="rounded-xl border border-cyan-500 px-4 py-2 font-medium text-cyan-400"
              >
                + Add Step
              </button>
            ) : (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
                <h3 className="text-lg font-semibold text-white">Add Step</h3>

                <form action={addRecipeStepAction} className="mt-4 space-y-4">
                  <input type="hidden" name="recipeId" value={recipe.id} />

                  <div>
                    <label className="mb-1 block text-sm text-neutral-300">
                      Step Title
                    </label>
                    <input
                      name="title"
                      type="text"
                      required
                      placeholder="e.g. Weathered Wash"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-neutral-300">
                      Instructions
                    </label>
                    <textarea
                      name="instructions"
                      rows={4}
                      required
                      placeholder="Describe what to do in this step"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                    />
                  </div>

                  {[1, 2, 3].map((num) => (
                    <div
                      key={num}
                      className="rounded-xl border border-neutral-800 bg-black p-4"
                    >
                      <p className="text-sm font-medium text-white">
                        Paint {num}
                      </p>

                      <div className="mt-3 space-y-3">
                        <PaintPicker
  key={`add-step-paint-${num}`}
  name={`paintId${num}`}
  paints={filteredPaints}
/>

                        <input
                          name={`ratio${num}`}
                          type="text"
                          placeholder="Optional ratio"
                          className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                        />
                      </div>
                    </div>
                  ))}

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-black"
                    >
                      Add Step
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsAddingStep(false)}
                      className="rounded-xl border border-neutral-700 px-4 py-2 text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Gallery</h2>

            <button
              type="button"
              onClick={() => setIsAddingImage((prev) => !prev)}
              className="rounded-full border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
              title="Add image"
            >
              +
            </button>
          </div>

          {isAddingImage ? (
            <div className="mt-4 rounded-2xl border border-neutral-800 bg-black p-4">
              <form action={uploadRecipeImageAction} className="space-y-4">
                <input type="hidden" name="recipeId" value={recipe.id} />

                <div>
                  <label className="mb-1 block text-sm text-neutral-300">
                    Upload Image
                  </label>
                  <input
                    name="image"
                    type="file"
                    accept="image/*"
                    required
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-3 file:py-2 file:font-medium file:text-black"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-neutral-300">
                    Alt Text (optional)
                  </label>
                  <input
                    name="altText"
                    type="text"
                    placeholder="e.g. Finished armor highlight reference"
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-black"
                  >
                    Upload Image
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAddingImage(false)}
                    className="rounded-xl border border-neutral-700 bg-black px-4 py-2 text-white"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {recipeImages.length > 0 ? (
            <div className="mt-6 grid grid-cols-2 gap-4">
              {recipeImages.map((image) => (
                <div
                  key={image.id}
                  className="overflow-hidden rounded-2xl border border-neutral-800 bg-black"
                >
                  <img
                    src={image.image_url}
                    alt={image.alt_text || recipe.name}
                    className="h-40 w-full object-cover"
                  />

                  <div className="space-y-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      {image.is_featured ? (
                        <span className="inline-block rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-medium text-cyan-400">
                          Featured
                        </span>
                      ) : (
                        <form action={setFeaturedRecipeImageAction}>
                          <input type="hidden" name="recipeId" value={recipe.id} />
                          <input type="hidden" name="imageId" value={image.id} />
                          <button
                            type="submit"
                            className="rounded-full border border-neutral-700 bg-black px-2 py-1 text-xs text-white"
                            title="Set as featured"
                          >
                            ★
                          </button>
                        </form>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          setDeleteConfirmImageId((prev) =>
                            prev === image.id ? null : image.id
                          )
                        }
                        className="rounded-full border border-neutral-700 bg-black px-2 py-1 text-xs text-white"
                        title="Delete image"
                      >
                        X
                      </button>
                    </div>

                    {deleteConfirmImageId === image.id ? (
                      <div className="rounded-xl border border-neutral-700 bg-black p-3">
                        <p className="text-sm text-white">Delete this image?</p>

                        <div className="mt-3 flex gap-2">
                          <form action={deleteRecipeImageAction}>
                            <input type="hidden" name="recipeId" value={recipe.id} />
                            <input type="hidden" name="imageId" value={image.id} />
                            <button
                              type="submit"
                              className="rounded-xl border border-neutral-700 bg-white px-3 py-2 text-sm font-medium text-black"
                            >
                              Delete
                            </button>
                          </form>

                          <button
                            type="button"
                            onClick={() => setDeleteConfirmImageId(null)}
                            className="rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {image.alt_text ? (
                      <p className="text-xs text-neutral-500">{image.alt_text}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-neutral-400">
              No recipe images yet.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}