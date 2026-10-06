import { notFound } from 'next/navigation'
import ThemeCardPreview from './theme-card-preview'

export default function AltThemePreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <ThemeCardPreview />
}
