'use client'

import { useMemo, useOptimistic } from 'react'
import PaintSwatch from './paint-swatch'
import { Recipe, StepPaintLink } from './types'

type InventoryPaint = {
  uniqueKey: string
  id: string
  name: string | null
  brand: string | null
  line: string | null
  hex_approx: string | null
  swatch_image_url: string | null
  is_owned?: boolean
  is_wishlist?: boolean
}
export default function RecipeInventoryCard({
  recipe,
  stepPaintLinks,
  isEditingInventory,
  setIsEditingInventory,
  updateRecipeInventoryAction,
updateRecipePaintOwnershipAction,
}: {
  recipe: Recipe
  stepPaintLinks: StepPaintLink[]
  isEditingInventory: boolean
  setIsEditingInventory: (value: boolean) => void
  updateRecipeInventoryAction: (formData: FormData) => Promise<void>
updateRecipePaintOwnershipAction: (formData: FormData) => Promise<void>
}) {
  const autoInventory = useMemo<InventoryPaint[]>(() => {
    const map = new Map<string, InventoryPaint>()

    for (const link of stepPaintLinks) {
      if (!link.paint) continue

      const key = `${link.paint_source || 'catalog'}:${link.paint.id}`

      if (!map.has(key)) {
        map.set(key, {
          uniqueKey: key,
          id: link.paint.id,
          name: link.paint.name,
          brand: link.paint.brand,
          line: link.paint.line,
          hex_approx: link.paint.hex_approx,
          swatch_image_url: link.paint.swatch_image_url,
          is_owned: link.paint.is_owned,
          is_wishlist: link.paint.is_wishlist,
        })
      }
    }

    return Array.from(map.values())
  }, [stepPaintLinks])
const [optimisticInventory, toggleOptimisticPaint] = useOptimistic(
  autoInventory,
  (
    currentInventory,
    payload: {
      paintId: string
      action: 'owned' | 'wishlist'
    }
  ) =>
    currentInventory.map((paint) => {
      if (paint.id !== payload.paintId) return paint

      if (payload.action === 'owned') {
        return {
          ...paint,
          is_owned: !paint.is_owned,
        }
      }

      return {
        ...paint,
        is_wishlist: !paint.is_wishlist,
      }
    })
)
  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold uppercase tracking-[0.18em] text-white">
  THE PALETTE
</h2>

        <button
          type="button"
          onClick={() => setIsEditingInventory(!isEditingInventory)}
          className="rounded-full border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
        >
          ✎
        </button>
      </div>

      {optimisticInventory.length > 0 ? (
        <div className="mt-4 space-y-3">
          {optimisticInventory.map((paint) => (
            <div
              key={paint.uniqueKey}
              className="rounded-2xl border border-neutral-800 bg-black/40 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="shrink-0">
                  <PaintSwatch paint={paint} size="md" />
                </div>

                <div className="min-w-0 flex-1">
  <p className="truncate text-sm font-medium text-white">
    {paint.name || 'Unknown paint'}
  </p>
  <p className="truncate text-xs text-neutral-500">
    {[paint.brand, paint.line].filter(Boolean).join(' • ') ||
      'Paint used in recipe'}
  </p>
</div>

{paint.uniqueKey.startsWith('catalog:') ? (
  <div className="flex shrink-0 gap-1.5">
    <form
  action={async (formData) => {
    toggleOptimisticPaint({
      paintId: paint.id,
      action: 'owned',
    })

    await updateRecipePaintOwnershipAction(formData)
  }}
>
      <input type="hidden" name="recipeId" value={recipe.id} />
      <input type="hidden" name="paintCatalogId" value={paint.id} />
      <input type="hidden" name="action" value="owned" />
      <input
        type="hidden"
        name="currentValue"
        value={String(Boolean(paint.is_owned))}
      />

      <button
        type="submit"
        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
          paint.is_owned
            ? 'bg-cyan-400 text-black'
            : 'bg-neutral-700 text-neutral-300'
        }`}
      >
        Owned
      </button>
    </form>

    <form
  action={async (formData) => {
    toggleOptimisticPaint({
      paintId: paint.id,
      action: 'wishlist',
    })

    await updateRecipePaintOwnershipAction(formData)
  }}
>
      <input type="hidden" name="recipeId" value={recipe.id} />
      <input type="hidden" name="paintCatalogId" value={paint.id} />
      <input type="hidden" name="action" value="wishlist" />
      <input
        type="hidden"
        name="currentValue"
        value={String(Boolean(paint.is_wishlist))}
      />

      <button
        type="submit"
        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
          paint.is_wishlist
            ? 'bg-orange-400 text-black'
            : 'bg-neutral-700 text-neutral-300'
        }`}
      >
        Wishlist
      </button>
    </form>
  </div>
) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-neutral-400">
          No paints detected from steps yet.
        </p>
      )}

      {isEditingInventory ? (
        <form action={updateRecipeInventoryAction} className="mt-5 space-y-4">
          <input type="hidden" name="recipeId" value={recipe.id} />

          <div>
            <p className="mb-2 text-sm font-medium text-white">Inventory Notes</p>
            <textarea
              name="inventoryRequired"
              defaultValue={recipe.inventory_required || ''}
              rows={5}
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
              onClick={() => setIsEditingInventory(false)}
              className="rounded-xl border border-neutral-700 bg-black px-4 py-2 text-white"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : recipe.inventory_required ? (
        <div className="mt-5 border-t border-neutral-800 pt-4">
          <p className="mb-2 text-sm font-medium text-white">Inventory Notes</p>
          <ul className="space-y-2 text-sm text-neutral-300">
            {recipe.inventory_required
              .split('\n')
              .filter(Boolean)
              .map((item, index) => (
                <li key={index}>• {item}</li>
              ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}