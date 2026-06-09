'use client'

import { useMemo, useState } from 'react'
import StepPaintFields from './components/step-paint-fields'
import { Paint, Recipe } from './components/types'
import SubmitButton from '../../components/SubmitButton'

type Props = {
  recipe: Recipe
  paints: Paint[]
  filteredPaints: Paint[]
  paintSearch: string
  setPaintSearch: (value: string) => void
  paintBrand: string
  setPaintBrand: (value: string) => void
  paintLine: string
  setPaintLine: (value: string) => void
  paintOwnership: string
  setPaintOwnership: (value: string) => void
  createCustomPaintAction: (formData: FormData) => Promise<void>
  addRecipeStepAction: (formData: FormData) => Promise<void>
}

export default function RecipeAddStepTab({
  recipe,
  paints,
  filteredPaints,
  paintSearch,
  setPaintSearch,
  paintBrand,
  setPaintBrand,
  paintLine,
  setPaintLine,
  paintOwnership,
  setPaintOwnership,
  createCustomPaintAction,
  addRecipeStepAction,
}: Props) {
  const [isPaintFiltersOpen, setIsPaintFiltersOpen] = useState(false)
  const [isAddingCustomPaint, setIsAddingCustomPaint] = useState(false)

  const availableBrands = useMemo(
    () =>
      Array.from(
        new Set(
          (paints || [])
            .map((paint) => paint.brand)
            .filter((brand): brand is string => Boolean(brand))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [paints]
  )

  const availableLines = useMemo(
    () =>
      Array.from(
        new Set(
          (paints || [])
            .filter((paint) => paintBrand === 'all' || paint.brand === paintBrand)
            .map((paint) => paint.line)
            .filter((line): line is string => Boolean(line))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [paints, paintBrand]
  )

  const hasActivePaintFilters = Boolean(
    paintSearch.trim() ||
      paintBrand !== 'all' ||
      paintLine !== 'all' ||
      paintOwnership !== 'all'
  )

  return (
    <div className="mt-5 space-y-5">
      <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-wider text-cyan-400">
              Add Step
            </p>
            <h2 className="mt-1 text-xl font-semibold">New Recipe Step</h2>
          </div>
        </div>

        <form
          action={addRecipeStepAction}
          encType="multipart/form-data"
          className="space-y-4"
        >
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
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3 text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-neutral-300">
              Instructions
            </label>
            <textarea
              name="instructions"
              rows={4}
              placeholder="Optional instructions for this step"
              className="w-full resize-none rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3 text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-neutral-300">
              Step Image
            </label>
            <input
              type="file"
              name="step_image"
              accept="image/*"
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3 text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-400 file:px-3 file:py-2 file:text-sm file:font-bold file:text-black"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-wider text-cyan-400">
                Add Paints To Step
              </p>
              <h3 className="mt-1 text-lg font-semibold text-white">
                Step Paints
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setIsPaintFiltersOpen((current) => !current)}
              className={[
                'rounded-xl border px-3 py-2 text-xs font-bold transition active:scale-[0.98] active:opacity-70',
                hasActivePaintFilters
                  ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-300'
                  : 'border-white/10 bg-white/5 text-white/60 hover:text-white',
              ].join(' ')}
            >
              ☰ Paint Filters
            </button>
          </div>

          {isPaintFiltersOpen ? (
            <div className="mb-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                  Paint Filters
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaintSearch('')
                      setPaintBrand('all')
                      setPaintLine('all')
                      setPaintOwnership('all')
                    }}
                    className="rounded-lg border border-neutral-700 bg-black px-3 py-2 text-xs text-white transition active:scale-[0.98] active:opacity-70 hover:bg-neutral-800"
                  >
                    Reset
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPaintFiltersOpen(false)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/70 transition active:scale-[0.98] active:opacity-70 hover:bg-white/10 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="grid gap-3">
                <div>
                  <label className="mb-1 block text-sm text-neutral-300">
                    Search
                  </label>
                  <input
                    type="text"
                    value={paintSearch}
                    onChange={(event) => setPaintSearch(event.target.value)}
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
                    onChange={(event) => {
                      setPaintBrand(event.target.value)
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
                    onChange={(event) => setPaintLine(event.target.value)}
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
                    onChange={(event) => setPaintOwnership(event.target.value)}
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
            </div>
          ) : null}

          <StepPaintFields paints={filteredPaints} keyPrefix="add-step" />

          <SubmitButton
            idleText="Add Step"
            pendingText="Adding step..."
            className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-black shadow-lg shadow-cyan-500/20"
          />
        </form>
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-wider text-cyan-400">
              Custom Paint
            </p>
            <h2 className="mt-1 text-xl font-semibold">Create Paint</h2>
          </div>

          <button
            type="button"
            onClick={() => setIsAddingCustomPaint((current) => !current)}
            className="rounded-xl border border-cyan-500/50 px-3 py-2 text-xs font-bold text-cyan-300 transition active:scale-[0.98] active:opacity-70 hover:bg-cyan-500/10"
          >
            {isAddingCustomPaint ? 'Close' : 'Open'}
          </button>
        </div>

        {isAddingCustomPaint ? (
          <form action={createCustomPaintAction} className="mt-4 grid gap-3">
            <input type="hidden" name="recipeId" value={recipe.id} />

            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Name
              </label>
              <input
                name="name"
                type="text"
                required
                placeholder="For example: Necro Violet"
                className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Brand
              </label>
              <input
                name="manufacturer"
                type="text"
                placeholder="Scale75"
                className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Line
              </label>
              <input
                name="series"
                type="text"
                placeholder="Layer Paint"
                className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Paint Type
              </label>
              <input
                name="paintType"
                type="text"
                placeholder="Acrylic"
                className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Color Hex
              </label>
              <input
                name="colorHex"
                type="text"
                placeholder="#7a5ca8"
                className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
              />
            </div>

            <SubmitButton
              idleText="Create Custom Paint"
              pendingText="Creating..."
              className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-black shadow-lg shadow-cyan-500/20"
            />
          </form>
        ) : null}
      </section>
    </div>
  )
}
