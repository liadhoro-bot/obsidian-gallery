'use client'

import { useState } from 'react'
import { recordPartnerLinkClick } from './tracked-link'

export default function PromoCodeCard({
  code,
  storeId,
  storeName,
  title,
}: {
  code: string
  storeId: string
  storeName: string
  title: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    recordPartnerLinkClick({
      targetType: 'store',
      targetId: storeId,
      linkKind: 'promo_code',
      source: 'store_page_promo',
    })
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked; the code stays visible to type in.
    }
  }

  return (
    <section data-v3-community-indicator="promo-code-card" aria-label="Members discount">
      <p data-v3-community-indicator="promo-code-eyebrow">
        Exclusive for Obsidian Gallery users
      </p>
      <h2 data-v3-community-indicator="promo-code-title">{title}</h2>
      <div data-v3-community-indicator="promo-code-plate">
        <span data-v3-community-indicator="promo-code-value">{code}</span>
        <button type="button" onClick={handleCopy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p data-v3-community-indicator="promo-code-hint" aria-live="polite">
        {copied
          ? 'Code copied. Use it at checkout.'
          : `Use this code at checkout at ${storeName}.`}
      </p>
    </section>
  )
}
