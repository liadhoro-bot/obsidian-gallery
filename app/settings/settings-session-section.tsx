import { logout } from './settings-actions'
import SubmitButton from '../components/SubmitButton'

export default async function SettingsSessionSection() {
  return (
    <section className="pb-8">
      <div className="px-1">
        <h2 className="text-base font-bold text-slate-200">
          Session Management
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          You are currently logged in.
        </p>
      </div>

      <form action={logout} className="mt-4">
        <SubmitButton
          idleText="Logout"
          pendingText="Logging out..."
          className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm font-bold text-red-400"
        />
      </form>
    </section>
  )
}
