// Partner stores for Store Spotlights and /community/stores/[id].
// Fields left null show as "Coming soon" on the store page.

export type StoreOffering =
  | 'trading_cards'
  | 'board_games'
  | 'dice'
  | 'play_tables'
  | 'miniatures'
  | 'paints'
  | 'airbrushes'
  | 'scenery'
  | 'hobby_tools'
  | 'accessories'
  | 'trains'
  | 'track'

export const storeOfferingLabels: Record<StoreOffering, string> = {
  trading_cards: 'Trading Card Games',
  board_games: 'Board Games',
  dice: 'Dice',
  play_tables: 'Play Tables',
  miniatures: 'Miniatures',
  paints: 'Paints',
  airbrushes: 'Airbrushes',
  scenery: 'Scenery & Dioramas',
  hobby_tools: 'Hobby Tools',
  accessories: 'Sleeves & Accessories',
  trains: 'Model Trains',
  track: 'Track & Signals',
}

export type StoreSpotlight = {
  // Stable id: partner_link_clicks.target_id refers to it, so never reuse one.
  id: string
  name: string
  city: string | null
  // null = no website yet; the store's website links are hidden.
  url: string | null
  // One line for the Store Spotlights card.
  description: string
  // Store page copy.
  tagline: string
  about: string
  // Short labels shown as chips in the store page hero (up to 3).
  highlights: string[]
  // "What you'll find" boxes, up to 5.
  offerings: StoreOffering[]
  address: string | null
  hours: string[] | null
  // Person to ask for, shown next to the phone number.
  contactName?: string
  phone: string | null
  whatsapp: string | null
  instagram: string | null
  facebook: string | null
  // Thumbnail on the Store Spotlights card.
  image: string
  // Logos are shown whole on a light mount instead of cropped like photos.
  imageIsLogo?: boolean
  // Store page hero background; defaults to `image`.
  heroImage?: string
  // Store page gallery; empty slots show as placeholders.
  photos: string[]
  // Kept for later but not shown in Store Spotlights.
  hidden?: boolean
  // Members-only offer: the Events tab hero card, plus a code card on the store page.
  promo?: StorePromo
}

export type StorePromo = {
  title: string
  text: string
  image: string
  // Shown on the store page for members to use at checkout.
  code: string
}

const noContactYet = {
  address: null,
  hours: null,
  phone: null,
  whatsapp: null,
  instagram: null,
  facebook: null,
}

