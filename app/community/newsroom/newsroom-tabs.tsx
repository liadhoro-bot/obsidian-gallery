import Link from '@/app/components/navigation-feedback/navigation-link'
import styles from '../news/news.module.css'

const tabs = [
  { id: 'articles', href: '/community/newsroom', label: 'Articles' },
  { id: 'inbox', href: '/community/newsroom/inbox', label: 'Inbox' },
  { id: 'sources', href: '/community/newsroom/sources', label: 'Sources' },
] as const

export function NewsroomTabs({ active }: { active: (typeof tabs)[number]['id'] }) {
  return (
    <nav className={styles.filters} data-columns="3" aria-label="Newsroom sections">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={styles.filter}
          aria-current={active === tab.id ? 'page' : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
