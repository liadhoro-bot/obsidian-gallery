import Link from 'next/link'
import { ProjectDetailTab } from './project-detail-client'
import styles from './project-detail-silver.module.css'

type Props = {
  activeTab: ProjectDetailTab
  projectId: string
}

export default function ProjectDetailTabs({ activeTab, projectId }: Props) {
  const tabs: Array<{
    key: ProjectDetailTab
    label: string
    href: string
  }> = [
    { key: 'details', label: 'Project Details', href: `/projects/${projectId}?tab=details` },
    { key: 'units', label: 'Units', href: `/projects/${projectId}?tab=units` },
    { key: 'add', label: 'Add Unit', href: `/projects/${projectId}?tab=add` },
  ]

  return (
    <div
      className={styles.tabList}
      role="tablist"
      aria-label="Project sections"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key

        return (
          <Link
            key={tab.key}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={[
              styles.tab,
              'px-2 py-2 transition',
              isActive ? styles.tabActive : '',
            ].join(' ')}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
