# Visual Inspection Workflow

## Status

Visual artifact generation works. Model-side visual inspection does not currently work in this Codex desktop environment because the available model-facing image mechanisms fail with a Windows sandbox ACL helper error.

Do not treat automated screenshot generation, image dimensions, DOM metrics, or file metadata as visual QA. Until the image-inspection mechanism is fixed, Dashboard Active Units remains a human-review candidate, not an approved golden implementation.

## Investigation Summary

Tested files:

- `docs/design/reference/materials/walnut.webp`
- `docs/design/reference/surfaces/button.webp`
- `docs/design/reference/typography/obsidian-gallery-typography-system.webp`
- `docs/design/screens/dashboard-active-units/mobile-390x844.png`
- `docs/design/screens/dashboard-active-units/desktop-1440x900.png`

Findings:

| Question | Result |
|---|---|
| Is the issue only WebP format? | No. `view_image` also failed for existing PNG screenshots and a newly generated control PNG. |
| Is the issue only repository paths? | No. `view_image` failed for a PNG in the alternate writable visualization root too. |
| Can local tooling decode PNG screenshots? | Yes. Windows `System.Drawing` decoded the dashboard PNG screenshots and generated PNG inspection copies. |
| Can local Windows `System.Drawing` decode the supplied WebP sheets? | No. It failed on the WebP reference sheets. |
| Can Chromium/Playwright render the supplied WebP sheets? | Yes. Direct browser navigation to the WebP files worked, and PNG inspection copies were generated. |
| Can `node_repl.emitImage` be used as a model-visible workaround? | No. The Node REPL kernel exits immediately with the same Windows sandbox ACL helper error. |
| Can the model actually visually inspect local image content right now? | No. The model-facing image path is blocked. |

Conclusion: the primary blocker is the model-facing local image inspection mechanism, not the image files. WebP format is a secondary compatibility issue for Windows `System.Drawing`, but Chromium can render the WebP references.

## Generated PNG Inspection Copies

The original WebP files are preserved. Representative PNG copies were generated under `docs/design/reference/inspection/` using Chromium-rendered image output at natural dimensions:

- `docs/design/reference/inspection/material-walnut.png` from `docs/design/reference/materials/walnut.webp`, 1280x853.
- `docs/design/reference/inspection/surface-button.png` from `docs/design/reference/surfaces/button.webp`, 1280x853.
- `docs/design/reference/inspection/typography-system.png` from `docs/design/reference/typography/obsidian-gallery-typography-system.webp`, 904x1280.

These copies exist to make future inspection easier for tools that can read PNG but not WebP. They are not replacements for the source sheets.

## Current Working Workflow

Use this workflow for artifact generation and human review:

1. Generate or refresh application screenshots with Playwright at the required viewports.
2. Convert any needed WebP reference sheets to PNG inspection copies under `docs/design/reference/inspection/` using Chromium, preserving the source files.
3. Verify artifact existence, dimensions, and browser render success with scripts or shell commands.
4. Open the PNG artifacts in the Codex app or a local image viewer for human inspection.
5. Require human visual approval before updating `docs/design/golden-implementation.md`.

The implementing agent must not claim visual QA completion unless a model-visible image tool succeeds and the image content is actually available for visual reasoning.

## Useful Commands

Create representative reference PNG inspection copies with Chromium by saving this JavaScript as `tmp-reference-browser-copies.mjs`, running `node tmp-reference-browser-copies.mjs`, then removing the temporary script:

```js
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const sources = [
  ['material-walnut', 'docs/design/reference/materials/walnut.webp'],
  ['surface-button', 'docs/design/reference/surfaces/button.webp'],
  ['typography-system', 'docs/design/reference/typography/obsidian-gallery-typography-system.webp'],
]
const outDir = resolve('docs/design/reference/inspection')
mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch({ headless: true })
for (const [name, source] of sources) {
  const page = await browser.newPage()
  await page.goto(pathToFileURL(resolve(source)).href, { waitUntil: 'load' })
  const dimensions = await page.evaluate(() => {
    const img = document.querySelector('img')
    return { width: img?.naturalWidth ?? window.innerWidth, height: img?.naturalHeight ?? window.innerHeight }
  })
  await page.setViewportSize(dimensions)
  await page.screenshot({ path: resolve(outDir, `${name}.png`), fullPage: false })
  await page.close()
}
await browser.close()
```

Verify PNG dimensions locally:

```powershell
Add-Type -AssemblyName System.Drawing
$paths = @(
  'docs/design/reference/inspection/material-walnut.png',
  'docs/design/reference/inspection/surface-button.png',
  'docs/design/reference/inspection/typography-system.png',
  'docs/design/screens/dashboard-active-units/mobile-390x844.png',
  'docs/design/screens/dashboard-active-units/desktop-1440x900.png'
)
foreach ($p in $paths) {
  $img = [System.Drawing.Image]::FromFile((Resolve-Path $p))
  [pscustomobject]@{ Path = $p; Width = $img.Width; Height = $img.Height; PixelFormat = $img.PixelFormat.ToString() }
  $img.Dispose()
}
```

## Required Verification Gate

For a future task to claim model-side visual inspection, all five of these must be true:

- A material reference image is visible to the model.
- A surface/component reference image is visible to the model.
- A typography reference image is visible to the model.
- `docs/design/screens/dashboard-active-units/mobile-390x844.png` is visible to the model.
- `docs/design/screens/dashboard-active-units/desktop-1440x900.png` is visible to the model.

As of this investigation, none of those five can be truthfully marked as model-inspected in this environment.
