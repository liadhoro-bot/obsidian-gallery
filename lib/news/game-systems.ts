// Works out which game or range a headline is about, so the newsroom knows
// which official YouTube channel to search and which cover to draw. Pure and
// client-safe.

export type CoverTone = 'crimson' | 'azure' | 'violet' | 'steel' | 'bronze' | 'pitch' | 'amber' | 'paint' | 'neutral'

export type GameSystem = {
  id: string
  label: string
  // Short mark drawn on the cover's brass plate.
  monogram: string
  maker: string
  // Slug of the official YouTube source to search, when we follow one.
  channelSlug: string | null
  tone: CoverTone
}

type SystemRule = GameSystem & { terms: string[] }

const GW = 'Games Workshop'
const WARHAMMER = 'warhammer-youtube'

// Order matters: specific games before the broad ones they mention.
const RULES: SystemRule[] = [
  { id: 'kill-team', label: 'Kill Team', monogram: 'KT', maker: GW, channelSlug: WARHAMMER, tone: 'steel', terms: ['kill team'] },
  {
    id: 'horus-heresy',
    label: 'The Horus Heresy',
    monogram: 'HH',
    maker: GW,
    channelSlug: WARHAMMER,
    tone: 'bronze',
    terms: ['horus heresy', 'legions imperialis', 'adeptus titanicus'],
  },
  {
    id: 'old-world',
    label: 'The Old World',
    monogram: 'TOW',
    maker: GW,
    channelSlug: WARHAMMER,
    tone: 'violet',
    terms: ['old world', 'wh tow', 'warhammer tow', 'tomb kings', 'bretonnia', 'bretonnian', 'bretonnians', 'empire of man', 'dwarfen mountain holds', 'wood elf realms'],
  },
  { id: 'blood-bowl', label: 'Blood Bowl', monogram: 'BB', maker: GW, channelSlug: WARHAMMER, tone: 'pitch', terms: ['blood bowl'] },
  { id: 'necromunda', label: 'Necromunda', monogram: 'N', maker: GW, channelSlug: WARHAMMER, tone: 'amber', terms: ['necromunda'] },
  {
    id: 'middle-earth',
    label: 'Middle-earth',
    monogram: 'ME',
    maker: GW,
    channelSlug: WARHAMMER,
    tone: 'pitch',
    terms: ['middle earth', 'lord of the rings', 'mesbg', 'the hobbit'],
  },
  { id: 'underworlds', label: 'Warhammer Underworlds', monogram: 'WU', maker: GW, channelSlug: WARHAMMER, tone: 'violet', terms: ['underworlds'] },
  { id: 'warcry', label: 'Warcry', monogram: 'WC', maker: GW, channelSlug: WARHAMMER, tone: 'amber', terms: ['warcry'] },
  {
    id: 'age-of-sigmar',
    label: 'Age of Sigmar',
    monogram: 'AoS',
    maker: GW,
    channelSlug: WARHAMMER,
    tone: 'azure',
    terms: [
      'age of sigmar', 'aos', 'sigmar', 'spearhead', 'stormcast', 'seraphon', 'skaven', 'nighthaunt', 'soulblight',
      'lumineth', 'idoneth', 'kharadron', 'khazalite', 'sylvaneth', 'gloomspite', 'orruk', 'orruks', 'ossiarch',
      'flesh eater', 'sons of behemat', 'ogor', 'cities of sigmar', 'slaves to darkness', 'disciples of tzeentch',
      'hedonites', 'maggotkin', 'blades of khorne', 'fyreslayers', 'daughters of khaine', 'kruleboyz', 'ironjawz',
      'helsmiths',
    ],
  },
  {
    id: '40k',
    label: 'Warhammer 40,000',
    monogram: '40K',
    maker: GW,
    channelSlug: WARHAMMER,
    tone: 'crimson',
    terms: [
      '40k', 'warhammer 40 000', 'warhammer 40000', 'space marine', 'space marines', 'astra militarum', 'necron',
      'necrons', 'tyranid', 'tyranids', 'orks', 'aeldari', 'drukhari', 'blood angels', 'dark angels', 'space wolves',
      'black templars', 'ultramarines', 'chaos space marines', 'adepta sororitas', 'sisters of battle', 't au', 'tau empire',
      'imperial knights', 'chaos knights', 'leagues of votann', 'genestealer', 'grey knights', 'death guard',
      'thousand sons', 'world eaters', 'emperor s children', 'adeptus custodes', 'adeptus mechanicus', 'combat patrol',
      'codex', 'primarch',
    ],
  },
  {
    id: 'citadel',
    label: 'Citadel Colour',
    monogram: 'CC',
    maker: GW,
    channelSlug: WARHAMMER,
    tone: 'paint',
    terms: ['citadel', 'contrast paint', 'contrast paints'],
  },
  {
    id: 'kings-of-war',
    label: 'Kings of War',
    monogram: 'KoW',
    maker: 'Mantic Games',
    channelSlug: 'mantic-games-youtube',
    tone: 'crimson',
    terms: ['kings of war', 'pannithor'],
  },
  {
    id: 'mantic',
    label: 'Mantic Games',
    monogram: 'M',
    maker: 'Mantic Games',
    channelSlug: 'mantic-games-youtube',
    tone: 'steel',
    terms: ['mantic', 'firefight', 'deadzone', 'halo flashpoint', 'armada'],
  },
  {
    id: 'army-painter',
    label: 'The Army Painter',
    monogram: 'AP',
    maker: 'The Army Painter',
    channelSlug: 'the-army-painter-youtube',
    tone: 'paint',
    terms: ['army painter', 'speedpaint', 'speedpaints', 'warpaints', 'warpaints fanatic'],
  },
  {
    id: 'monument',
    label: 'Monument Hobbies',
    monogram: 'PA',
    maker: 'Monument Hobbies',
    channelSlug: 'monument-hobbies-youtube',
    tone: 'paint',
    terms: ['monument hobbies', 'pro acryl'],
  },
  {
    id: 'wargames-atlantic',
    label: 'Wargames Atlantic',
    monogram: 'WA',
    maker: 'Wargames Atlantic',
    channelSlug: 'wargames-atlantic-youtube',
    tone: 'bronze',
    terms: ['wargames atlantic'],
  },
  { id: 'bolt-action', label: 'Bolt Action', monogram: 'BA', maker: 'Warlord Games', channelSlug: null, tone: 'bronze', terms: ['bolt action'] },
  {
    id: 'star-wars',
    label: 'Star Wars',
    monogram: 'SW',
    maker: 'Atomic Mass Games',
    channelSlug: null,
    tone: 'steel',
    terms: ['shatterpoint', 'star wars legion', 'star wars'],
  },
  { id: 'marvel', label: 'Marvel: Crisis Protocol', monogram: 'MCP', maker: 'Atomic Mass Games', channelSlug: null, tone: 'crimson', terms: ['crisis protocol'] },
  { id: 'trench-crusade', label: 'Trench Crusade', monogram: 'TC', maker: 'Trench Crusade', channelSlug: null, tone: 'amber', terms: ['trench crusade'] },
  { id: 'battletech', label: 'BattleTech', monogram: 'BT', maker: 'Catalyst Game Labs', channelSlug: null, tone: 'steel', terms: ['battletech'] },
  // Last: plain "Warhammer" with no game named.
  { id: 'warhammer', label: 'Warhammer', monogram: 'W', maker: GW, channelSlug: WARHAMMER, tone: 'crimson', terms: ['warhammer', 'games workshop'] },
]

function normalize(text: string) {
  return ` ${text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `
}

const NORMALIZED_RULES = RULES.map((rule) => ({ ...rule, needles: rule.terms.map(normalize) }))

export function detectGameSystem(...texts: Array<string | null | undefined>): GameSystem | null {
  const haystack = normalize(texts.filter(Boolean).join(' . '))
  if (haystack.trim() === '') return null
  const match = NORMALIZED_RULES.find((rule) => rule.needles.some((needle) => haystack.includes(needle)))
  if (!match) return null
  const { id, label, monogram, maker, channelSlug, tone } = match
  return { id, label, monogram, maker, channelSlug, tone }
}
