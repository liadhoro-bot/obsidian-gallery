import { redirect } from 'next/navigation'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'
import ContestAdminForm from '../../../../components/contests/contest-admin-form'
import { isCurrentUserAdmin } from '../../../../lib/admin'

export default async function NewContestPage() {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) redirect('/login')
  if (!(await isCurrentUserAdmin(user.id))) redirect('/contests')

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-6 sm:max-w-3xl">
        <h1 className="text-3xl font-black">New Contest</h1>
        <ContestAdminForm />
      </div>
    </main>
  )
}