// city null = online-only store.
export const storeSpotlights: StoreSpotlight[] = [
  {
    id: 'syrolynia-jerusalem',
    name: 'Sirolynia',
    city: 'Jerusalem',
    url: 'https://sirolynia.com/il',
    description: 'Trading cards, board games and Warhammer, with play tables for open game nights.',
    tagline: 'Trading cards, board games & Warhammer',
    about:
      'Sirolynia is a Jerusalem game store for trading cards, board games, Warhammer miniatures and Citadel paints, with play tables where the community meets for open game nights.',
    highlights: ['Play tables', 'Game nights'],
    offerings: ['trading_cards', 'board_games', 'miniatures', 'paints', 'play_tables'],
    ...noContactYet,
    address: 'Shmaryahu Levin 74',
    hours: ['Sun–Thu: 10:00–22:00'],
    contactName: 'Yarden',
    phone: '+972 52-298-3446',
    image: '/community/stores/syrolynia.webp',
    photos: [
      '/community/stores/syrolynia.webp',
      '/community/stores/sirolynia-warhammer.jpg',
      '/community/stores/sirolynia-play-tables.jpg',
    ],
    promo: {
      title: '5% off at Sirolynia',
      text: 'Get your members-only discount code on the store page.',
      image: '/community/stores/sirolynia-warhammer.jpg',
      code: 'Obsidian-Gallery-5',
    },
  },
  {
    id: 'the-kingdom-hod-hasharon',
    name: 'The Kingdom',
    city: 'Hod Hasharon',
    url: 'https://thekingdom.co.il/',
    description: 'Shelves packed with board games, from party picks to strategy heavyweights.',
    tagline: 'Board games for every kind of table',
    about:
      'The Kingdom is a Hod Hasharon board game store with shelves packed with games, from party picks to strategy heavyweights.',
    highlights: ['Board games'],
    offerings: ['board_games'],
    ...noContactYet,
    image: '/community/stores/the-kingdom.jpg',
    photos: ['/community/stores/the-kingdom.jpg'],
  },
  {
    id: 'akitaija-beersheba',
    name: 'Akitaija',
    city: 'Beersheba',
    url: null,
    description: 'Board games, trading cards and miniatures for gamers in the south.',
    tagline: 'Games, cards & miniatures in the south',
    about:
      'Akitaija is a Beersheba game store for board games, trading cards and miniatures, bringing tabletop gaming to the south.',
    highlights: ['Board games', 'Trading cards'],
    offerings: ['board_games', 'trading_cards', 'miniatures'],
    ...noContactYet,
    image: '/community/stores/akitaija.webp',
    photos: ['/community/stores/akitaija.webp'],
  },
  {
    id: 'mythic-games-eilat',
    name: 'Mythic Games',
    city: 'Eilat',
    url: 'https://mythic.co.il/',
    description: 'VAT-free Eilat shop for Magic, Pokémon and Warhammer, with Commander nights in store.',
    tagline: 'Cards, Warhammer & Commander nights',
    about:
      'Mythic Games is a VAT-free store in Eilat for trading card games like Magic: The Gathering, Pokémon, One Piece and Dragon Ball, plus Warhammer miniatures, paints and card sleeves. It also hosts in-store events such as Commander nights.',
    highlights: ['VAT-free', 'Commander nights'],
    offerings: ['trading_cards', 'miniatures', 'paints', 'accessories'],
    ...noContactYet,
    image: '/community/stores/mythic-games.webp',
    photos: ['/community/stores/mythic-games.webp'],
    hidden: true,
  },
  {
    id: 'hobbytech-online',
    name: 'Hobbytech',
    city: null,
    url: 'https://hobbytech.co.il/',
    description: 'Paints, airbrushes and diorama supplies from Vallejo, AK and AMMO.',
    tagline: 'Paints, airbrushes & diorama supplies',
    about:
      'Hobbytech is an online store for painting and modeling supplies: acrylic paints and pigments from Vallejo, AK Interactive and AMMO, airbrushes, diorama materials and modeling accessories.',
    highlights: ['Vallejo', 'AK', 'AMMO'],
    offerings: ['paints', 'airbrushes', 'scenery', 'hobby_tools'],
    ...noContactYet,
    image: '/community/stores/hobbytech.png',
    imageIsLogo: true,
    // Placeholder until we have a Hobbytech photo; the logo is too small for a hero.
    heroImage: '/onboarding/pains/paint-management.jpeg',
    photos: [],
  },
  {
    id: 'modeltrains-online',
    name: 'ModelTrains',
    city: null,
    url: 'https://modeltrains.co.il/',
    description: 'Märklin, Piko and Minitrix trains, track and scenery in H0 and N scale.',
    tagline: 'Model railways in H0 and N scale',
    about:
      'ModelTrains is an Israeli online model railway shop with starter sets, locomotives, passenger and freight cars and track from Märklin, Minitrix and Piko, mainly in H0 and N scale, plus scenery, buildings, signaling and paints.',
    highlights: ['Märklin', 'Piko', 'Minitrix'],
    offerings: ['trains', 'track', 'scenery', 'paints'],
    ...noContactYet,
    image: '/community/stores/modeltrains.webp',
    photos: ['/community/stores/modeltrains.webp'],
  },
]

export function getVisibleStores() {
  return storeSpotlights.filter((store) => !store.hidden)
}

export function getStorePromo() {
  return getVisibleStores().find((store) => store.promo) ?? null
}

export function getStore(id: string) {
  return storeSpotlights.find((store) => store.id === id && !store.hidden) ?? null
}

export function storeHref(store: StoreSpotlight) {
  return `/community/stores/${store.id}`
}
