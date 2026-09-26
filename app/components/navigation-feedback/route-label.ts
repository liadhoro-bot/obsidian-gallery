export function routeLabel(href: string) {
  const url = new URL(href, 'https://app.local')
  const root = url.pathname.split('/')[1]
  const titles: Record<string, string> = {
    dashboard: 'Dashboard', projects: 'Projects', units: 'Unit', paints: 'Paint Vault',
    guides: 'Guides', recipes: 'Recipe', community: 'Community', contests: 'Contests',
    themes: 'Themes', vault: 'Paint Vault', settings: 'Settings', onboarding: 'Getting started',
    subscribe: 'Membership', login: 'Sign in', support: 'Support',
  }
  return {
    title: titles[root] ?? 'Obsidian Gallery',
    dashboard: root === 'dashboard',
    progress: root === 'dashboard' && url.searchParams.get('tab') === 'profile',
  }
}
