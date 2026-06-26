'use client'

import { useEffect, useState } from 'react'
import DashboardMetadataCards, {
  type DashboardMetadataItem,
} from './dashboard-metadata-cards'

type DashboardMetadataLoaderProps = {
  initialItems: DashboardMetadataItem[]
}

type DashboardMetadataResponse = {
  items?: Array<{
    id: string
    value: string
    accent?: string
  }>
}

export default function DashboardMetadataLoader({
  initialItems,
}: DashboardMetadataLoaderProps) {
  const [items, setItems] = useState(initialItems)

  useEffect(() => {
    let isActive = true

    async function loadDeferredItems() {
      try {
        const response = await fetch('/api/dashboard/metadata', {
          method: 'GET',
          cache: 'no-store',
        })

        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as DashboardMetadataResponse
        const itemMap = new Map(
          (payload.items ?? []).map((item) => [item.id, item] as const)
        )

        if (!isActive || itemMap.size === 0) {
          return
        }

        setItems((currentItems) =>
          currentItems.map((item) => {
            const nextItem = itemMap.get(item.id)
            if (!nextItem) {
              return item
            }

            return {
              ...item,
              value: nextItem.value,
              accent: nextItem.accent ?? item.accent,
            }
          })
        )
      } catch {
        // Keep the initial placeholders when the background refresh fails.
      }
    }

    loadDeferredItems()

    return () => {
      isActive = false
    }
  }, [])

  return <DashboardMetadataCards items={items} />
}
