'use client'

import { useRouter } from '@/app/components/navigation-feedback/navigation-provider'

export default function GuideBackButton({ fallbackHref = '/guides?preview=1', className }: { fallbackHref?: string; className?: string }) {
  const router = useRouter()
  return <button type="button" className={className} aria-label="Go back" onClick={() => {
    if (window.history.length > 1) router.back()
    else router.push(fallbackHref)
  }}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m14 6-6 6 6 6" /></svg></button>
}
