import { redirect } from 'next/navigation'
import BackButton from '../components/back-button'
import { createClient } from '../../utils/supabase/server'
import ReportBugForm from './report-bug-form'
import styles from './report-bug.module.css'

type ReportBugPageProps = {
  searchParams?: Promise<{
    page?: string
  }>
}

export default async function ReportBugPage({
  searchParams,
}: ReportBugPageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/report-bug')
  }

  const params = searchParams ? await searchParams : undefined
  const initialPage = params?.page?.trim() || ''

  return (
    <main className={styles.root}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <BackButton fallbackHref="/dashboard" className={styles.backButton} />
          <p className={styles.eyebrow}>Obsidian Gallery</p>
          <h1 className={styles.title}>Report a bug</h1>
          <p className={styles.copy}>
            Tell us where the issue happened and what went wrong.
          </p>
        </header>

        <section className={styles.panel}>
          <ReportBugForm initialPage={initialPage} />
        </section>
      </div>
    </main>
  )
}
