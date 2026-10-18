// Every text the first-run app tour shows lives in this file.
//
// A step either highlights something on a page (`target`) or appears as a
// centred card (`kind: 'modal'`). When a new user has nothing to show yet,
// `emptyWhen` detects the blank state and the step swaps to its `empty` copy,
// optionally highlighting a different element (usually the + button).

// Paste the walkthrough video link here. The welcome and finish cards show a
// "Watch the video walkthrough" button only once it is set.
export const ONBOARDING_VIDEO_URL = ''

export type TourPlacement = 'top' | 'bottom' | 'bottom-end' | 'left' | 'right'

export type TourCopy = {
  title: string
  body: string
  target?: string | string[]
  placement?: TourPlacement
}

export type TourStep = {
  id: string
  kind: 'modal' | 'spotlight'
  /** Page the step lives on. Modal steps without a route show wherever the user is. */
  route?: string
  /** Section label shown above the title, e.g. "Dashboard". */
  section: string
  title: string
  body: string
  /** `data-tour-target` or `data-feature-guide-target` value(s) to highlight. */
  target?: string | string[]
  placement?: TourPlacement
  /** CSS selector that, when present on the page, means the user has nothing here yet. */
  emptyWhen?: string
  empty?: TourCopy
}

export const onboardingTourSteps: TourStep[] = [
  {
    id: 'welcome',
    kind: 'modal',
    section: 'Welcome',
    title: "Welcome to The Obsidian Gallery",
    body: "This is your hobby central, the miniature eco-system digitized. A home for your miniatures, your paints, your recipes and the wider hobby scene.\n\nI'll walk you through the app and its main features. It only takes about two minutes, and you can come back to it any time from the \"?\" button at the top of every page.",
  },

  // Dashboard
  {
    id: 'dashboard.page',
    kind: 'spotlight',
    route: '/dashboard',
    section: 'Dashboard',
    title: 'This is your Dashboard',
    body: "This is home. You'll land here when you open the app, straight to the main project on your painting table. The main focus here is what you want to do next.",
    target: 'dashboard.page',
    placement: 'bottom',
  },
  {
    id: 'dashboard.help',
    kind: 'spotlight',
    route: '/dashboard',
    section: 'Dashboard',
    title: 'Help is always one tap away',
    body: 'See this "?" button? Every page has one. Tap it any time for a closer look at the page you\'re on, or to take this tour again.',
    target: 'dashboard.help',
    placement: 'bottom-end',
  },
  {
    id: 'dashboard.next_actions',
    kind: 'spotlight',
    route: '/dashboard',
    section: 'Dashboard',
    title: 'Next Actions: your checklist',
    body: "Each action tells you what to do and where in the app it happens. Tick it off when you're done, or press Go to jump straight there. It's a great way to get to know the app as you use it.",
    target: 'dashboard.next_actions.panel',
    placement: 'bottom',
  },
  {
    id: 'dashboard.featured_unit',
    kind: 'spotlight',
    route: '/dashboard',
    section: 'Dashboard',
    title: "Move your main thing forward",
    body: "The unit, project, or guide you're currently focused on displays here. Press Resume to open it and start working. Your other active units wait on the Up Next shelf below. You can switch the status picker and watch units completed, benched or even the pile of shame.",
    target: 'dashboard.featured_unit',
    placement: 'top',
    emptyWhen: '[data-v3-dashboard-indicator="featured-unit-empty"]',
    empty: {
      title: 'Your painting table is waiting',
      body: "There's no featured unit or project yet. That's perfectly fine! Tap the \"+\" button up here any time to add your first project or unit, and it will show up right here with its photo and progress.",
      target: 'dashboard.add_next_action',
      placement: 'bottom-end',
    },
  },
  {
    id: 'dashboard.my_progress',
    kind: 'spotlight',
    route: '/dashboard',
    section: 'Dashboard',
    title: 'Watch yourself level up',
    body: "My Progress is where your path to grandmastery lives: your achievements, the badges you earn and your personal stats. Every session counts.",
    target: 'dashboard.tabs.my_progress',
    placement: 'bottom',
  },

  // Projects
  {
    id: 'projects.page',
    kind: 'spotlight',
    route: '/projects',
    section: 'Projects',
    title: 'Projects: organize your hobby',
    body: "Every miniature you plan or dream of painting lives here, grouped into bigger goals like an army, a warband or a box set.",
    target: 'projects.page',
    placement: 'bottom',
  },
  {
    id: 'projects.tabs',
    kind: 'spotlight',
    route: '/projects',
    section: 'Projects',
    title: "Your Projects",
    body: "The Projects tab shows your larger bodies of work, each a folder like entity grouping several units. The Units tab lists single or similar models, which can be part of one or several projects.",
    target: 'projects.tabs',
    placement: 'bottom',
  },
  {
    id: 'projects.card',
    kind: 'spotlight',
    route: '/projects',
    section: 'Projects',
    title: 'Where the painting happens',
    body: 'Open any project, then any unit inside it, to reach its workbench. There you can log painting sessions, tick off stages from basecoat to highlights, attach the paints you used and save progress photos.',
    target: 'projects.card',
    placement: 'top',
    emptyWhen: '[data-v3-projects-indicator="projects-empty"]',
    empty: {
      title: 'Your first project starts here',
      body: "You don't have any projects yet, so let's fix that whenever you're ready. Tap the + button to create one, then add the miniatures inside it. Each unit gets its own workbench for sessions, stages and photos.",
      target: 'projects.create_button',
      placement: 'bottom-end',
    },
  },

  // Paints
  {
    id: 'paints.page',
    kind: 'spotlight',
    route: '/paints',
    section: 'Paints',
    title: "All paints at your fingertips",
    body: "Keep track of the paints you own and the ones you want, find equivalents and explore thousands of paints from the major brands, to find the exact shade you need.",
    target: 'paints.page',
    placement: 'bottom',
  },
  {
    id: 'paints.tabs',
    kind: 'spotlight',
    route: '/paints',
    section: 'Paints',
    title: 'The catalog and your collection',
    body: "Paint Library is the whole catalog, where you can dive into paints. My Paints is your personal inventory and wishlist, ready to check the next time you are standing in the hobby store.",
    target: 'paints.tabs',
    placement: 'bottom',
  },
  {
    id: 'paints.filters',
    kind: 'spotlight',
    route: '/paints',
    section: 'Paints',
    title: "Find the right paint fast",
    body: "Search and filter by name, brand, line, and more. Find the best matches for your choice hue, and their equivalents across brands.",
    target: 'paints.toolbar',
    placement: 'bottom',
  },
  {
    id: 'paints.swatches',
    kind: 'spotlight',
    route: '/paints',
    section: 'Paints',
    title: 'Tap any swatch',
    body: "Tap a swatch to see the paint's details, then mark it as Owned or Wishlisted with a single press.",
    target: ['paints.swatch_grid', 'paints.paint_info_panel'],
    placement: 'top',
  },

  // Guides
  {
    id: 'guides.page',
    kind: 'spotlight',
    route: '/guides',
    section: 'Guides',
    title: "Guides: your painting recipes and inspiration",
    body: "Save the recipes and techniques you love, and discover new ones by fellow painters.",
    target: 'guides.page',
    placement: 'bottom',
  },
  {
    id: 'guides.tabs',
    kind: 'spotlight',
    route: '/guides',
    section: 'Guides',
    title: "Guides, simplifying the process",
    body: "A Guide is a series of cards, each a step that walks you through the process, and it can also reuse other guides inside it to build a complete tutorial. My Guides holds yours; Saved holds the ones you bookmarked.",
    target: 'guides.tabs',
    placement: 'bottom',
  },
  {
    id: 'guides.discover',
    kind: 'spotlight',
    route: '/guides',
    section: 'Guides',
    title: 'Learn from the community',
    body: "Discover lets you explore guides shared by other painters. Search by name or tags, and save the ones you want to use into your collection or straight onto a project/unit.",
    target: 'guides.tabs.library',
    placement: 'bottom',
  },

  // Community
  {
    id: 'community.page',
    kind: 'spotlight',
    route: '/community',
    section: 'Community',
    title: "Community: events, activities, news, and shops",
    body: "The hobby scene around you, all in one place. Find local events, shops, contests, and news.",
    target: 'community.page',
    placement: 'bottom',
  },
  {
    id: 'community.tabs',
    kind: 'spotlight',
    route: '/community',
    section: 'Community',
    title: 'Three ways to join in',
    body: "Contests has painting challenges you can enter. News brings updates, paint releases and creator posts. Events shows local meetups, hobby stores worth a visit and dates for your calendar.",
    target: 'community.tabs',
    placement: 'bottom',
  },

  // Wrap-up
  {
    id: 'help_button',
    kind: 'spotlight',
    route: '/community',
    section: 'One last thing',
    title: 'Need a reminder?',
    body: 'Every page has its own ? button. Tap it for a closer look at that page, or to take this full tour again.',
    target: 'community.help',
    placement: 'bottom-end',
  },
  {
    id: 'finish',
    kind: 'modal',
    section: 'All set',
    title: "You're all set. Enjoy the app!",
    body: "That's it for the overview. Plenty more great features hiding between the cards and buttons - don't be afraid to explore them! For now, the best first step is adding the project on your table right now. Happy painting, and stay creative!",
  },
]
