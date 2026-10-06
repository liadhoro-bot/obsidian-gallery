'use client'

import { useState } from 'react'
import { PaintAlignmentToggle } from '../shared/paint-alignment-toggle'
import { RecipeGuideAltThemeStepCard, RecipeGuideThemeStepCard } from '../shared/recipe-guide-cards'

export default function AltThemePreview() {
  const [alignments, setAlignments] = useState<Record<string, 'left' | 'right'>>({})
  const paints = [
    ['Rose Magenta', '#bc1854'],
    ['Dusk Plum', '#47132f'],
    ['Void Black', '#141616'],
    ['Steel Blue', '#557c95'],
    ['Ivory White', '#eee7d3'],
    ['Ancient Gold', '#b8832f'],
  ].map(([name, hex_approx], index) => ({
    id: `preview-${index}`, name, hex_approx,
    brand: 'Obsidian Paints', line: index === 5 ? 'Metallic' : 'Express Acrylic',
    swatch_image_url: null,
  }))
  return (
    <main style={{ minHeight: '100vh', padding: '32px 12px', background: '#181b1a' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 32 }}>
      {[
        { label: 'Theme Card Type A', Card: RecipeGuideThemeStepCard },
        { label: 'Theme Card Type B', Card: RecipeGuideAltThemeStepCard },
      ].map(({ label, Card }) => (
      <section key={label}>
      <h1 style={{ textAlign: 'center', color: '#e3d9c3', marginBottom: 20 }}>{label}</h1>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <PaintAlignmentToggle value={alignments[label] ?? 'left'} onChange={(value) => setAlignments(current => ({ ...current, [label]: value }))} />
      </div>
      <div style={{ width: 'min(480px, calc(100vw - 24px))', aspectRatio: '9 / 16', margin: 'auto' }}>
        <Card
          step={{ paint_alignment: alignments[label] ?? 'left', id: 'preview', step_number: 1, title: 'Crimson Warden', instructions: 'Rich magenta, cool steel and warm gold — a regal, high-contrast palette.', image_url: '/dashboard-golden/stormward-veteran.png', image_focal_x: 65 }}
          stepsLength={1} paints={paints}
        />
      </div>
      </section>
      ))}
      </div>
    </main>
  )
}
