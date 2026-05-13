import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import ThemeTabsClient from './theme-tabs-client'
import ThemeCard from './theme-card'
import ThemeForm from './theme-form'
import DashboardTopBar from '../dashboard/dashboard-top-bar'
import MobileNav from '../components/MobileNav'

type Props = {
  searchParams: Promise<{
    tab?: string
    selectForProject?: string
  }>
}
async function attachThemeToProject(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const projectId = formData.get('projectId')?.toString()
  const themeId = formData.get('themeId')?.toString()

  if (!projectId || !themeId) return

  const { error } = await supabase
    .from('projects')
    .update({
      theme_id: themeId,
    })
    .eq('id', projectId)

  if (error) {
    console.error('Error attaching theme to project:', error)
    return
  }

  redirect(`/projects/${projectId}`)
}
export default async function ThemesPage({ searchParams }: Props) {
  const params = await searchParams
  const tab = params.tab || 'find'
  const selectForProject = params.selectForProject || null
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: publicThemes }, { data: myThemes }, { data: savedRows }] =
    await Promise.all([
      supabase
        .from('themes')
        .select(`
  id,
  user_id,
  name,
  description,
  image_url,
  is_public,
  created_at,
  theme_paints (
    id,
    sort_order,
    paint_source,
    catalog_paint:paint_catalog!theme_paints_paint_catalog_id_fkey (
      id,
      swatch_image_url,
      hex_approx
    ),
    custom_paint:paints!theme_paints_custom_paint_id_fkey (
      id,
      color_hex
    )
  )
`)
        .eq('is_public', true)
        .order('created_at', { ascending: false }),

      supabase
        .from('themes')
        .select(`
  id,
  user_id,
  name,
  description,
  image_url,
  is_public,
  created_at,
  theme_paints (
    id,
    sort_order,
    paint_source,
    catalog_paint:paint_catalog!theme_paints_paint_catalog_id_fkey (
      id,
      swatch_image_url,
      hex_approx
    ),
    custom_paint:paints!theme_paints_custom_paint_id_fkey (
      id,
      color_hex
    )
  )
`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      supabase
        .from('saved_themes')
        .select(
          `
          theme_id,
          themes (
            id,
            user_id,
            name,
            description,
            image_url,
            is_public,
            created_at
          )
        `
        )
        .eq('user_id', user.id),
    ])

  const savedThemes =
    savedRows
      ?.map((row: any) => row.themes)
      .filter(Boolean) ?? []

  const savedThemeIds = (savedRows ?? []).map((row: any) => row.theme_id)

  const myAndSavedThemes = [
    ...(myThemes ?? []),
    ...savedThemes.filter(
      (savedTheme: any) =>
        !(myThemes ?? []).some((theme) => theme.id === savedTheme.id)
    ),
  ]

  const { data: catalogPaints } = await supabase
    .from('paint_catalog')
    .select('id, name, brand, line, swatch_image_url, hex_approx')
    .eq('is_active', true)
    .order('brand', { ascending: true })
    .order('line', { ascending: true })
    .order('name', { ascending: true })
    .range(0, 4999)

  const { data: customPaints } = await supabase
    .from('paints')
    .select('id, name, manufacturer, series, color_hex')
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  const paintOptions = [
    ...(catalogPaints || []).map((paint) => ({
      id: paint.id,
      source: 'catalog' as const,
      name: paint.name || 'Unnamed paint',
      brand: paint.brand,
      line: paint.line,
      swatch_image_url: paint.swatch_image_url,
      hex: paint.hex_approx,
    })),
    ...(customPaints || []).map((paint) => ({
      id: paint.id,
      source: 'custom' as const,
      name: paint.name || 'Unnamed paint',
      brand: paint.manufacturer,
      line: paint.series,
      swatch_image_url: null,
      hex: paint.color_hex,
    })),
  ]

  return (
    <main className="min-h-screen bg-[#03070b] pb-24 text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <DashboardTopBar userId={user.id} />

        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Theme Library
          </h1>

          <p className="mt-2 text-sm text-white/60">
            Build and share miniature painting palettes.
          </p>
        </div>

        <ThemeTabsClient />

        {tab === 'find' && (
          <div className="grid grid-cols-2 gap-3">
            {(publicThemes ?? []).length > 0 ? (
              (publicThemes ?? []).map((theme) => (
                <ThemeCard
  theme={theme}
  currentUserId={user.id}
  isSaved={savedThemeIds.includes(theme.id)}
  selectForProject={selectForProject}
  attachThemeToProjectAction={attachThemeToProject}
/>
              ))
            ) : (
              <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
                No public themes yet.
              </div>
            )}
          </div>
        )}

        {tab === 'mine' && (
          <div className="grid grid-cols-2 gap-3">
            {myAndSavedThemes.length > 0 ? (
              myAndSavedThemes.map((theme: any) => (
                <ThemeCard
                 theme={theme}
                 currentUserId={user.id}
                 isSaved={savedThemeIds.includes(theme.id)}
                 selectForProject={selectForProject}
                 attachThemeToProjectAction={attachThemeToProject}
                />
              ))
            ) : (
              <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
                You have not created or saved any themes yet.
              </div>
            )}
          </div>
        )}

        {tab === 'create' && <ThemeForm paints={paintOptions} />}
      </div>

      <MobileNav />
    </main>
  )
}