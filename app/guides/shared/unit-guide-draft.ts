// Turns what a unit holds into the starting cards of a new guide, and groups
// units into the folders of the From Unit picker. Kept free of server-only
// imports so it can be unit tested.
import type { DeckEditorInitialCard } from '../decks/[id]/deck-editor-client'
import { cardTypeDefaultBody } from './card-templates'

export type UnitGuidePaint = {
  id: string
  source: 'catalog' | 'custom'
  name: string
  brand: string | null
  line: string | null
  hex: string | null
  swatchImageUrl: string | null
  owned: boolean
}

export type UnitGuideImage = {
  url: string
  isFeatured: boolean
  altText: string | null
}

export type UnitGuideStage = {
  key: string
  label: string
  paints: UnitGuidePaint[]
  guideTitles: string[]
}

export type UnitGuideSource = {
  name: string
  notes: string | null
  // In gallery order.
  images: UnitGuideImage[]
  palette: UnitGuidePaint[]
  // In stage order.
  stages: UnitGuideStage[]
  // Oldest first.
  sessionNotes: Array<{ startedAt: string; notes: string }>
}

export type UnitGuideDraft = {
  title: string
  description: string
  coverImage: string | null
  cards: DeckEditorInitialCard[]
}

// What the step card's paint slots hold (see stepPaintLimit in the card editor).
const STEP_PAINT_SLOTS = 4
const STAGE_TAG = 'stage:'

function editorPaint(paint: UnitGuidePaint) {
  return {
    id: `${paint.source}:${paint.id}`,
    source: paint.source,
    brand: paint.brand,
    line: paint.line,
    name: paint.name,
    hex_approx: paint.hex,
    swatch_image_url: paint.swatchImageUrl,
    is_owned: paint.owned,
  }
}

