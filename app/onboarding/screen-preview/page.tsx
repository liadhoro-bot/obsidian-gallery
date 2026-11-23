import { redirect } from 'next/navigation'
import { createClient, getSessionUser } from '../../../utils/supabase/server'
import { isCurrentUserAdmin } from '../../../lib/admin'
import ScreenPreview from './screen-preview'
import { PREVIEW_SCREENS, type PreviewScreen } from './screens'

// One onboarding screen on its own, in preview mode (nothing is saved and the
// buttons don't move on). /admin/onboarding shows these in phone frames. It
// lives under /onboarding so the app chrome (bottom bar, prompts) stays off,
// exactly as new users see it. Admins only.
type Props = { searchParams?: Promise<{ screen?: string }> }

export default async function OnboardingScreenPreviewPage({ searchParams }: Props) {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) redirect('/login?next=%2Fadmin%2Fonboarding')
  if (!(await isCurrentUserAdmin(user.id))) redirect('/dashboard')

  const requested = (await searchParams)?.screen
  const screen: PreviewScreen = PREVIEW_SCREENS.includes(requested as PreviewScreen)
    ? (requested as PreviewScreen)
    : 'terms'

  return <ScreenPreview screen={screen} />
}
