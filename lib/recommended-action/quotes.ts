import { stableHash } from './config'
import type { QuoteContext, RuleId } from './types'

// Curator lines for the card. Rules:
// - Only real names and recorded timestamps go in; a template is skipped when
//   a value it needs is missing.
// - "Recorded" / "the ledger", never claims about what happened off-app.
// - No shaming, no artificial urgency. Keep each line under ~130 characters.
type QuoteTemplate = {
  id: string
  requires: (keyof QuoteContext)[]
  render: (context: Required<QuoteContext>) => string
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

const QUOTES: Record<RuleId, QuoteTemplate[]> = {
  RA01: [
    { id: 'ra01.shelf', requires: [], render: () => 'Every great army began as a single box on a cluttered desk. Let us give yours a name.' },
    { id: 'ra01.ledger', requires: [], render: () => 'An empty ledger is the most hopeful document in the gallery.' },
  ],
  RA02: [
    { id: 'ra02.recipe', requires: [], render: () => 'You know a recipe by heart. Somewhere, a painter is guessing at it.' },
    { id: 'ra02.quill', requires: [], render: () => 'The quill is sharpened and the parchment blank. The rest is up to you.' },
  ],
  RA03: [
    { id: 'ra03.empty', requires: ['projectName'], render: ({ projectName }) => `${projectName} has a fine name and, so far, no residents.` },
  ],
  RA04: [
    { id: 'ra04.portrait', requires: ['unitName'], render: ({ unitName }) => `${unitName} has not sat for a portrait yet. Today will do nicely.` },
    { id: 'ra04.before', requires: [], render: () => 'Before photos are the ones you will be most glad you took.' },
  ],
  RA07: [
    { id: 'ra07.days', requires: ['unitName', 'daysSinceRecorded'], render: ({ unitName, daysSinceRecorded }) => `The ledger has nothing new on ${unitName} in ${plural(daysSinceRecorded, 'day')}. Has the brush been busier than the books?` },
    { id: 'ra07.stage', requires: ['unitName', 'stageLabel'], render: ({ unitName, stageLabel }) => `Last I recorded, ${unitName} had reached ${stageLabel}. I suspect you have been modest.` },
    { id: 'ra07.blank', requires: ['unitName'], render: ({ unitName }) => `I have no record of where ${unitName} stands. A few taps would settle it.` },
  ],
  RA09: [
    { id: 'ra09.days', requires: ['unitName', 'daysSinceRecorded'], render: ({ unitName, daysSinceRecorded }) => `Your ${unitName} last saw a recorded session ${plural(daysSinceRecorded, 'day')} ago. They remain admirably patient.` },
    { id: 'ra09.stage', requires: ['unitName', 'stageLabel'], render: ({ unitName, stageLabel }) => `${unitName}, last recorded at ${stageLabel}. The next layer will not paint itself, regrettably.` },
    { id: 'ra09.bench', requires: ['unitName'], render: ({ unitName }) => `${unitName} is on the bench and the light is good. Shall we?` },
  ],
  RA10: [
    { id: 'ra10.clock', requires: ['unitName'], render: ({ unitName }) => `The clock on ${unitName} is still ticking. A few words now save a guess later.` },
    { id: 'ra10.note', requires: [], render: () => 'A session unrecorded is a recipe half-remembered.' },
  ],
  RA13: [
    { id: 'ra13.rack', requires: [], render: () => 'I know every pot in the catalogue and none on your shelf. Let us fix that.' },
    { id: 'ra13.duplicate', requires: [], render: () => 'A logged paint is one you will never buy twice by accident.' },
  ],
  RA15: [
    { id: 'ra15.days', requires: ['guideTitle', 'daysSinceRecorded'], render: ({ guideTitle, daysSinceRecorded }) => `“${guideTitle}” was last edited ${plural(daysSinceRecorded, 'day')} ago. The ink is dry; the idea need not be.` },
    { id: 'ra15.draft', requires: ['guideTitle'], render: ({ guideTitle }) => `“${guideTitle}” is waiting on the writing desk, one card from better.` },
  ],
  RA17: [
    { id: 'ra17.library', requires: [], render: () => 'The library is open, and someone has already solved the blend you are dreading.' },
  ],
}

const FALLBACK_QUOTE = { id: 'generic.bench', text: 'The bench is ready when you are.' }

function hasRequired(template: QuoteTemplate, context: QuoteContext) {
  return template.requires.every((key) => {
    const value = context[key]
    // A zero-day gap reads oddly ("0 days ago"); fall through to another line.
    return key === 'daysSinceRecorded'
      ? typeof value === 'number' && value >= 1
      : typeof value === 'string' && value.trim().length > 0
  })
}

// Same user, rule and day -> same line, so a re-render never flips the quote.
export function pickQuote(
  ruleId: RuleId,
  context: QuoteContext,
  seed: string
): { id: string; text: string } {
  const usable = (QUOTES[ruleId] ?? []).filter((template) => hasRequired(template, context))

  if (!usable.length) {
    return FALLBACK_QUOTE
  }

  const template = usable[stableHash(`${seed}:${ruleId}`) % usable.length]

  return {
    id: template.id,
    text: template.render(context as Required<QuoteContext>),
  }
}

export function getQuoteTemplateIds() {
  return Object.values(QUOTES).flatMap((templates) => templates.map((template) => template.id))
}
