import type { FeatureGuideEntry } from './feature-guide-types'

function guide(
  uid: string,
  featureName: string,
  explanation: string,
  displayOrder: number,
  popupPlacement = 'bottom'
): FeatureGuideEntry {
  return {
    uid,
    feature_name: featureName,
    location_reference: featureName,
    component_reference: null,
    explanation,
    place_in_page: featureName,
    coach_mark_area: featureName,
    popup_placement: popupPlacement,
    display_order: displayOrder,
  }
}

export const projectsFeatureGuides = [
  guide('projects.page', 'Projects', 'Projects is where your hobby work is organized. The Projects tab groups units into bigger goals, while the Units tab lets you browse every miniature or model directly.', 100),
  guide('projects.tabs.projects', 'Projects Tab', 'Projects shows each project as a card with its description, unit count, average progress, and project image. Press a project card to open the project detail page.', 110),
  guide('projects.tabs.units', 'Units Tab', 'Units shows all miniatures across all projects. Use it when you want to jump straight to a specific unit instead of entering through its project.', 120),
  guide('projects.search', 'Search', 'Search filters the current tab so you can quickly find a project or unit by name.', 130),
  guide('projects.sort', 'Sort and View', 'Sort changes the order of the current list, and the view controls switch between denser and more visual layouts.', 140),
  guide('projects.card', 'Cards', 'Cards are the main objects on this page. Project cards open project detail, and unit cards open the unit page where painting work happens.', 150, 'top'),
]

export const paintsFeatureGuides = [
  guide('paints.page', 'Paints', 'Paints is your paint vault: the place to track owned colors, wishlist paints, search the catalog, export lists, and inspect paint details.', 100),
  guide('paints.tabs.my_paints', 'My Paints Tab', 'My Paints focuses on the paints you own or want. Use it to manage your personal inventory and avoid buying duplicates.', 110),
  guide('paints.tabs.library', 'Paint Library Tab', 'Paint Library opens the wider catalog so you can discover colors and add them to owned or wishlist status.', 120),
  guide('paints.search', 'Search', 'Search narrows the paint list by paint name, brand, or line.', 130),
  guide('paints.filters', 'Filters', 'Filters narrow the vault by brand, line, ownership, color group, or a color match sample.', 140),
  guide('paints.swatch_grid', 'Paint Swatches', 'The swatch grid is the main paint card area. Select a swatch to inspect the paint and update whether it is owned or on your wishlist.', 150, 'top'),
  guide('paints.paint_info_panel', 'Paint Info', 'The paint info panel shows the selected paint details and the ownership controls for adding it to your collection or wishlist.', 160, 'left'),
  guide('paints.export', 'Export', 'Export prepares your current paint list so it can be used outside the app.', 170),
]

export const guidesFeatureGuides = [
  guide('guides.page', 'Guides', 'Guides is your painting knowledge library. It holds guide files, reusable step decks, and the public library for discovering new techniques.', 100),
  guide('guides.tabs.guides', 'Guides Tab', 'Guides collects full painting guides. A guide can contain one or more decks and acts like the complete recipe file.', 110),
  guide('guides.tabs.decks', 'Decks Tab', 'Decks are reusable card sequences: cover card first, then step cards. Open a deck to view the card stack or use the edit button to change the deck.', 120),
  guide('guides.tabs.library', 'Library Tab', 'Library is for finding shared public guides and decks, using search and tags to narrow the collection.', 130),
  guide('guides.library_search', 'Library Search', 'Search filters guides and decks in the library so you can find a technique, paint effect, or recipe quickly.', 140),
  guide('guides.deck_save', 'Deck Edit', 'The edit control opens the deck editor where the deck description, card order, and cards can be changed.', 150, 'left'),
]

export const communityFeatureGuides = [
  guide('community.page', 'Community', 'Community gathers contests and news so painters can join events, see updates, and find what the wider hobby scene is doing.', 100),
  guide('community.tabs.contests', 'Contests Tab', 'Contests shows active challenges, featured events, and your saved or submitted entries.', 110),
  guide('community.tabs.news', 'News Tab', 'News shows app updates, hobby stories, paint announcements, creator posts, and other community updates.', 120),
  guide('community.hero', 'Featured Card', 'The featured card spotlights the most important contest or story in the current tab.', 130),
  guide('community.primary_list', 'Main List', 'The main list contains the current tab’s active challenges or latest news items.', 140, 'top'),
  guide('community.secondary_list', 'Saved and For You', 'The lower cards hold saved entries, creator spotlights, or personalized recommendations depending on the tab.', 150, 'top'),
]

