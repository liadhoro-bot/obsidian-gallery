'use client'

import Image from 'next/image'
import Link from '@/app/components/navigation-feedback/navigation-link'
import { useEffect, useState, useTransition } from 'react'
import editorStyles from '../decks/[id]/deck-editor-client.module.css'
import { loadUnitGuideDraft, loadUnitSourceFolders } from '../unit-source-actions'
import { FolderIcon } from './guide-folders'
import type { UnitGuideDraft, UnitSourceFolder } from './unit-guide-draft'
import styles from './unit-source-dialog.module.css'

// Create Guide > From Unit: pick one unit out of its project folder and the
// new guide opens in the editor, filled in from that unit.
export function UnitSourceDialog({
  onBuild,
  onClose,
}: {
  onBuild: (draft: UnitGuideDraft, unitId: string) => void
  onClose: () => void
}) {
  const [folders, setFolders] = useState<UnitSourceFolder[] | null>(null)
  const [openFolders, setOpenFolders] = useState<Set<string>>(() => new Set())
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isBuilding, startBuilding] = useTransition()

  useEffect(() => {
    let isCurrent = true
    loadUnitSourceFolders()
      .then((loaded) => {
        if (!isCurrent) return
        setFolders(loaded)
        if (loaded.length === 1) setOpenFolders(new Set([loaded[0].id]))
      })
      .catch(() => {
        if (isCurrent) setError('Could not load your units. Please try again.')
      })
    return () => {
      isCurrent = false
    }
  }, [])

  function toggleFolder(folderId: string) {
    setOpenFolders((current) => {
      const next = new Set(current)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  function build() {
    if (!selectedUnitId) return
    setError(null)
    startBuilding(async () => {
      try {
        onBuild(await loadUnitGuideDraft(selectedUnitId), selectedUnitId)
      } catch {
        setError('Could not read that unit. Please try again.')
      }
    })
  }

  return (
    <div className={editorStyles.sheetBackdrop} role="dialog" aria-modal="true" aria-label="Choose a unit">
      <section className={`${editorStyles.sheet} ${styles.dialog}`}>
        <header>
          <h2>Choose a Unit</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        <p className={styles.hint}>
          Its name, photos, paints, notes and progress stages become the first cards of your guide.
        </p>
        {error ? <p role="alert" className={editorStyles.saveError}>{error}</p> : null}
        {!folders && !error ? <p className={styles.hint}>Loading your units...</p> : null}
        {folders?.length === 0 ? (
          <p className={styles.hint}>
            No units yet. <Link href="/units/new" className={styles.textLink}>Add a unit</Link> first.
          </p>
        ) : null}
        <div className={styles.folders}>
          {folders?.map((folder) => {
            const isOpen = openFolders.has(folder.id)
            return (
              <div key={folder.id} className={styles.folder}>
                <button
                  type="button"
                  className={styles.folderHead}
                  aria-expanded={isOpen}
                  onClick={() => toggleFolder(folder.id)}
                >
                  <span className={styles.thumb}>
                    {folder.image ? <Image unoptimized src={folder.image} alt="" fill sizes="44px" /> : <FolderIcon small />}
                  </span>
                  <span className={styles.name}>{folder.name}</span>
                  <span className={styles.count}>{folder.units.length}</span>
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.chevron}>
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>
                {isOpen ? (
                  <div className={styles.units} role="radiogroup" aria-label={folder.name}>
                    {folder.units.map((unit) => {
                      const isSelected = unit.id === selectedUnitId
                      return (
                        <button
                          key={unit.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          className={styles.unit}
                          onClick={() => setSelectedUnitId(unit.id)}
                        >
                          <span className={styles.check} aria-hidden="true">
                            {isSelected ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m5 12 5 5 9-10" />
                              </svg>
                            ) : null}
                          </span>
                          <span className={styles.thumb}>
                            {unit.image ? <Image unoptimized src={unit.image} alt="" fill sizes="44px" /> : null}
                          </span>
                          <span className={styles.name}>{unit.name}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
        {folders?.length ? (
          <button
            type="button"
            className={styles.build}
            disabled={!selectedUnitId || isBuilding}
            onClick={build}
          >
            {isBuilding ? 'Building...' : 'Build Guide from Unit'}
          </button>
        ) : null}
      </section>
    </div>
  )
}
