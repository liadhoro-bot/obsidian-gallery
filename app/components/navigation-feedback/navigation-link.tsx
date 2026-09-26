'use client'

import Link, { useLinkStatus } from 'next/link'
import { useLayoutEffect, useRef, type ComponentProps } from 'react'
import { useNavigationFeedback } from './navigation-provider'

type LinkProps = ComponentProps<typeof Link>
function destinationHref(href: LinkProps['href']) {
  if (typeof href === 'string') return href
  if (typeof href.query === 'string') return `${href.pathname ?? ''}?${href.query}`
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(href.query ?? {})) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item != null) params.append(key, String(item))
    }
  }
  return `${href.pathname ?? ''}${params.size ? `?${params}` : ''}`
}
function PendingFeedback({ href }: { href: LinkProps['href'] }) {
  const { pending } = useLinkStatus()
  const feedback = useNavigationFeedback()
  const show = feedback?.showLink
  const clear = feedback?.clearLink
  const id = useRef(Symbol('navigation'))
  const destination = destinationHref(href)
  useLayoutEffect(() => {
    if (!pending || !show || !clear) return
    const key = id.current
    show({ id: key, href: destination })
    return () => clear(key)
  }, [pending, destination, show, clear])
  return null
}

// Keep Next Link's native modifier-key, download, target, cancellation, scroll,
// prefetch and history behavior. Feedback follows its actual pending lifecycle.
export default function NavigationLink({ children, ...props }: LinkProps) {
  return <Link {...props}>{children}<PendingFeedback href={props.href} /></Link>
}