export const projectDetailFeatureGuides = [
  guide('projects.detail.page', 'Project Detail', 'Project Detail is the command page for one project: its image, notes, units, gallery, and add-unit workflow all live here.', 100),
  guide('projects.detail.tabs.details', 'Details Tab', 'Details contains the project notes, stats, palette or theme information, and project gallery.', 110),
  guide('projects.detail.tabs.units', 'Units Tab', 'Units lists the miniatures inside this project. Use this tab to open or resume a specific unit.', 120),
  guide('projects.detail.units', 'Project Units', 'Project Units shows the project’s unit cards. The main card highlights the most recent or most active unit, and each card opens the unit page.', 140, 'top'),
  guide('projects.detail.add_unit', 'Add Unit', 'Tap this button to add a new miniature, squad, vehicle, or display piece directly inside this project.', 150),
]

export const unitDetailFeatureGuides = [
  guide('units.detail.page', 'Unit Detail', 'Unit Detail is the workbench for one miniature or unit. It holds identity, painting sessions, progress stages, palette, gallery, and completion history.', 100),
  guide('units.detail.tabs.overview', 'Overview Tab', 'Overview contains the unit details, session tracker, scheduler, palette, and gallery.', 110),
  guide('units.detail.tabs.progress', 'Progress Tab', 'Progress breaks the unit into painting stages so you can mark steps done, attach paints, and add stage photos.', 120),
  guide('units.detail.details', 'Unit Details', 'Unit Details stores complexity, model count, deadline, parent projects, and status.', 130),
  guide('units.detail.session_tracker', 'Session Tracker', 'The session tracker records painting time and keeps the unit connected to your dashboard progress.', 140),
  guide('units.detail.scheduler', 'Scheduler', 'The scheduler lets you plan future painting sessions and keep momentum on the unit.', 150),
  guide('units.detail.gallery', 'Gallery', 'Gallery stores photos for the unit, including the featured image used across the app.', 160, 'top'),
]

export const unitPreviewFeatureGuides = [
  guide('units.detail.page', 'Unit Detail', 'Unit Detail is the workbench for one miniature or unit. It holds identity, painting sessions, progress stages, palette, gallery, and completion history.', 100),
  guide('units.detail.tabs.details', 'Details Tab', 'Details contains the unit facts, parent project, status, palette, guide links, and gallery.', 110),
  guide('units.detail.tabs.paint', 'Paint Tab', 'Paint tracks time, sessions, scheduling, and the painting calendar for this unit.', 120),
  guide('units.detail.tabs.progress', 'Progress Tab', 'Progress breaks the miniature into painting stages so each step can be marked and documented.', 130),
  guide('units.detail.details', 'Unit Details', 'Unit Details stores complexity, model count, deadline, parent project, and current status.', 140),
  guide('units.detail.gallery', 'Gallery', 'Gallery stores photos for the unit, including the featured image used across the app.', 150, 'top'),
]

export const guideDetailFeatureGuides = [
  guide('guides.detail.page', 'Guide Detail', 'Guide Detail explains one guide file: what it teaches, how many decks and cards it contains, and which level it serves.', 100),
  guide('guides.detail.description', 'Description', 'Description summarizes the guide and shows the palette or color identity attached to it.', 110),
  guide('guides.detail.decks', 'Decks In This Guide', 'Decks In This Guide lists the step-card decks that belong to this guide. Press a deck to open its card stack.', 120, 'top'),
]

export const deckDetailFeatureGuides = [
  guide('guides.deck.page', 'Deck Detail', 'Deck Detail shows a painting deck in card form: cover card first, then each step card in order.', 100),
  guide('guides.deck.cover', 'Cover Card', 'The cover card identifies the deck, its promise, step count, and paint count.', 110),
  guide('guides.deck.steps', 'Step Cards', 'Step cards explain the process one move at a time, with paints and images shown directly on the card when available.', 120, 'top'),
]