function uniquePaints(paints: UnitGuidePaint[]) {
  const seen = new Set<string>()
  return paints.filter((paint) => {
    const key = `${paint.source}:${paint.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function sessionDate(startedAt: string) {
  const date = new Date(startedAt)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function stageBody(stage: UnitGuideStage) {
  const lines: string[] = []
  if (stage.guideTitles.length) lines.push(`Guide used: ${stage.guideTitles.join(', ')}.`)
  const overflow = uniquePaints(stage.paints).slice(STEP_PAINT_SLOTS)
  if (overflow.length) lines.push(`Also used: ${overflow.map((paint) => paint.name).join(', ')}.`)
  return lines.join('\n') || cardTypeDefaultBody('step')
}

// Cover, the paints, the notes, then each stage that has anything in it
// followed by its photos, then the rest of the gallery.
export function buildUnitGuideDraft(source: UnitGuideSource): UnitGuideDraft {
  const title = source.name.trim() || 'Untitled Unit'
  const description = `A painting guide for ${title}.`
  const coverImage = (source.images.find((image) => image.isFeatured) ?? source.images[0])?.url ?? null

  const stageKeys = new Set(source.stages.map((stage) => stage.key))
  const stageOf = (image: UnitGuideImage) => {
    const key = image.altText?.startsWith(STAGE_TAG) ? image.altText.slice(STAGE_TAG.length) : null
    return key && stageKeys.has(key) ? key : null
  }

  const card = (
    kind: string,
    fields: Pick<DeckEditorInitialCard, 'title' | 'template' | 'body'> & Partial<DeckEditorInitialCard>
  ): DeckEditorInitialCard => ({ id: `unit:${kind}`, image: null, paints: [], videoUrl: null, ...fields })

  const cards: DeckEditorInitialCard[] = [
    card('cover', { title, template: 'cover', body: description, image: coverImage }),
  ]

  const allPaints = uniquePaints([...source.palette, ...source.stages.flatMap((stage) => stage.paints)])
  if (allPaints.length) {
    cards.push(card('paints', {
      title: 'Paint List',
      template: 'paints',
      body: cardTypeDefaultBody('paints'),
      paints: allPaints.map(editorPaint),
    }))
  }

  const notes = source.notes?.trim()
  if (notes) cards.push(card('notes', { title: 'Notes', template: 'step', body: notes }))

  source.sessionNotes.forEach((session, index) => {
    const body = session.notes.trim()
    if (!body) return
    const date = sessionDate(session.startedAt)
    cards.push(card(`session:${index}`, {
      title: date ? `Session Notes, ${date}` : 'Session Notes',
      template: 'step',
      body,
    }))
  })

  for (const stage of source.stages) {
    const photos = source.images.filter((image) => stageOf(image) === stage.key)
    if (!photos.length && !stage.paints.length && !stage.guideTitles.length) continue

    cards.push(card(`stage:${stage.key}`, {
      title: stage.label,
      template: 'step',
      body: stageBody(stage),
      paints: uniquePaints(stage.paints).slice(0, STEP_PAINT_SLOTS).map(editorPaint),
    }))
    photos.forEach((photo, index) => {
      cards.push(card(`stage:${stage.key}:photo:${index}`, {
        title: photos.length > 1 ? `${stage.label} Photo ${index + 1}` : `${stage.label} Photo`,
        template: 'image',
        body: `Progress photo from the ${stage.label} stage.`,
        image: photo.url,
      }))
    })
  }

  source.images
    .filter((image) => !stageOf(image))
    .forEach((image, index) => {
      // Old stage tags and stock alt text aren't captions a reader should see.
      const caption = image.altText?.startsWith(STAGE_TAG) ? '' : image.altText?.trim()
      cards.push(card(`photo:${index}`, {
        title: `Photo ${index + 1}`,
        template: 'image',
        body: caption && caption !== title ? caption : `From the ${title} gallery.`,
        image: image.url,
      }))
    })

  return { title, description, coverImage, cards }
}

export type UnitSourceFolder = {
  id: string
  name: string
  image: string | null
  units: Array<{ id: string; name: string; image: string | null }>
}

export const STANDALONE_FOLDER_ID = 'standalone'

// One folder per project, in name order, with standalone units last. A unit in
// several projects shows under the first, as on Paint Mode's picker. A folder
// without its own image borrows its first unit's.
export function groupUnitSourceFolders({
  units,
  projects,
  links,
  unitImages,
  projectImages,
}: {
  units: Array<{ id: string; name: string | null; project_id: string | null }>
  projects: Array<{ id: string; name: string | null }>
  links: Array<{ unit_id: string; project_id: string }>
  unitImages: Map<string, string>
  projectImages: Map<string, string>
}): UnitSourceFolder[] {
  const projectNames = new Map(projects.map((project) => [project.id, project.name || 'Untitled Project']))
  const linkedProject = new Map<string, string>()
  for (const link of links) {
    if (!linkedProject.has(link.unit_id)) linkedProject.set(link.unit_id, link.project_id)
  }

  const folders = new Map<string, UnitSourceFolder>()
  for (const unit of units) {
    const projectId = linkedProject.get(unit.id) ?? unit.project_id
    const key = projectId && projectNames.has(projectId) ? projectId : STANDALONE_FOLDER_ID
    const folder = folders.get(key) ?? {
      id: key,
      name: key === STANDALONE_FOLDER_ID ? 'Standalone units' : projectNames.get(key)!,
      image: projectImages.get(key) ?? null,
      units: [],
    }
    folder.units.push({ id: unit.id, name: unit.name || 'Untitled Unit', image: unitImages.get(unit.id) ?? null })
    folders.set(key, folder)
  }

  return [...folders.values()]
    .map((folder) => {
      const sorted = [...folder.units].sort((a, b) => a.name.localeCompare(b.name))
      return { ...folder, units: sorted, image: folder.image ?? sorted.find((unit) => unit.image)?.image ?? null }
    })
    .sort((a, b) =>
      a.id === STANDALONE_FOLDER_ID ? 1 : b.id === STANDALONE_FOLDER_ID ? -1 : a.name.localeCompare(b.name)
    )
}
