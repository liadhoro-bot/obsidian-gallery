with seed as (
  select *
  from jsonb_to_recordset($feature_guide$
[
  {
    "uid": "global.mobile_nav.dashboard",
    "feature_name": "Dashboard navigation",
    "feature_type": "navigation",
    "location_reference": "Global mobile nav > Home",
    "page_path": "/dashboard",
    "component_reference": "app/components/MobileNav.tsx",
    "explanation": "Opens the main dashboard, where active units, next actions, progress, and shortcuts are gathered into one check-in screen.",
    "place_in_page": "Fixed bottom navigation bar",
    "coach_mark_target": "nav item named Home",
    "coach_mark_area": "The Home icon and label in the bottom navigation",
    "popup_placement": "top",
    "display_order": 10,
    "tags": [
      "global",
      "navigation",
      "dashboard"
    ]
  },
  {
    "uid": "global.mobile_nav.projects",
    "feature_name": "Projects navigation",
    "feature_type": "navigation",
    "location_reference": "Global mobile nav > Projects",
    "page_path": "/projects",
    "component_reference": "app/components/MobileNav.tsx",
    "explanation": "Opens the project library for organizing armies, squads, commissions, and larger hobby goals.",
    "place_in_page": "Fixed bottom navigation bar",
    "coach_mark_target": "nav item named Projects",
    "coach_mark_area": "The Projects icon and label in the bottom navigation",
    "popup_placement": "top",
    "display_order": 20,
    "tags": [
      "global",
      "navigation",
      "projects"
    ]
  },
  {
    "uid": "global.mobile_nav.paints",
    "feature_name": "Paints navigation",
    "feature_type": "navigation",
    "location_reference": "Global mobile nav > Paints",
    "page_path": "/paints",
    "component_reference": "app/components/MobileNav.tsx",
    "explanation": "Opens the paint vault for tracking owned paints, wishlisted paints, matching colors, custom mixes, and paint details.",
    "place_in_page": "Fixed bottom navigation bar",
    "coach_mark_target": "nav item named Paints",
    "coach_mark_area": "The Paints icon and label in the bottom navigation",
    "popup_placement": "top",
    "display_order": 30,
    "tags": [
      "global",
      "navigation",
      "paints",
      "vault"
    ]
  },
  {
    "uid": "global.mobile_nav.guides",
    "feature_name": "Guides navigation",
    "feature_type": "navigation",
    "location_reference": "Global mobile nav > Guides",
    "page_path": "/guides",
    "component_reference": "app/components/MobileNav.tsx",
    "explanation": "Opens the guide area for saved guides, reusable decks, and the public guide library.",
    "place_in_page": "Fixed bottom navigation bar",
    "coach_mark_target": "nav item named Guides",
    "coach_mark_area": "The Guides icon and label in the bottom navigation",
    "popup_placement": "top",
    "display_order": 40,
    "tags": [
      "global",
      "navigation",
      "guides",
      "recipes"
    ]
  },
  {
    "uid": "global.mobile_nav.themes",
    "feature_name": "Themes navigation",
    "feature_type": "navigation",
    "location_reference": "Global mobile nav > Themes",
    "page_path": "/themes",
    "component_reference": "app/components/MobileNav.tsx",
    "explanation": "Opens theme collections, where palettes, reference images, units, projects, and guides can be grouped by visual direction.",
    "place_in_page": "Fixed bottom navigation bar",
    "coach_mark_target": "nav item named Themes",
    "coach_mark_area": "The Themes icon and label in the bottom navigation",
    "popup_placement": "top",
    "display_order": 50,
    "tags": [
      "global",
      "navigation",
      "themes"
    ]
  },
  {
    "uid": "global.settings",
    "feature_name": "Settings shortcut",
    "feature_type": "button",
    "location_reference": "Top bar > Settings",
    "page_path": "/settings",
    "component_reference": "app/dashboard/dashboard-top-bar.tsx",
    "explanation": "Opens profile, preferences, session controls, support, account, and legal settings.",
    "place_in_page": "Top right of authenticated pages",
    "coach_mark_target": "settings icon button",
    "coach_mark_area": "The circular gear button in the top bar",
    "popup_placement": "bottom-start",
    "display_order": 60,
    "tags": [
      "global",
      "settings"
    ]
  },
  {
    "uid": "global.curator",
    "feature_name": "The Curator",
    "feature_type": "button",
    "location_reference": "Global assistant button",
    "page_path": "/dashboard",
    "component_reference": "app/components/curator/curator-button.tsx",
    "explanation": "Opens The Curator, a contextual helper that gives hobby guidance, next-step suggestions, and app-specific assistance.",
    "place_in_page": "Floating app assistant control",
    "coach_mark_target": "button aria-label Open The Curator",
    "coach_mark_area": "The floating Curator button and its chat panel",
    "popup_placement": "top-end",
    "display_order": 70,
    "tags": [
      "global",
      "assistant",
      "curator"
    ]
  },
  {
    "uid": "global.install_app",
    "feature_name": "Download app",
    "feature_type": "button",
    "location_reference": "Install prompt > Download app",
    "page_path": "/dashboard",
    "component_reference": "app/components/download-app-button.tsx",
    "explanation": "Installs Obsidian Gallery as an app when the browser supports the install prompt.",
    "place_in_page": "Install or prompt area",
    "coach_mark_target": "button aria-label Download app",
    "coach_mark_area": "The download or install button",
    "popup_placement": "top",
    "display_order": 80,
    "tags": [
      "global",
      "pwa"
    ]
  },
  {
    "uid": "dashboard.page",
    "feature_name": "Dashboard",
    "feature_type": "page",
    "location_reference": "Dashboard",
    "page_path": "/dashboard",
    "component_reference": "app/dashboard/page.tsx",
    "explanation": "The daily command center for active units, next actions, featured work, stats, XP, badges, and quick routes back into painting.",
    "place_in_page": "Main dashboard page",
    "coach_mark_target": "main dashboard content",
    "coach_mark_area": "The whole dashboard viewport",
    "popup_placement": "auto",
    "display_order": 100,
    "tags": [
      "dashboard",
      "page"
    ]
  },
  {
    "uid": "dashboard.help",
    "feature_name": "Dashboard explainer",
    "feature_type": "button",
    "location_reference": "Dashboard header > ?",
    "page_path": "/dashboard",
    "component_reference": "app/dashboard/dashboard-v3-preview.tsx",
    "explanation": "Explains what the dashboard is for: a quick check-in view for active units, next actions, and painting progress.",
    "place_in_page": "Dashboard header",
    "coach_mark_target": "button aria-label Show dashboard explanation",
    "coach_mark_area": "The question mark button in the Dashboard header",
    "popup_placement": "bottom-end",
    "display_order": 110,
    "tags": [
      "dashboard",
      "help",
      "popup"
    ]
  },
  {
    "uid": "dashboard.add_next_action",
    "feature_name": "Add next action",
    "feature_type": "button",
    "location_reference": "Dashboard header > +",
    "page_path": "/dashboard",
    "component_reference": "app/dashboard/dashboard-v3-preview.tsx",
    "explanation": "Adds a new dashboard task to the next action list so the user has one more concrete step to follow.",
    "place_in_page": "Dashboard header",
    "coach_mark_target": "button aria-label Add next action",
    "coach_mark_area": "The plus button beside the Dashboard help button",
    "popup_placement": "bottom-end",
    "display_order": 120,
    "tags": [
      "dashboard",
      "next-actions",
      "button"
    ]
  },
  {
    "uid": "dashboard.tabs.active_units",
    "feature_name": "Active Units tab",
    "feature_type": "tab",
    "location_reference": "Dashboard > Dashboard sections > Active Units",
    "page_path": "/dashboard",
    "component_reference": "app/dashboard/dashboard-tabs.tsx",
    "explanation": "Shows current bench work, the next action panel, featured unit progress, and units that are ready for attention.",
    "place_in_page": "Below dashboard header",
    "coach_mark_target": "tab named Active Units",
    "coach_mark_area": "The Active Units segmented tab",
    "popup_placement": "bottom",
    "display_order": 130,
    "tags": [
      "dashboard",
      "tab",
      "units"
    ]
  },
  {
    "uid": "dashboard.tabs.my_progress",
    "feature_name": "My Progress tab",
    "feature_type": "tab",
    "location_reference": "Dashboard > Dashboard sections > My Progress",
    "page_path": "/dashboard",
    "component_reference": "app/dashboard/dashboard-tabs.tsx",
    "explanation": "Shows XP, streaks, badges, and stats so the user can understand their long-term hobby momentum.",
    "place_in_page": "Below dashboard header",
    "coach_mark_target": "tab named My Progress",
    "coach_mark_area": "The My Progress segmented tab",
    "popup_placement": "bottom",
    "display_order": 140,
    "tags": [
      "dashboard",
      "tab",
      "progress",
      "xp"
    ]
  },
  {
    "uid": "dashboard.next_actions.panel",
    "feature_name": "Next actions panel",
    "feature_type": "panel",
    "location_reference": "Dashboard > Next Actions",
    "page_path": "/dashboard",
    "component_reference": "app/dashboard/dashboard-next-actions-card.tsx",
    "explanation": "A short guided checklist chosen from the user onboarding goal. Each action has a completion control, a breadcrumb, and a route to the exact place to act.",
    "place_in_page": "Near top of Active Units dashboard",
    "coach_mark_target": "section aria-label User next actions",
    "coach_mark_area": "The whole next actions card",
    "popup_placement": "bottom",
    "display_order": 150,
    "tags": [
      "dashboard",
      "next-actions",
      "onboarding"
    ]
  },
  {
    "uid": "dashboard.next_actions.complete_toggle",
    "feature_name": "Next action complete toggle",
    "feature_type": "toggle",
    "location_reference": "Dashboard > Next Actions > Completion button",
    "page_path": "/dashboard",
    "component_reference": "app/dashboard/dashboard-next-actions-card.tsx",
    "explanation": "Marks a suggested action complete or incomplete and updates checklist progress for the current onboarding flow.",
    "place_in_page": "Left side of each next action row",
    "coach_mark_target": "button aria-pressed in next action row",
    "coach_mark_area": "The check box button at the start of an action row",
    "popup_placement": "right",
    "display_order": 160,
    "tags": [
      "dashboard",
      "next-actions",
      "toggle"
    ]
  },
  {
    "uid": "dashboard.next_actions.go",
    "feature_name": "Go to next action",
    "feature_type": "button",
    "location_reference": "Dashboard > Next Actions > Go",
    "page_path": "/dashboard",
    "component_reference": "app/dashboard/dashboard-next-actions-card.tsx",
    "explanation": "Navigates to the page and component referenced by the action so the user can perform the recommended step.",
    "place_in_page": "Right side of each next action row",
    "coach_mark_target": "link aria-label Go to action label",
    "coach_mark_area": "The Go button at the end of an action row",
    "popup_placement": "left",
    "display_order": 170,
    "tags": [
      "dashboard",
      "next-actions",
      "navigation"
    ]
  },
  {
    "uid": "dashboard.next_actions.dismiss",
    "feature_name": "Dismiss next actions",
    "feature_type": "button",
    "location_reference": "Dashboard > Next Actions > Dismiss",
    "page_path": "/dashboard",
    "component_reference": "app/dashboard/dashboard-next-actions-card.tsx",
    "explanation": "Hides the onboarding next action checklist for the user when they do not want it on the dashboard.",
    "place_in_page": "Top right of next actions card",
    "coach_mark_target": "button aria-label Dismiss next actions",
    "coach_mark_area": "The close button in the next actions card header",
    "popup_placement": "left",
    "display_order": 180,
    "tags": [
      "dashboard",
      "next-actions",
      "dismiss"
    ]
  },
  {
    "uid": "dashboard.quick_actions.start",
    "feature_name": "Start Project or Unit",
    "feature_type": "button",
    "location_reference": "Dashboard > Quick Actions > Start Project or Unit",
    "page_path": "/dashboard",
    "component_reference": "app/dashboard/dashboard-quick-action-start-button.tsx",
    "explanation": "Opens the flow for creating a new project or a new unit, depending on what the user wants to start tracking.",
    "place_in_page": "Dashboard quick actions area",
    "coach_mark_target": "button aria-label Start Project or Unit",
    "coach_mark_area": "The Start Project or Unit quick action",
    "popup_placement": "top",
    "display_order": 190,
    "tags": [
      "dashboard",
      "quick-actions",
      "projects",
      "units"
    ]
  },
  {
    "uid": "dashboard.quick_actions.paint_collection",
    "feature_name": "Build Your Collection",
    "feature_type": "button",
    "location_reference": "Dashboard > Quick Actions > Build Your Collection",
    "page_path": "/dashboard",
    "component_reference": "app/dashboard/dashboard-quick-action-paint-button.tsx",
    "explanation": "Sends the user to the paint vault to track owned paints, wishlist colors, and missing supplies.",
    "place_in_page": "Dashboard quick actions area",
    "coach_mark_target": "button aria-label Build Your Collection",
    "coach_mark_area": "The paint collection quick action",
    "popup_placement": "top",
    "display_order": 200,
    "tags": [
      "dashboard",
      "quick-actions",
      "paints"
    ]
  },
  {
    "uid": "dashboard.featured_unit",
    "feature_name": "Featured unit",
    "feature_type": "card",
    "location_reference": "Dashboard > Featured Unit",
    "page_path": "/dashboard",
    "component_reference": "app/dashboard/dashboard-unit-in-progress.tsx",
    "explanation": "Highlights the unit the user is currently focusing on, including progress, stage, time logged, and a resume route.",
    "place_in_page": "Active Units dashboard",
    "coach_mark_target": "featured unit card",
    "coach_mark_area": "The large featured unit card",
    "popup_placement": "top",
    "display_order": 210,
    "tags": [
      "dashboard",
      "units",
      "progress"
    ]
  },
  {
    "uid": "dashboard.resume_painting",
    "feature_name": "Resume painting",
    "feature_type": "button",
    "location_reference": "Dashboard > Featured Unit > Resume",
    "page_path": "/dashboard",
    "component_reference": "app/dashboard/dashboard-resume-button.tsx",
    "explanation": "Opens the active unit so the user can continue recording stages, photos, paints, and sessions.",
    "place_in_page": "Featured unit card",
    "coach_mark_target": "resume painting button",
    "coach_mark_area": "The Resume button on a unit card",
    "popup_placement": "left",
    "display_order": 220,
    "tags": [
      "dashboard",
      "units",
      "button"
    ]
  },
  {
    "uid": "dashboard.xp_card",
    "feature_name": "XP progress",
    "feature_type": "status",
    "location_reference": "Dashboard > Progress > XP",
    "page_path": "/dashboard",
    "component_reference": "app/dashboard/dashboard-xp-card.tsx",
    "explanation": "Shows level, current XP, progress toward the next level, and gamified painting momentum.",
    "place_in_page": "My Progress dashboard tab",
    "coach_mark_target": "XP progress card",
    "coach_mark_area": "The XP meter card",
    "popup_placement": "bottom",
    "display_order": 230,
    "tags": [
      "dashboard",
      "progress",
      "xp"
    ]
  },
  {
    "uid": "dashboard.hobby_badges",
    "feature_name": "Hobby badges",
    "feature_type": "status",
    "location_reference": "Dashboard > Progress > Badges",
    "page_path": "/dashboard",
    "component_reference": "app/dashboard/dashboard-hobby-badges.tsx",
    "explanation": "Shows earned and locked badges tied to milestones such as creating units, logging sessions, and finishing work.",
    "place_in_page": "My Progress dashboard tab",
    "coach_mark_target": "badges earned section",
    "coach_mark_area": "The badge list or badge card area",
    "popup_placement": "top",
    "display_order": 240,
    "tags": [
      "dashboard",
      "progress",
      "badges"
    ]
  },
  {
    "uid": "projects.page",
    "feature_name": "Projects",
    "feature_type": "page",
    "location_reference": "Projects",
    "page_path": "/projects",
    "component_reference": "app/projects/page.tsx",
    "explanation": "The project library for organizing related units, images, palettes, themes, and progress under a larger hobby goal.",
    "place_in_page": "Main projects page",
    "coach_mark_target": "main projects content",
    "coach_mark_area": "The whole projects viewport",
    "popup_placement": "auto",
    "display_order": 300,
    "tags": [
      "projects",
      "page"
    ]
  },
  {
    "uid": "projects.help",
    "feature_name": "Projects explainer",
    "feature_type": "button",
    "location_reference": "Projects header > ?",
    "page_path": "/projects",
    "component_reference": "app/projects/projects-v3-preview.tsx",
    "explanation": "Explains that projects collect units, reference images, paints, and guides together around a larger goal.",
    "place_in_page": "Projects header",
    "coach_mark_target": "button aria-label About projects",
    "coach_mark_area": "The question mark button in the Projects header",
    "popup_placement": "bottom-end",
    "display_order": 310,
    "tags": [
      "projects",
      "help",
      "popup"
    ]
  },
  {
    "uid": "projects.create_button",
    "feature_name": "Create project",
    "feature_type": "button",
    "location_reference": "Projects header > +",
    "page_path": "/projects",
    "component_reference": "app/projects/projects-v3-preview.tsx",
    "explanation": "Opens the new project form so the user can name a project, describe it, and start grouping units under it.",
    "place_in_page": "Projects header",
    "coach_mark_target": "button aria-label Create project",
    "coach_mark_area": "The plus button in the Projects header",
    "popup_placement": "bottom-end",
    "display_order": 320,
    "tags": [
      "projects",
      "create",
      "button"
    ]
  },
  {
    "uid": "projects.create_form",
    "feature_name": "Project create form",
    "feature_type": "form",
    "location_reference": "Projects > Create Project",
    "page_path": "/projects?tab=create",
    "component_reference": "app/projects/project-create-form.tsx",
    "explanation": "Creates a project with a name, description, optional status context, and room to gather units and images.",
    "place_in_page": "Project creation panel",
    "coach_mark_target": "project create form",
    "coach_mark_area": "The create project form fields and submit button",
    "popup_placement": "top",
    "display_order": 330,
    "tags": [
      "projects",
      "create",
      "form"
    ]
  },
  {
    "uid": "projects.card",
    "feature_name": "Project card",
    "feature_type": "card",
    "location_reference": "Projects > Project list",
    "page_path": "/projects",
    "component_reference": "components/projects/project-tile.tsx",
    "explanation": "Summarizes one project with its image, status, unit count, progress, and route to the project detail page.",
    "place_in_page": "Projects grid or list",
    "coach_mark_target": "project card",
    "coach_mark_area": "A single project tile or list row",
    "popup_placement": "top",
    "display_order": 340,
    "tags": [
      "projects",
      "card"
    ]
  },
  {
    "uid": "projects.detail.page",
    "feature_name": "Project detail",
    "feature_type": "page",
    "location_reference": "Projects > Project Detail",
    "page_path": "/projects/[id]",
    "component_reference": "app/projects/[id]/page.tsx",
    "explanation": "Shows one project in detail, including overview, units, gallery images, palettes, theme links, and deletion controls.",
    "place_in_page": "Project detail page",
    "coach_mark_target": "project detail content",
    "coach_mark_area": "The project detail viewport",
    "popup_placement": "auto",
    "display_order": 350,
    "tags": [
      "projects",
      "detail"
    ]
  },
  {
    "uid": "projects.detail.tabs",
    "feature_name": "Project detail tabs",
    "feature_type": "tab",
    "location_reference": "Project Detail > Tabs",
    "page_path": "/projects/[id]",
    "component_reference": "app/projects/[id]/project-detail-tabs.tsx",
    "explanation": "Switches between project details, attached units, gallery images, and palette/theme work.",
    "place_in_page": "Below project hero",
    "coach_mark_target": "project detail tabs",
    "coach_mark_area": "The segmented project detail tab row",
    "popup_placement": "bottom",
    "display_order": 360,
    "tags": [
      "projects",
      "detail",
      "tabs"
    ]
  },
  {
    "uid": "projects.add_unit_tab",
    "feature_name": "Add unit to project",
    "feature_type": "form",
    "location_reference": "Project Detail > Add Unit",
    "page_path": "/projects/[id]",
    "component_reference": "app/projects/[id]/project-add-unit-tab.tsx",
    "explanation": "Attaches existing units to a project or helps route the user toward creating another unit for the project.",
    "place_in_page": "Project units tab",
    "coach_mark_target": "project add unit tab",
    "coach_mark_area": "The add unit controls in the project units tab",
    "popup_placement": "top",
    "display_order": 370,
    "tags": [
      "projects",
      "units",
      "form"
    ]
  },
  {
    "uid": "projects.gallery",
    "feature_name": "Project gallery",
    "feature_type": "panel",
    "location_reference": "Project Detail > Gallery",
    "page_path": "/projects/[id]",
    "component_reference": "app/projects/[id]/project-gallery-card.tsx",
    "explanation": "Stores reference, progress, and showcase images for a project, with controls for upload, captions, and removal.",
    "place_in_page": "Project gallery tab or card",
    "coach_mark_target": "project gallery card",
    "coach_mark_area": "The project image gallery panel",
    "popup_placement": "top",
    "display_order": 380,
    "tags": [
      "projects",
      "gallery",
      "images"
    ]
  },
  {
    "uid": "projects.palette_starter",
    "feature_name": "Project palette starter",
    "feature_type": "panel",
    "location_reference": "Project Detail > Palette",
    "page_path": "/projects/[id]",
    "component_reference": "app/projects/[id]/project-palette-starter.tsx",
    "explanation": "Starts a color palette for the project and can connect visual direction to themes and paints.",
    "place_in_page": "Project palette area",
    "coach_mark_target": "project palette starter",
    "coach_mark_area": "The project palette starter panel",
    "popup_placement": "top",
    "display_order": 390,
    "tags": [
      "projects",
      "palette",
      "themes"
    ]
  },
  {
    "uid": "paints.page",
    "feature_name": "Paint Vault",
    "feature_type": "page",
    "location_reference": "Paints",
    "page_path": "/paints",
    "component_reference": "app/paints/page.tsx",
    "explanation": "The paint collection area for searching paints, marking ownership, building wishlists, matching colors, creating custom mixes, and exporting records.",
    "place_in_page": "Main paints page",
    "coach_mark_target": "main paints content",
    "coach_mark_area": "The whole paint vault viewport",
    "popup_placement": "auto",
    "display_order": 400,
    "tags": [
      "paints",
      "vault",
      "page"
    ]
  },
  {
    "uid": "paints.help",
    "feature_name": "Paint Vault explainer",
    "feature_type": "button",
    "location_reference": "Paint Vault header > ?",
    "page_path": "/paints",
    "component_reference": "app/paints/paints-v3-preview.tsx",
    "explanation": "Explains the paint vault: tracking owned and wanted paints, avoiding duplicates, exporting, and connecting paints to guides and themes.",
    "place_in_page": "Paint Vault header",
    "coach_mark_target": "button aria-label About paint vault",
    "coach_mark_area": "The question mark button in the Paint Vault header",
    "popup_placement": "bottom-end",
    "display_order": 410,
    "tags": [
      "paints",
      "help",
      "popup"
    ]
  },
  {
    "uid": "paints.create_custom_mix",
    "feature_name": "Create custom mix",
    "feature_type": "button",
    "location_reference": "Paint Vault header > +",
    "page_path": "/paints",
    "component_reference": "app/paints/paints-v3-preview.tsx",
    "explanation": "Opens the custom mix dialog so the user can save a mixed color recipe based on paints in their collection.",
    "place_in_page": "Paint Vault header",
    "coach_mark_target": "button aria-label Create custom mix",
    "coach_mark_area": "The plus button in the Paint Vault header",
    "popup_placement": "bottom-end",
    "display_order": 420,
    "tags": [
      "paints",
      "custom-mix",
      "button"
    ]
  },
  {
    "uid": "paints.tabs.my_paints",
    "feature_name": "My Paints tab",
    "feature_type": "tab",
    "location_reference": "Paint Vault > Paint views > My Paints",
    "page_path": "/paints",
    "component_reference": "app/paints/paints-v3-preview.tsx",
    "explanation": "Filters the paint vault to paints the user owns or has marked for their collection.",
    "place_in_page": "Below Paint Vault header",
    "coach_mark_target": "tab named My Paints",
    "coach_mark_area": "The My Paints segmented tab",
    "popup_placement": "bottom",
    "display_order": 430,
    "tags": [
      "paints",
      "tab",
      "owned"
    ]
  },
  {
    "uid": "paints.tabs.library",
    "feature_name": "Paint Library tab",
    "feature_type": "tab",
    "location_reference": "Paint Vault > Paint views > Paint Library",
    "page_path": "/paints",
    "component_reference": "app/paints/paints-v3-preview.tsx",
    "explanation": "Shows the broader paint catalog so the user can discover paints and add them to owned or wishlist states.",
    "place_in_page": "Below Paint Vault header",
    "coach_mark_target": "tab named Paint Library",
    "coach_mark_area": "The Paint Library segmented tab",
    "popup_placement": "bottom",
    "display_order": 440,
    "tags": [
      "paints",
      "tab",
      "library"
    ]
  },
  {
    "uid": "paints.search",
    "feature_name": "Paint search",
    "feature_type": "search",
    "location_reference": "Paint Vault > Search",
    "page_path": "/paints",
    "component_reference": "app/paints/paints-v3-preview.tsx",
    "explanation": "Searches paints by name, brand, or line and narrows the swatch grid immediately.",
    "place_in_page": "Paint search and filter area",
    "coach_mark_target": "input placeholder Search by name or brand",
    "coach_mark_area": "The paint search input",
    "popup_placement": "bottom",
    "display_order": 450,
    "tags": [
      "paints",
      "search"
    ]
  },
  {
    "uid": "paints.filters",
    "feature_name": "Paint filters",
    "feature_type": "filter",
    "location_reference": "Paint Vault > Filters",
    "page_path": "/paints",
    "component_reference": "app/paints/paints-v3-preview.tsx",
    "explanation": "Filters paints by brand, line, ownership state, color group, and nearest match color.",
    "place_in_page": "Paint search and filter area",
    "coach_mark_target": "filter controls",
    "coach_mark_area": "The paint filter panel and filter button",
    "popup_placement": "bottom",
    "display_order": 460,
    "tags": [
      "paints",
      "filter"
    ]
  },
  {
    "uid": "paints.match_color",
    "feature_name": "Match a color",
    "feature_type": "filter",
    "location_reference": "Paint Vault > Filters > Match a Color",
    "page_path": "/paints",
    "component_reference": "app/paints/paints-v3-preview.tsx",
    "explanation": "Lets the user choose a color and finds nearby paints in the catalog.",
    "place_in_page": "Paint filter panel",
    "coach_mark_target": "input aria-label Match a color",
    "coach_mark_area": "The Match a Color filter control",
    "popup_placement": "top",
    "display_order": 470,
    "tags": [
      "paints",
      "filter",
      "color-match"
    ]
  },
  {
    "uid": "paints.export",
    "feature_name": "Export paints",
    "feature_type": "export",
    "location_reference": "Paint Vault > Export",
    "page_path": "/paints",
    "component_reference": "app/paints/paints-v3-preview.tsx",
    "explanation": "Exports the current visible paint records as CSV, TXT, JSON, or printable PDF-style output.",
    "place_in_page": "Paint list toolbar",
    "coach_mark_target": "button text Export",
    "coach_mark_area": "The Export button and export dialog",
    "popup_placement": "top",
    "display_order": 480,
    "tags": [
      "paints",
      "export"
    ]
  },
  {
    "uid": "paints.swatch_grid",
    "feature_name": "Paint swatch grid",
    "feature_type": "panel",
    "location_reference": "Paint Vault > Paint swatches",
    "page_path": "/paints",
    "component_reference": "app/paints/paints-v3-preview.tsx",
    "explanation": "Displays paint colors as selectable swatches with ownership and wishlist indicators.",
    "place_in_page": "Paint list body",
    "coach_mark_target": "section aria-label Paint swatches",
    "coach_mark_area": "The paint swatch grid",
    "popup_placement": "top",
    "display_order": 490,
    "tags": [
      "paints",
      "swatches"
    ]
  },
  {
    "uid": "paints.paint_info_panel",
    "feature_name": "Paint info panel",
    "feature_type": "panel",
    "location_reference": "Paint Vault > Selected paint",
    "page_path": "/paints",
    "component_reference": "app/paints/paints-v3-preview.tsx",
    "explanation": "Shows details for the selected paint, including brand, line, finish, size, notes, ownership, wishlist state, and a detail route.",
    "place_in_page": "Bottom paint detail sheet",
    "coach_mark_target": "paint info panel",
    "coach_mark_area": "The fixed selected paint panel at the bottom",
    "popup_placement": "top",
    "display_order": 500,
    "tags": [
      "paints",
      "paint-detail"
    ]
  },
  {
    "uid": "vault.page",
    "feature_name": "Vault",
    "feature_type": "page",
    "location_reference": "Vault",
    "page_path": "/vault",
    "component_reference": "app/vault/page.tsx",
    "explanation": "The live paint vault route with collection, catalog search, custom paint forms, ownership controls, barcode scanning, color matching, and batch tools.",
    "place_in_page": "Main vault page",
    "coach_mark_target": "vault page content",
    "coach_mark_area": "The whole vault viewport",
    "popup_placement": "auto",
    "display_order": 510,
    "tags": [
      "vault",
      "paints",
      "page"
    ]
  },
  {
    "uid": "vault.tabs.collection",
    "feature_name": "My Paints vault tab",
    "feature_type": "tab",
    "location_reference": "Vault > My Paints",
    "page_path": "/vault?tab=collection",
    "component_reference": "app/vault/vault-segmented-tabs.tsx",
    "explanation": "Shows the user-owned collection view and defaults ownership filtering toward owned paints.",
    "place_in_page": "Top of vault page",
    "coach_mark_target": "tab named My Paints",
    "coach_mark_area": "The My Paints segment in the vault tab row",
    "popup_placement": "bottom",
    "display_order": 520,
    "tags": [
      "vault",
      "tab",
      "owned"
    ]
  },
  {
    "uid": "vault.tabs.find",
    "feature_name": "Find Paint vault tab",
    "feature_type": "tab",
    "location_reference": "Vault > Find Paint",
    "page_path": "/vault?tab=find",
    "component_reference": "app/vault/vault-segmented-tabs.tsx",
    "explanation": "Shows catalog search and filters for finding paints across the full catalog.",
    "place_in_page": "Top of vault page",
    "coach_mark_target": "tab named Find Paint",
    "coach_mark_area": "The Find Paint segment in the vault tab row",
    "popup_placement": "bottom",
    "display_order": 530,
    "tags": [
      "vault",
      "tab",
      "search"
    ]
  },
  {
    "uid": "vault.tabs.custom",
    "feature_name": "Custom Mix vault tab",
    "feature_type": "tab",
    "location_reference": "Vault > Custom Mix",
    "page_path": "/vault?tab=custom",
    "component_reference": "app/vault/vault-segmented-tabs.tsx",
    "explanation": "Opens the custom paint area where the user can record self-made mixes and formula details.",
    "place_in_page": "Top of vault page",
    "coach_mark_target": "tab named Custom Mix",
    "coach_mark_area": "The Custom Mix segment in the vault tab row",
    "popup_placement": "bottom",
    "display_order": 540,
    "tags": [
      "vault",
      "tab",
      "custom-paint"
    ]
  },
  {
    "uid": "vault.filters",
    "feature_name": "Vault filters",
    "feature_type": "filter",
    "location_reference": "Vault > Filters",
    "page_path": "/vault",
    "component_reference": "app/vault/vault-filters-client.tsx",
    "explanation": "Filters catalog and collection rows by query, brand, line, ownership, and color match details.",
    "place_in_page": "Vault filter panel",
    "coach_mark_target": "vault filters form",
    "coach_mark_area": "The live vault filter controls",
    "popup_placement": "bottom",
    "display_order": 550,
    "tags": [
      "vault",
      "filter"
    ]
  },
  {
    "uid": "vault.barcode_scanner",
    "feature_name": "Scan barcode",
    "feature_type": "button",
    "location_reference": "Vault > Filters > Scan barcode",
    "page_path": "/vault",
    "component_reference": "app/vault/barcode-scanner-modal.tsx",
    "explanation": "Opens the barcode scanner to look up paints or paint sets from a product barcode.",
    "place_in_page": "Vault filter panel",
    "coach_mark_target": "button aria-label Scan barcode",
    "coach_mark_area": "The barcode scan button beside vault filters",
    "popup_placement": "bottom",
    "display_order": 560,
    "tags": [
      "vault",
      "barcode",
      "paints"
    ]
  },
  {
    "uid": "vault.color_match_modal",
    "feature_name": "Color matcher",
    "feature_type": "modal",
    "location_reference": "Vault > Color Match",
    "page_path": "/vault",
    "component_reference": "app/vault/color-match-modal.tsx",
    "explanation": "Lets the user choose a color and compare the nearest paint catalog matches.",
    "place_in_page": "Vault modal layer",
    "coach_mark_target": "color matcher dialog",
    "coach_mark_area": "The color matcher dialog and color wheel",
    "popup_placement": "auto",
    "display_order": 570,
    "tags": [
      "vault",
      "color-match",
      "modal"
    ]
  },
  {
    "uid": "vault.batch_actions",
    "feature_name": "Batch paint actions",
    "feature_type": "panel",
    "location_reference": "Vault > Batch actions",
    "page_path": "/vault",
    "component_reference": "app/vault/vault-batch-actions.tsx",
    "explanation": "Applies ownership or wishlist actions to multiple selected paints and supports paint set workflows.",
    "place_in_page": "Vault batch action area",
    "coach_mark_target": "vault batch actions panel",
    "coach_mark_area": "The batch action toolbar or panel",
    "popup_placement": "top",
    "display_order": 580,
    "tags": [
      "vault",
      "batch",
      "paints"
    ]
  },
  {
    "uid": "vault.export_button",
    "feature_name": "Vault export",
    "feature_type": "export",
    "location_reference": "Vault > Export",
    "page_path": "/vault",
    "component_reference": "app/vault/vault-export-button.tsx",
    "explanation": "Exports paint data from the live vault for spreadsheets, backups, or external use.",
    "place_in_page": "Vault toolbar",
    "coach_mark_target": "vault export button",
    "coach_mark_area": "The vault export button and export dialog",
    "popup_placement": "top",
    "display_order": 590,
    "tags": [
      "vault",
      "export"
    ]
  },
  {
    "uid": "vault.paint_detail",
    "feature_name": "Paint detail page",
    "feature_type": "page",
    "location_reference": "Vault > Paint Detail",
    "page_path": "/vault/[source]/[id]",
    "component_reference": "app/vault/[source]/[id]/page.tsx",
    "explanation": "Shows one paint with technical specs, ownership state, conversion recommendations, and guides that use the paint.",
    "place_in_page": "Paint detail page",
    "coach_mark_target": "paint detail content",
    "coach_mark_area": "The whole paint detail viewport",
    "popup_placement": "auto",
    "display_order": 600,
    "tags": [
      "vault",
      "paint-detail"
    ]
  },
  {
    "uid": "vault.paint_ownership",
    "feature_name": "Paint ownership controls",
    "feature_type": "toggle",
    "location_reference": "Paint Detail > Ownership",
    "page_path": "/vault/[source]/[id]",
    "component_reference": "app/vault/[source]/[id]/paint-ownership-controls.tsx",
    "explanation": "Marks a paint as owned, not owned, wishlisted, or otherwise managed in the user collection.",
    "place_in_page": "Paint ownership card",
    "coach_mark_target": "paint ownership controls",
    "coach_mark_area": "The ownership buttons on a paint detail page",
    "popup_placement": "top",
    "display_order": 610,
    "tags": [
      "vault",
      "ownership",
      "paints"
    ]
  },
  {
    "uid": "vault.paint_conversions",
    "feature_name": "Paint conversion chart",
    "feature_type": "panel",
    "location_reference": "Paint Detail > Conversion Chart",
    "page_path": "/vault/[source]/[id]",
    "component_reference": "app/vault/[source]/[id]/paint-conversion-chart-grid.tsx",
    "explanation": "Lists recommended equivalent paints and similarity matches across brands and lines.",
    "place_in_page": "Paint detail conversion area",
    "coach_mark_target": "paint conversion chart",
    "coach_mark_area": "The conversion recommendation grid",
    "popup_placement": "top",
    "display_order": 620,
    "tags": [
      "vault",
      "conversions",
      "paints"
    ]
  },
  {
    "uid": "guides.page",
    "feature_name": "Guides",
    "feature_type": "page",
    "location_reference": "Guides",
    "page_path": "/guides",
    "component_reference": "app/guides/page.tsx",
    "explanation": "The guide hub for saved guides, reusable decks, and the public library of guides and decks.",
    "place_in_page": "Main guides page",
    "coach_mark_target": "main guides content",
    "coach_mark_area": "The whole guides viewport",
    "popup_placement": "auto",
    "display_order": 700,
    "tags": [
      "guides",
      "page"
    ]
  },
  {
    "uid": "guides.help",
    "feature_name": "Guides explainer",
    "feature_type": "button",
    "location_reference": "Guides header > ?",
    "page_path": "/guides",
    "component_reference": "app/guides/guides-v3-preview.tsx",
    "explanation": "Explains that guides are collections of decks, decks are step-card sequences, and the library is where public items can be found and saved.",
    "place_in_page": "Guides header",
    "coach_mark_target": "button aria-label About guides",
    "coach_mark_area": "The question mark button in the Guides header",
    "popup_placement": "bottom-end",
    "display_order": 710,
    "tags": [
      "guides",
      "help",
      "popup"
    ]
  },
  {
    "uid": "guides.create_button",
    "feature_name": "Create guide or deck",
    "feature_type": "button",
    "location_reference": "Guides header > +",
    "page_path": "/guides",
    "component_reference": "app/guides/guides-v3-preview.tsx",
    "explanation": "Opens the forge flow for creating either a full guide or a reusable step-card deck.",
    "place_in_page": "Guides header",
    "coach_mark_target": "button aria-label Create guide or deck",
    "coach_mark_area": "The plus button in the Guides header",
    "popup_placement": "bottom-end",
    "display_order": 720,
    "tags": [
      "guides",
      "create",
      "button"
    ]
  },
  {
    "uid": "guides.tabs.guides",
    "feature_name": "Guides tab",
    "feature_type": "tab",
    "location_reference": "Guides > Guide sections > Guides",
    "page_path": "/guides",
    "component_reference": "app/guides/guides-v3-preview.tsx",
    "explanation": "Shows complete guide files assembled from one or more decks.",
    "place_in_page": "Below Guides header",
    "coach_mark_target": "tab named Guides",
    "coach_mark_area": "The Guides segmented tab",
    "popup_placement": "bottom",
    "display_order": 730,
    "tags": [
      "guides",
      "tab"
    ]
  },
  {
    "uid": "guides.tabs.decks",
    "feature_name": "Decks tab",
    "feature_type": "tab",
    "location_reference": "Guides > Guide sections > Decks",
    "page_path": "/guides",
    "component_reference": "app/guides/guides-v3-preview.tsx",
    "explanation": "Shows reusable card sequences for a material, technique, recipe step, or result.",
    "place_in_page": "Below Guides header",
    "coach_mark_target": "tab named Decks",
    "coach_mark_area": "The Decks segmented tab",
    "popup_placement": "bottom",
    "display_order": 740,
    "tags": [
      "guides",
      "decks",
      "tab"
    ]
  },
  {
    "uid": "guides.tabs.library",
    "feature_name": "Library tab",
    "feature_type": "tab",
    "location_reference": "Guides > Guide sections > Library",
    "page_path": "/guides",
    "component_reference": "app/guides/guides-v3-preview.tsx",
    "explanation": "Shows public guides and decks that can be searched, inspected, and saved.",
    "place_in_page": "Below Guides header",
    "coach_mark_target": "tab named Library",
    "coach_mark_area": "The Library segmented tab",
    "popup_placement": "bottom",
    "display_order": 750,
    "tags": [
      "guides",
      "library",
      "tab"
    ]
  },
  {
    "uid": "guides.library_search",
    "feature_name": "Guide library search",
    "feature_type": "search",
    "location_reference": "Guides > Library > Search",
    "page_path": "/guides",
    "component_reference": "app/guides/guides-v3-preview.tsx",
    "explanation": "Searches public guide and deck entries by title, subtitle, and level.",
    "place_in_page": "Library tab",
    "coach_mark_target": "input placeholder Search guides and decks",
    "coach_mark_area": "The library search input",
    "popup_placement": "bottom",
    "display_order": 760,
    "tags": [
      "guides",
      "library",
      "search"
    ]
  },
  {
    "uid": "guides.deck_save",
    "feature_name": "Save deck",
    "feature_type": "toggle",
    "location_reference": "Guides > Library > Save Deck",
    "page_path": "/guides",
    "component_reference": "app/guides/guides-v3-preview.tsx",
    "explanation": "Saves or removes a public deck from the user library.",
    "place_in_page": "Deck card action area",
    "coach_mark_target": "button aria-label Save or Remove deck title",
    "coach_mark_area": "The save toggle on a deck card",
    "popup_placement": "left",
    "display_order": 770,
    "tags": [
      "guides",
      "decks",
      "save"
    ]
  },
  {
    "uid": "guides.forge.mode",
    "feature_name": "Guide forge mode",
    "feature_type": "toggle",
    "location_reference": "Guides > Create > Guide or Deck",
    "page_path": "/guides",
    "component_reference": "app/guides/guides-v3-preview.tsx",
    "explanation": "Chooses whether the forge creates a full guide assembled from decks or a standalone deck of cards.",
    "place_in_page": "Create guide/deck modal",
    "coach_mark_target": "forge mode selector",
    "coach_mark_area": "The Guide and Deck choice controls",
    "popup_placement": "bottom",
    "display_order": 780,
    "tags": [
      "guides",
      "create",
      "forge"
    ]
  },
  {
    "uid": "guides.forge.deck_picker",
    "feature_name": "Select guide decks",
    "feature_type": "workflow",
    "location_reference": "Guides > Create Guide > Select Decks",
    "page_path": "/guides",
    "component_reference": "app/guides/guides-v3-preview.tsx",
    "explanation": "Lets the user choose saved decks that will become the ordered contents of a new guide.",
    "place_in_page": "Create Guide flow",
    "coach_mark_target": "guide deck picker",
    "coach_mark_area": "The deck selection list in the forge",
    "popup_placement": "top",
    "display_order": 790,
    "tags": [
      "guides",
      "create",
      "decks"
    ]
  },
  {
    "uid": "guides.forge.compose",
    "feature_name": "Guide details",
    "feature_type": "form",
    "location_reference": "Guides > Create Guide > Guide Details",
    "page_path": "/guides",
    "component_reference": "app/guides/guides-v3-preview.tsx",
    "explanation": "Collects guide name, description, cover image, and final save details.",
    "place_in_page": "Create Guide flow",
    "coach_mark_target": "guide details form",
    "coach_mark_area": "The guide details form in the forge",
    "popup_placement": "top",
    "display_order": 800,
    "tags": [
      "guides",
      "create",
      "form"
    ]
  },
  {
    "uid": "recipes.page",
    "feature_name": "Guide library",
    "feature_type": "page",
    "location_reference": "Recipes",
    "page_path": "/recipes",
    "component_reference": "app/recipes/page.tsx",
    "explanation": "The live guide library for browsing public guides and managing the user's own step-by-step painting guides.",
    "place_in_page": "Main recipes/guides page",
    "coach_mark_target": "guide-library",
    "coach_mark_area": "The whole recipes guide library viewport",
    "popup_placement": "auto",
    "display_order": 810,
    "tags": [
      "recipes",
      "guides",
      "page"
    ]
  },
  {
    "uid": "recipes.create_form",
    "feature_name": "Create guide form",
    "feature_type": "form",
    "location_reference": "Guides > Create",
    "page_path": "/recipes?tab=custom",
    "component_reference": "app/recipes/create-recipe-form.tsx",
    "explanation": "Creates a new painting guide with name, description, visibility, and image context.",
    "place_in_page": "Create guide tab",
    "coach_mark_target": "form id create-guide-form",
    "coach_mark_area": "The create guide form",
    "popup_placement": "top",
    "display_order": 820,
    "tags": [
      "recipes",
      "guides",
      "create"
    ]
  },
  {
    "uid": "recipes.detail.page",
    "feature_name": "Guide detail",
    "feature_type": "page",
    "location_reference": "Guides > Guide Detail",
    "page_path": "/recipes/[id]",
    "component_reference": "app/recipes/[id]/page.tsx",
    "explanation": "Shows a saved guide with hero details, steps, paints, gallery images, inventory coverage, video, visibility, sharing, and export options.",
    "place_in_page": "Guide detail page",
    "coach_mark_target": "recipe detail content",
    "coach_mark_area": "The whole guide detail viewport",
    "popup_placement": "auto",
    "display_order": 830,
    "tags": [
      "recipes",
      "guides",
      "detail"
    ]
  },
  {
    "uid": "recipes.detail.tabs",
    "feature_name": "Guide detail tabs",
    "feature_type": "tab",
    "location_reference": "Guide Detail > Tabs",
    "page_path": "/recipes/[id]",
    "component_reference": "app/recipes/[id]/recipe-detail-tabs.tsx",
    "explanation": "Switches between guide details, steps, adding a step, gallery images, inventory, and video/card export areas.",
    "place_in_page": "Below guide hero",
    "coach_mark_target": "recipe detail tabs",
    "coach_mark_area": "The guide detail tab row",
    "popup_placement": "bottom",
    "display_order": 840,
    "tags": [
      "recipes",
      "guides",
      "tabs"
    ]
  },
  {
    "uid": "recipes.add_step",
    "feature_name": "Add guide step",
    "feature_type": "form",
    "location_reference": "Guide Detail > Add Step",
    "page_path": "/recipes/[id]",
    "component_reference": "app/recipes/[id]/recipe-add-step-tab.tsx",
    "explanation": "Adds an ordered painting step with instructions, paints, quantities, and optional stage context.",
    "place_in_page": "Guide add step tab",
    "coach_mark_target": "recipe add step form",
    "coach_mark_area": "The add guide step form",
    "popup_placement": "top",
    "display_order": 850,
    "tags": [
      "recipes",
      "guides",
      "steps"
    ]
  },
  {
    "uid": "recipes.step_card",
    "feature_name": "Guide step card",
    "feature_type": "card",
    "location_reference": "Guide Detail > Steps > Step Card",
    "page_path": "/recipes/[id]",
    "component_reference": "app/recipes/[id]/components/recipe-step-card.tsx",
    "explanation": "Displays one guide step with instructions, linked paints, photo controls, and edit or remove actions.",
    "place_in_page": "Guide steps tab",
    "coach_mark_target": "recipe step card",
    "coach_mark_area": "A single guide step card",
    "popup_placement": "top",
    "display_order": 860,
    "tags": [
      "recipes",
      "guides",
      "steps"
    ]
  },
  {
    "uid": "recipes.paint_picker",
    "feature_name": "Guide paint picker",
    "feature_type": "modal",
    "location_reference": "Guide Detail > Add Paint",
    "page_path": "/recipes/[id]",
    "component_reference": "app/recipes/[id]/components/paint-picker.tsx",
    "explanation": "Searches and selects paints to attach to a guide step, including custom paints where available.",
    "place_in_page": "Guide step paint controls",
    "coach_mark_target": "recipe paint picker",
    "coach_mark_area": "The paint picker button and dialog",
    "popup_placement": "top",
    "display_order": 870,
    "tags": [
      "recipes",
      "guides",
      "paints"
    ]
  },
  {
    "uid": "recipes.visibility",
    "feature_name": "Guide visibility",
    "feature_type": "toggle",
    "location_reference": "Guide Detail > Visibility",
    "page_path": "/recipes/[id]",
    "component_reference": "app/recipes/[id]/components/recipe-visibility-pill.tsx",
    "explanation": "Switches a guide between private and public visibility with confirmation.",
    "place_in_page": "Guide hero area",
    "coach_mark_target": "recipe visibility pill",
    "coach_mark_area": "The public/private visibility pill",
    "popup_placement": "bottom",
    "display_order": 880,
    "tags": [
      "recipes",
      "guides",
      "visibility"
    ]
  },
  {
    "uid": "recipes.gallery",
    "feature_name": "Guide gallery",
    "feature_type": "panel",
    "location_reference": "Guide Detail > Gallery",
    "page_path": "/recipes/[id]",
    "component_reference": "app/recipes/[id]/components/recipe-gallery-section.tsx",
    "explanation": "Uploads, captions, expands, reorders, and removes images attached to a guide.",
    "place_in_page": "Guide gallery tab",
    "coach_mark_target": "recipe gallery section",
    "coach_mark_area": "The guide gallery image panel",
    "popup_placement": "top",
    "display_order": 890,
    "tags": [
      "recipes",
      "guides",
      "gallery"
    ]
  },
  {
    "uid": "recipes.guide_cards",
    "feature_name": "Guide cards export",
    "feature_type": "modal",
    "location_reference": "Guide Detail > Guide Cards",
    "page_path": "/recipes/[id]",
    "component_reference": "app/recipes/[id]/recipe-guide-dialog.tsx",
    "explanation": "Renders guide steps as shareable card images and supports exporting, zipping, PDF generation, and share copy.",
    "place_in_page": "Guide card modal",
    "coach_mark_target": "recipe guide dialog",
    "coach_mark_area": "The guide card preview and action panel",
    "popup_placement": "auto",
    "display_order": 900,
    "tags": [
      "recipes",
      "guides",
      "export",
      "share"
    ]
  },
  {
    "uid": "themes.page",
    "feature_name": "Themes",
    "feature_type": "page",
    "location_reference": "Themes",
    "page_path": "/themes",
    "component_reference": "app/themes/page.tsx",
    "explanation": "The theme hub for color palettes, reference images, and visual systems connected to projects, units, guides, and paints.",
    "place_in_page": "Main themes page",
    "coach_mark_target": "main themes content",
    "coach_mark_area": "The whole themes viewport",
    "popup_placement": "auto",
    "display_order": 1000,
    "tags": [
      "themes",
      "page"
    ]
  },
  {
    "uid": "themes.help",
    "feature_name": "Themes explainer",
    "feature_type": "button",
    "location_reference": "Themes header > ?",
    "page_path": "/themes",
    "component_reference": "app/themes/themes-v3-preview.tsx",
    "explanation": "Explains that themes collect palettes, references, paints, units, projects, and guides under one visual direction.",
    "place_in_page": "Themes header",
    "coach_mark_target": "button aria-label About themes",
    "coach_mark_area": "The question mark button in the Themes header",
    "popup_placement": "bottom-end",
    "display_order": 1010,
    "tags": [
      "themes",
      "help",
      "popup"
    ]
  },
  {
    "uid": "themes.create_button",
    "feature_name": "Create theme",
    "feature_type": "button",
    "location_reference": "Themes header > +",
    "page_path": "/themes",
    "component_reference": "app/themes/themes-v3-preview.tsx",
    "explanation": "Opens the theme creation panel so the user can start a new visual direction with palette and reference details.",
    "place_in_page": "Themes header",
    "coach_mark_target": "button aria-label Create theme",
    "coach_mark_area": "The plus button in the Themes header",
    "popup_placement": "bottom-end",
    "display_order": 1020,
    "tags": [
      "themes",
      "create",
      "button"
    ]
  },
  {
    "uid": "themes.tabs.mine",
    "feature_name": "My Themes tab",
    "feature_type": "tab",
    "location_reference": "Themes > Theme views > My Themes",
    "page_path": "/themes",
    "component_reference": "app/themes/themes-v3-preview.tsx",
    "explanation": "Shows the user's saved private and public theme collections.",
    "place_in_page": "Below Themes header",
    "coach_mark_target": "tab named My Themes",
    "coach_mark_area": "The My Themes segmented tab",
    "popup_placement": "bottom",
    "display_order": 1030,
    "tags": [
      "themes",
      "tab"
    ]
  },
  {
    "uid": "themes.tabs.library",
    "feature_name": "Theme Library tab",
    "feature_type": "tab",
    "location_reference": "Themes > Theme views > Theme Library",
    "page_path": "/themes",
    "component_reference": "app/themes/themes-v3-preview.tsx",
    "explanation": "Shows shared or public themes that can inspire palettes and project color directions.",
    "place_in_page": "Below Themes header",
    "coach_mark_target": "tab named Theme Library",
    "coach_mark_area": "The Theme Library segmented tab",
    "popup_placement": "bottom",
    "display_order": 1040,
    "tags": [
      "themes",
      "library",
      "tab"
    ]
  },
  {
    "uid": "themes.form",
    "feature_name": "Theme form",
    "feature_type": "form",
    "location_reference": "Themes > Create Theme",
    "page_path": "/themes",
    "component_reference": "app/themes/theme-form.tsx",
    "explanation": "Creates or edits a theme with name, description, palette, visibility, and optional image context.",
    "place_in_page": "Theme create or edit panel",
    "coach_mark_target": "theme form",
    "coach_mark_area": "The theme form fields and save button",
    "popup_placement": "top",
    "display_order": 1050,
    "tags": [
      "themes",
      "create",
      "form"
    ]
  },
  {
    "uid": "themes.detail.page",
    "feature_name": "Theme detail",
    "feature_type": "page",
    "location_reference": "Themes > Theme Detail",
    "page_path": "/themes/[id]",
    "component_reference": "app/themes/[id]/page.tsx",
    "explanation": "Shows one theme with hero image, palette editor, assignment controls, reference gallery, and public/private status.",
    "place_in_page": "Theme detail page",
    "coach_mark_target": "theme detail content",
    "coach_mark_area": "The whole theme detail viewport",
    "popup_placement": "auto",
    "display_order": 1060,
    "tags": [
      "themes",
      "detail"
    ]
  },
  {
    "uid": "themes.palette_editor",
    "feature_name": "Theme palette editor",
    "feature_type": "panel",
    "location_reference": "Theme Detail > Palette",
    "page_path": "/themes/[id]",
    "component_reference": "app/themes/[id]/theme-palette-editor.tsx",
    "explanation": "Adds, edits, removes, and organizes colors in a theme palette.",
    "place_in_page": "Theme detail palette area",
    "coach_mark_target": "theme palette editor",
    "coach_mark_area": "The theme palette editor panel",
    "popup_placement": "top",
    "display_order": 1070,
    "tags": [
      "themes",
      "palette"
    ]
  },
  {
    "uid": "themes.assignment_panel",
    "feature_name": "Theme assignment panel",
    "feature_type": "panel",
    "location_reference": "Theme Detail > Assignments",
    "page_path": "/themes/[id]",
    "component_reference": "app/themes/[id]/theme-assignment-panel.tsx",
    "explanation": "Connects the theme to projects, units, and guides so related hobby work shares a visual direction.",
    "place_in_page": "Theme assignment area",
    "coach_mark_target": "theme assignment panel",
    "coach_mark_area": "The assignment controls on a theme detail page",
    "popup_placement": "top",
    "display_order": 1080,
    "tags": [
      "themes",
      "assignments"
    ]
  },
  {
    "uid": "themes.image_gallery",
    "feature_name": "Theme image gallery",
    "feature_type": "panel",
    "location_reference": "Theme Detail > Gallery",
    "page_path": "/themes/[id]",
    "component_reference": "app/themes/[id]/theme-image-gallery.tsx",
    "explanation": "Uploads, captions, expands, matches colors from, and removes reference images for a theme.",
    "place_in_page": "Theme detail gallery area",
    "coach_mark_target": "theme image gallery",
    "coach_mark_area": "The theme image gallery panel",
    "popup_placement": "top",
    "display_order": 1090,
    "tags": [
      "themes",
      "gallery",
      "images"
    ]
  },
  {
    "uid": "themes.image_color_match",
    "feature_name": "Match paint from theme image",
    "feature_type": "button",
    "location_reference": "Theme Detail > Image > Match Paint",
    "page_path": "/themes/[id]",
    "component_reference": "app/themes/[id]/theme-detail-hero.tsx",
    "explanation": "Samples or routes a theme image color into paint matching so the user can find nearby paints.",
    "place_in_page": "Theme image controls",
    "coach_mark_target": "button aria-label Match Paint from theme image",
    "coach_mark_area": "The Match Paint button on a theme image",
    "popup_placement": "top",
    "display_order": 1100,
    "tags": [
      "themes",
      "images",
      "paints",
      "color-match"
    ]
  },
  {
    "uid": "units.new.page",
    "feature_name": "New unit",
    "feature_type": "page",
    "location_reference": "Units > New Unit",
    "page_path": "/units/new",
    "component_reference": "app/units/new/page.tsx",
    "explanation": "Creates a trackable model, squad, unit, or hobby item with status, project, images, and optional theme context.",
    "place_in_page": "New unit page",
    "coach_mark_target": "new unit page content",
    "coach_mark_area": "The whole new unit form viewport",
    "popup_placement": "auto",
    "display_order": 1200,
    "tags": [
      "units",
      "create",
      "page"
    ]
  },
  {
    "uid": "units.new.form",
    "feature_name": "New unit form",
    "feature_type": "form",
    "location_reference": "Units > New Unit > Form",
    "page_path": "/units/new",
    "component_reference": "app/units/new/new-unit-form.tsx",
    "explanation": "Captures the unit name, description, project links, status, image, and starter metadata needed to add a model to the bench.",
    "place_in_page": "New unit page form",
    "coach_mark_target": "new-unit-form",
    "coach_mark_area": "The new unit form fields and submit button",
    "popup_placement": "top",
    "display_order": 1210,
    "tags": [
      "units",
      "create",
      "form"
    ]
  },
  {
    "uid": "units.detail.page",
    "feature_name": "Unit detail",
    "feature_type": "page",
    "location_reference": "Units > Unit Detail",
    "page_path": "/units/[id]",
    "component_reference": "app/units/[id]/page.tsx",
    "explanation": "Shows one unit with hero details, stages, paints, gallery, session tracking, scheduling, sharing, and project/theme context.",
    "place_in_page": "Unit detail page",
    "coach_mark_target": "unit detail content",
    "coach_mark_area": "The whole unit detail viewport",
    "popup_placement": "auto",
    "display_order": 1220,
    "tags": [
      "units",
      "detail"
    ]
  },
  {
    "uid": "units.detail.tabs",
    "feature_name": "Unit sections",
    "feature_type": "tab",
    "location_reference": "Unit Detail > Sections",
    "page_path": "/units/[id]",
    "component_reference": "app/units/[id]/unit-detail-client.tsx",
    "explanation": "Switches between the unit overview, paint progress, gallery, sessions, and scheduling views.",
    "place_in_page": "Below unit hero",
    "coach_mark_target": "unit section tabs",
    "coach_mark_area": "The unit section segmented tab row",
    "popup_placement": "bottom",
    "display_order": 1230,
    "tags": [
      "units",
      "tabs"
    ]
  },
  {
    "uid": "units.progress.stage_selector",
    "feature_name": "Stage selector",
    "feature_type": "tab",
    "location_reference": "Unit Detail > Progress > Stage selector",
    "page_path": "/units/[id]",
    "component_reference": "app/units/[id]/unit-progress-tab.tsx",
    "explanation": "Selects a painting stage so the user can track its guide, paints, photos, notes, and completion status.",
    "place_in_page": "Unit progress tab",
    "coach_mark_target": "stage selector",
    "coach_mark_area": "The stage selection buttons",
    "popup_placement": "bottom",
    "display_order": 1240,
    "tags": [
      "units",
      "progress",
      "stages"
    ]
  },
  {
    "uid": "units.progress.stage_complete",
    "feature_name": "Stage complete toggle",
    "feature_type": "toggle",
    "location_reference": "Unit Detail > Progress > Toggle completion",
    "page_path": "/units/[id]",
    "component_reference": "app/units/[id]/unit-progress-tab.tsx",
    "explanation": "Marks the selected stage complete or incomplete and contributes to the unit progress meter.",
    "place_in_page": "Unit progress selected stage",
    "coach_mark_target": "button aria-label Toggle stage completion",
    "coach_mark_area": "The selected stage completion button",
    "popup_placement": "left",
    "display_order": 1250,
    "tags": [
      "units",
      "progress",
      "toggle"
    ]
  },
  {
    "uid": "units.progress.stage_paints",
    "feature_name": "Stage paints",
    "feature_type": "panel",
    "location_reference": "Unit Detail > Progress > Paints",
    "page_path": "/units/[id]",
    "component_reference": "app/units/[id]/unit-progress-tab.tsx",
    "explanation": "Shows paints linked to a unit stage and supports opening paint details or removing paints from that stage.",
    "place_in_page": "Unit progress selected stage",
    "coach_mark_target": "stage paint list",
    "coach_mark_area": "The stage paints list",
    "popup_placement": "top",
    "display_order": 1260,
    "tags": [
      "units",
      "progress",
      "paints"
    ]
  },
  {
    "uid": "units.progress.stage_photo",
    "feature_name": "Stage photo",
    "feature_type": "button",
    "location_reference": "Unit Detail > Progress > Photo",
    "page_path": "/units/[id]",
    "component_reference": "app/units/[id]/unit-progress-tab.tsx",
    "explanation": "Expands a stage photo so the user can inspect progress images at a larger size.",
    "place_in_page": "Unit progress selected stage",
    "coach_mark_target": "button aria-label Expand stage photo",
    "coach_mark_area": "A stage photo expand button",
    "popup_placement": "top",
    "display_order": 1270,
    "tags": [
      "units",
      "progress",
      "images"
    ]
  },
  {
    "uid": "units.gallery",
    "feature_name": "Unit gallery",
    "feature_type": "panel",
    "location_reference": "Unit Detail > Gallery",
    "page_path": "/units/[id]",
    "component_reference": "app/units/[id]/components/unit-gallery-section.tsx",
    "explanation": "Uploads, captions, expands, selects, and removes unit images for progress and showcase tracking.",
    "place_in_page": "Unit gallery tab",
    "coach_mark_target": "unit gallery section",
    "coach_mark_area": "The unit gallery image panel",
    "popup_placement": "top",
    "display_order": 1280,
    "tags": [
      "units",
      "gallery",
      "images"
    ]
  },
  {
    "uid": "units.session_tracker",
    "feature_name": "Session tracker",
    "feature_type": "panel",
    "location_reference": "Unit Detail > Sessions > Timer",
    "page_path": "/units/[id]",
    "component_reference": "app/units/[id]/components/unit-session-tracker.tsx",
    "explanation": "Starts, pauses, resumes, finishes, edits, deletes, and manually logs painting sessions for a unit.",
    "place_in_page": "Unit sessions tab",
    "coach_mark_target": "unit session tracker",
    "coach_mark_area": "The session timer and manual log controls",
    "popup_placement": "top",
    "display_order": 1290,
    "tags": [
      "units",
      "sessions",
      "timer"
    ]
  },
  {
    "uid": "units.session_manual_log",
    "feature_name": "Log session manually",
    "feature_type": "button",
    "location_reference": "Unit Detail > Sessions > Log manually",
    "page_path": "/units/[id]",
    "component_reference": "app/units/[id]/components/unit-session-tracker.tsx",
    "explanation": "Opens manual session logging for backfilling painting time with notes and start/end details.",
    "place_in_page": "Unit sessions tab",
    "coach_mark_target": "button aria-label Log session manually",
    "coach_mark_area": "The Log session manually button",
    "popup_placement": "top",
    "display_order": 1300,
    "tags": [
      "units",
      "sessions",
      "manual-log"
    ]
  },
  {
    "uid": "units.session_scheduler",
    "feature_name": "Session scheduler",
    "feature_type": "panel",
    "location_reference": "Unit Detail > Schedule",
    "page_path": "/units/[id]",
    "component_reference": "app/units/[id]/components/unit-session-scheduler.tsx",
    "explanation": "Schedules planned painting sessions on a calendar and tracks whether scheduled work was completed.",
    "place_in_page": "Unit schedule tab",
    "coach_mark_target": "unit session scheduler",
    "coach_mark_area": "The session scheduler calendar and form",
    "popup_placement": "top",
    "display_order": 1310,
    "tags": [
      "units",
      "sessions",
      "schedule"
    ]
  },
  {
    "uid": "units.share_completed",
    "feature_name": "Share completed unit",
    "feature_type": "modal",
    "location_reference": "Unit Detail > Share",
    "page_path": "/units/[id]",
    "component_reference": "components/share/UnitCompletedShareModal.tsx",
    "explanation": "Builds a shareable completed-unit card, chooses an image, previews it, and exports or shares the result.",
    "place_in_page": "Unit completion/share flow",
    "coach_mark_target": "unit completed share modal",
    "coach_mark_area": "The completed unit share dialog",
    "popup_placement": "auto",
    "display_order": 1320,
    "tags": [
      "units",
      "share",
      "export"
    ]
  },
  {
    "uid": "contests.page",
    "feature_name": "Contests",
    "feature_type": "page",
    "location_reference": "Contests",
    "page_path": "/contests",
    "component_reference": "app/contests/page.tsx",
    "explanation": "Lists public and available contests where users can nominate work, vote, and view results based on contest phase.",
    "place_in_page": "Main contests page",
    "coach_mark_target": "contest list content",
    "coach_mark_area": "The whole contests viewport",
    "popup_placement": "auto",
    "display_order": 1400,
    "tags": [
      "contests",
      "page"
    ]
  },
  {
    "uid": "contests.card",
    "feature_name": "Contest card",
    "feature_type": "card",
    "location_reference": "Contests > Contest card",
    "page_path": "/contests",
    "component_reference": "components/contests/contest-card.tsx",
    "explanation": "Summarizes contest title, phase, schedule, allowed nominee types, and route to submit, vote, or view details.",
    "place_in_page": "Contest list",
    "coach_mark_target": "contest card",
    "coach_mark_area": "A single contest card",
    "popup_placement": "top",
    "display_order": 1410,
    "tags": [
      "contests",
      "card"
    ]
  },
  {
    "uid": "contests.detail",
    "feature_name": "Contest detail",
    "feature_type": "page",
    "location_reference": "Contests > Contest Detail",
    "page_path": "/contests/[slug]",
    "component_reference": "app/contests/[slug]/page.tsx",
    "explanation": "Shows contest overview, allowed submission types, schedule, current phase, nominees, and contest actions.",
    "place_in_page": "Contest detail page",
    "coach_mark_target": "contest detail content",
    "coach_mark_area": "The whole contest detail viewport",
    "popup_placement": "auto",
    "display_order": 1420,
    "tags": [
      "contests",
      "detail"
    ]
  },
  {
    "uid": "contests.submit",
    "feature_name": "Submit nomination",
    "feature_type": "form",
    "location_reference": "Contest Detail > Submit",
    "page_path": "/contests/[slug]/submit",
    "component_reference": "app/contests/[slug]/submit/page.tsx",
    "explanation": "Lets the user nominate an eligible project, unit, or guide into a contest.",
    "place_in_page": "Contest submission page",
    "coach_mark_target": "nomination source picker",
    "coach_mark_area": "The contest nomination form and source picker",
    "popup_placement": "top",
    "display_order": 1430,
    "tags": [
      "contests",
      "submit",
      "nomination"
    ]
  },
  {
    "uid": "contests.vote",
    "feature_name": "Vote in contest",
    "feature_type": "form",
    "location_reference": "Contest Detail > Vote",
    "page_path": "/contests/[slug]/vote",
    "component_reference": "app/contests/[slug]/vote/page.tsx",
    "explanation": "Presents approved nominees and records the user ballot using approval or ranked voting rules.",
    "place_in_page": "Contest voting page",
    "coach_mark_target": "contest ballot",
    "coach_mark_area": "The contest ballot controls",
    "popup_placement": "top",
    "display_order": 1440,
    "tags": [
      "contests",
      "vote",
      "ballot"
    ]
  },
  {
    "uid": "contests.results",
    "feature_name": "Contest results",
    "feature_type": "page",
    "location_reference": "Contest Detail > Results",
    "page_path": "/contests/[slug]/results",
    "component_reference": "app/contests/[slug]/results/page.tsx",
    "explanation": "Shows published contest results, podium, rankings, vote totals, and tied placements.",
    "place_in_page": "Contest results page",
    "coach_mark_target": "contest results table",
    "coach_mark_area": "The contest results podium and table",
    "popup_placement": "auto",
    "display_order": 1450,
    "tags": [
      "contests",
      "results"
    ]
  },
  {
    "uid": "contests.manage",
    "feature_name": "Manage contests",
    "feature_type": "page",
    "location_reference": "Contests > Manage",
    "page_path": "/contests/manage",
    "component_reference": "app/contests/manage/page.tsx",
    "explanation": "Administrative area for creating, editing, previewing, moderating, and publishing contest configuration.",
    "place_in_page": "Contest management page",
    "coach_mark_target": "contest management content",
    "coach_mark_area": "The whole contest management viewport",
    "popup_placement": "auto",
    "display_order": 1460,
    "tags": [
      "contests",
      "admin"
    ]
  },
  {
    "uid": "contests.manage.form",
    "feature_name": "Contest admin form",
    "feature_type": "form",
    "location_reference": "Contests > Manage > Form",
    "page_path": "/contests/manage/[id]",
    "component_reference": "components/contests/contest-admin-form.tsx",
    "explanation": "Configures contest title, schedule, visibility, allowed nominee types, voting method, voter access, and moderation settings.",
    "place_in_page": "Contest admin edit page",
    "coach_mark_target": "contest admin form",
    "coach_mark_area": "The contest admin form controls",
    "popup_placement": "top",
    "display_order": 1470,
    "tags": [
      "contests",
      "admin",
      "form"
    ]
  },
  {
    "uid": "contests.dice_roll",
    "feature_name": "Campaign dice roll",
    "feature_type": "form",
    "location_reference": "Contests > Dice Roll",
    "page_path": "/contests/dice-roll",
    "component_reference": "app/contests/dice-roll/dice-roll-form.tsx",
    "explanation": "Records campaign dice rolls with reason, visibility, and audit context.",
    "place_in_page": "Campaign dice roll page",
    "coach_mark_target": "dice roll form",
    "coach_mark_area": "The campaign dice roll form",
    "popup_placement": "top",
    "display_order": 1480,
    "tags": [
      "contests",
      "campaign",
      "dice"
    ]
  },
  {
    "uid": "onboarding.page",
    "feature_name": "Onboarding",
    "feature_type": "workflow",
    "location_reference": "Onboarding",
    "page_path": "/onboarding",
    "component_reference": "app/onboarding/page.tsx",
    "explanation": "Guides new users through legal acceptance, goals, pain points, workflow preference, first project or guide creation, and the Curator handoff.",
    "place_in_page": "Onboarding flow",
    "coach_mark_target": "onboarding shell",
    "coach_mark_area": "The full onboarding screen",
    "popup_placement": "auto",
    "display_order": 1500,
    "tags": [
      "onboarding",
      "workflow"
    ]
  },
  {
    "uid": "onboarding.legal",
    "feature_name": "Legal acceptance",
    "feature_type": "form",
    "location_reference": "Onboarding > Legal",
    "page_path": "/onboarding",
    "component_reference": "app/onboarding/components/screens/legal-screen.tsx",
    "explanation": "Collects terms and privacy acknowledgement before continuing into account setup.",
    "place_in_page": "First onboarding step",
    "coach_mark_target": "legal screen",
    "coach_mark_area": "The legal acknowledgement controls",
    "popup_placement": "top",
    "display_order": 1510,
    "tags": [
      "onboarding",
      "legal"
    ]
  },
  {
    "uid": "onboarding.goal",
    "feature_name": "Goal selection",
    "feature_type": "form",
    "location_reference": "Onboarding > Goal",
    "page_path": "/onboarding",
    "component_reference": "app/onboarding/components/screens/goal-screen.tsx",
    "explanation": "Asks what would help most right now and chooses the onboarding action flow that appears on the dashboard.",
    "place_in_page": "Goal onboarding step",
    "coach_mark_target": "goal screen",
    "coach_mark_area": "The goal option cards",
    "popup_placement": "top",
    "display_order": 1520,
    "tags": [
      "onboarding",
      "goal",
      "next-actions"
    ]
  },
  {
    "uid": "onboarding.problem",
    "feature_name": "Problem selection",
    "feature_type": "form",
    "location_reference": "Onboarding > Problems",
    "page_path": "/onboarding",
    "component_reference": "app/onboarding/components/screens/problem-screen.tsx",
    "explanation": "Lets the user identify pain points so onboarding language and recommendations can match their needs.",
    "place_in_page": "Problem onboarding step",
    "coach_mark_target": "problem screen",
    "coach_mark_area": "The problem option buttons",
    "popup_placement": "top",
    "display_order": 1530,
    "tags": [
      "onboarding",
      "personalization"
    ]
  },
  {
    "uid": "onboarding.workflow",
    "feature_name": "Workflow preview",
    "feature_type": "workflow",
    "location_reference": "Onboarding > Workflow",
    "page_path": "/onboarding",
    "component_reference": "app/onboarding/components/screens/workflow-screen.tsx",
    "explanation": "Shows how the app connects projects, units, paints, guides, themes, and sessions into one workflow.",
    "place_in_page": "Workflow onboarding step",
    "coach_mark_target": "workflow screen",
    "coach_mark_area": "The workflow carousel and navigation controls",
    "popup_placement": "top",
    "display_order": 1540,
    "tags": [
      "onboarding",
      "workflow"
    ]
  },
  {
    "uid": "onboarding.first_project",
    "feature_name": "First project setup",
    "feature_type": "form",
    "location_reference": "Onboarding > First Project",
    "page_path": "/onboarding",
    "component_reference": "app/onboarding/components/screens/first-project-screen.tsx",
    "explanation": "Creates an optional starter project or first unit context to make the dashboard immediately useful.",
    "place_in_page": "First project onboarding step",
    "coach_mark_target": "first project screen",
    "coach_mark_area": "The first project setup form",
    "popup_placement": "top",
    "display_order": 1550,
    "tags": [
      "onboarding",
      "projects",
      "units"
    ]
  },
  {
    "uid": "onboarding.guide_creation",
    "feature_name": "First guide setup",
    "feature_type": "form",
    "location_reference": "Onboarding > Guide Creation",
    "page_path": "/onboarding",
    "component_reference": "app/onboarding/components/screens/guide-creation-screen.tsx",
    "explanation": "Creates an optional starter guide so content-focused users begin with a saved guide draft.",
    "place_in_page": "Guide onboarding step",
    "coach_mark_target": "guide creation screen",
    "coach_mark_area": "The first guide setup form",
    "popup_placement": "top",
    "display_order": 1560,
    "tags": [
      "onboarding",
      "guides"
    ]
  },
  {
    "uid": "login.page",
    "feature_name": "Login",
    "feature_type": "page",
    "location_reference": "Login",
    "page_path": "/login",
    "component_reference": "app/login/page.tsx",
    "explanation": "Handles sign in, account creation, passwordless or credential entry, and Google authentication.",
    "place_in_page": "Login page",
    "coach_mark_target": "login experience",
    "coach_mark_area": "The whole login viewport",
    "popup_placement": "auto",
    "display_order": 1600,
    "tags": [
      "auth",
      "login"
    ]
  },
  {
    "uid": "login.google",
    "feature_name": "Google login",
    "feature_type": "button",
    "location_reference": "Login > Continue with Google",
    "page_path": "/login",
    "component_reference": "app/login/google-login-button.tsx",
    "explanation": "Starts Google OAuth sign-in and then returns the user to the app.",
    "place_in_page": "Login form",
    "coach_mark_target": "google login button",
    "coach_mark_area": "The Continue with Google button",
    "popup_placement": "top",
    "display_order": 1610,
    "tags": [
      "auth",
      "login",
      "google"
    ]
  },
  {
    "uid": "settings.page",
    "feature_name": "Settings",
    "feature_type": "page",
    "location_reference": "Settings",
    "page_path": "/settings",
    "component_reference": "app/settings/page.tsx",
    "explanation": "Manages profile, avatar, display preferences, support routes, account actions, session controls, and legal links.",
    "place_in_page": "Settings page",
    "coach_mark_target": "settings page content",
    "coach_mark_area": "The whole settings viewport",
    "popup_placement": "auto",
    "display_order": 1700,
    "tags": [
      "settings",
      "page"
    ]
  },
  {
    "uid": "settings.profile",
    "feature_name": "Profile editor",
    "feature_type": "form",
    "location_reference": "Settings > Profile",
    "page_path": "/settings",
    "component_reference": "app/settings/settings-profile-editor.tsx",
    "explanation": "Updates public profile fields such as display name, avatar, and profile details used around the app.",
    "place_in_page": "Settings profile section",
    "coach_mark_target": "settings profile editor",
    "coach_mark_area": "The profile editor fields",
    "popup_placement": "top",
    "display_order": 1710,
    "tags": [
      "settings",
      "profile"
    ]
  },
  {
    "uid": "settings.preferences",
    "feature_name": "Preferences",
    "feature_type": "setting",
    "location_reference": "Settings > Preferences",
    "page_path": "/settings",
    "component_reference": "app/settings/settings-preferences-section.tsx",
    "explanation": "Stores user-level app preferences and display choices.",
    "place_in_page": "Settings preferences section",
    "coach_mark_target": "settings preferences section",
    "coach_mark_area": "The preferences controls",
    "popup_placement": "top",
    "display_order": 1720,
    "tags": [
      "settings",
      "preferences"
    ]
  },
  {
    "uid": "settings.session",
    "feature_name": "Session controls",
    "feature_type": "setting",
    "location_reference": "Settings > Session",
    "page_path": "/settings",
    "component_reference": "app/settings/settings-session-section.tsx",
    "explanation": "Shows sign-in/session status and provides sign out or session-related controls.",
    "place_in_page": "Settings session section",
    "coach_mark_target": "settings session section",
    "coach_mark_area": "The session control buttons",
    "popup_placement": "top",
    "display_order": 1730,
    "tags": [
      "settings",
      "session",
      "auth"
    ]
  },
  {
    "uid": "settings.account",
    "feature_name": "Account controls",
    "feature_type": "setting",
    "location_reference": "Settings > Account",
    "page_path": "/settings",
    "component_reference": "app/settings/settings-account-section.tsx",
    "explanation": "Contains account-level actions and destructive controls that affect the user account.",
    "place_in_page": "Settings account section",
    "coach_mark_target": "settings account section",
    "coach_mark_area": "The account control buttons",
    "popup_placement": "top",
    "display_order": 1740,
    "tags": [
      "settings",
      "account"
    ]
  },
  {
    "uid": "support.page",
    "feature_name": "Support",
    "feature_type": "page",
    "location_reference": "Support",
    "page_path": "/support",
    "component_reference": "app/support/page.tsx",
    "explanation": "Explains ways to support Obsidian Gallery and provides feedback or help routes.",
    "place_in_page": "Support page",
    "coach_mark_target": "support page content",
    "coach_mark_area": "The whole support viewport",
    "popup_placement": "auto",
    "display_order": 1800,
    "tags": [
      "support",
      "page"
    ]
  },
  {
    "uid": "support.feedback",
    "feature_name": "Feedback card",
    "feature_type": "form",
    "location_reference": "Support > Feedback",
    "page_path": "/support",
    "component_reference": "app/support/feedback-card.tsx",
    "explanation": "Lets the user send feedback, bugs, or help requests from inside the app.",
    "place_in_page": "Support page feedback area",
    "coach_mark_target": "feedback card",
    "coach_mark_area": "The feedback form/card",
    "popup_placement": "top",
    "display_order": 1810,
    "tags": [
      "support",
      "feedback"
    ]
  },
  {
    "uid": "social.like",
    "feature_name": "Like content",
    "feature_type": "toggle",
    "location_reference": "Content action row > Like",
    "page_path": "/recipes/[id]",
    "component_reference": "app/components/social/content-action-row.tsx",
    "explanation": "Likes or unlikes shared content such as guides, units, themes, or other social surfaces.",
    "place_in_page": "Public content action row",
    "coach_mark_target": "button aria-label Like content type",
    "coach_mark_area": "The like button in a content action row",
    "popup_placement": "top",
    "display_order": 1900,
    "tags": [
      "social",
      "like"
    ]
  },
  {
    "uid": "social.save",
    "feature_name": "Save content",
    "feature_type": "toggle",
    "location_reference": "Content action row > Save",
    "page_path": "/recipes/[id]",
    "component_reference": "app/components/social/content-action-row.tsx",
    "explanation": "Saves or unsaves shared content for later use or reference.",
    "place_in_page": "Public content action row",
    "coach_mark_target": "button aria-label Save content type",
    "coach_mark_area": "The save button in a content action row",
    "popup_placement": "top",
    "display_order": 1910,
    "tags": [
      "social",
      "save"
    ]
  },
  {
    "uid": "social.report",
    "feature_name": "Report content",
    "feature_type": "modal",
    "location_reference": "Content action row > Report",
    "page_path": "/recipes/[id]",
    "component_reference": "app/components/social/report-dialog.tsx",
    "explanation": "Opens a report dialog so the user can flag content that needs review.",
    "place_in_page": "Public content action row",
    "coach_mark_target": "report dialog",
    "coach_mark_area": "The report button and report dialog",
    "popup_placement": "top",
    "display_order": 1920,
    "tags": [
      "social",
      "report",
      "moderation"
    ]
  },
  {
    "uid": "images.color_sampler",
    "feature_name": "Image color sampler",
    "feature_type": "modal",
    "location_reference": "Image controls > Sample color",
    "page_path": "/themes/[id]",
    "component_reference": "components/color-sampler/ColorSamplerDialog.tsx",
    "explanation": "Lets the user sample a color from an uploaded image and use that color for matching paints or palette work.",
    "place_in_page": "Image interaction modal",
    "coach_mark_target": "color sampler dialog",
    "coach_mark_area": "The image sampling canvas and toolbar",
    "popup_placement": "auto",
    "display_order": 1930,
    "tags": [
      "images",
      "color-sampler",
      "paints"
    ]
  },
  {
    "uid": "images.zoomable_gallery",
    "feature_name": "Zoomable gallery image",
    "feature_type": "modal",
    "location_reference": "Gallery > Expand image",
    "page_path": "/projects/[id]",
    "component_reference": "app/components/gallery/zoomable-gallery-image.tsx",
    "explanation": "Opens a larger inspectable gallery image for project, unit, guide, or theme images.",
    "place_in_page": "Gallery modal layer",
    "coach_mark_target": "zoomable gallery image",
    "coach_mark_area": "The expanded gallery image viewer",
    "popup_placement": "auto",
    "display_order": 1940,
    "tags": [
      "images",
      "gallery",
      "zoom"
    ]
  },
  {
    "uid": "offline.page",
    "feature_name": "Offline page",
    "feature_type": "page",
    "location_reference": "Offline",
    "page_path": "/offline",
    "component_reference": "app/offline/page.tsx",
    "explanation": "Shows an offline fallback and tells the user to reconnect to pick up current projects, guides, paints, and progress.",
    "place_in_page": "Offline fallback page",
    "coach_mark_target": "offline page content",
    "coach_mark_area": "The whole offline viewport",
    "popup_placement": "auto",
    "display_order": 1950,
    "tags": [
      "offline",
      "pwa"
    ]
  }
]
$feature_guide$::jsonb) as x (
    uid text,
    feature_name text,
    feature_type text,
    location_reference text,
    page_path text,
    component_reference text,
    explanation text,
    place_in_page text,
    coach_mark_target text,
    coach_mark_area text,
    popup_placement text,
    display_order integer,
    tags text[]
  )
)
insert into public.feature_guide (
  uid,
  feature_name,
  feature_type,
  location_reference,
  page_path,
  component_reference,
  explanation,
  place_in_page,
  coach_mark_target,
  coach_mark_area,
  popup_placement,
  display_order,
  tags
)
select
  uid,
  feature_name,
  feature_type,
  location_reference,
  page_path,
  component_reference,
  explanation,
  place_in_page,
  coach_mark_target,
  coach_mark_area,
  popup_placement,
  display_order,
  tags
from seed
on conflict (uid) do update
set
  feature_name = excluded.feature_name,
  feature_type = excluded.feature_type,
  location_reference = excluded.location_reference,
  page_path = excluded.page_path,
  component_reference = excluded.component_reference,
  explanation = excluded.explanation,
  place_in_page = excluded.place_in_page,
  coach_mark_target = excluded.coach_mark_target,
  coach_mark_area = excluded.coach_mark_area,
  popup_placement = excluded.popup_placement,
  display_order = excluded.display_order,
  tags = excluded.tags,
  updated_at = now();

select count(*) from public.feature_guide;
