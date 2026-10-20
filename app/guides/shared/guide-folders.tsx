'use client'

// Folders for My Guides and Saved. A folder holds guide keys ('guide:<id>'
// or 'deck:<id>'); a guide sits in at most one folder, and guides in none
// list under the folders. Folders live in guide_folders/guide_folder_items
// (private to their owner); changes show at once and roll back if the save
// fails.

import { ReactNode, useState } from 'react'
import { createGuideFolder, deleteGuideFolder, moveGuideToFolder, renameGuideFolder } from '../folder-actions'
import type { GuideFolder, GuideFolderScope, GuideFoldersSnapshot } from './guide-folder-types'

export type { GuideFolder, GuideFolderScope } from './guide-folder-types'

export function useGuideFolders(scope: GuideFolderScope, initial: GuideFoldersSnapshot) {
  const [state, setState] = useState<GuideFoldersSnapshot>(initial)
  const [error, setError] = useState<string | null>(null)

  async function save(previous: GuideFoldersSnapshot, write: () => Promise<unknown>) {
    setError(null)
    try {
      await write()
    } catch (caught) {
      setState(previous)
      setError(caught instanceof Error ? caught.message : 'Could not save the folder change.')
    }
  }

  async function createFolder(name: string): Promise<GuideFolder | null> {
    setError(null)
    try {
      const folder = await createGuideFolder(scope, name)
      setState((current) => ({ ...current, folders: [...current.folders, folder] }))
      return folder
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the folder.')
      return null
    }
  }

  function renameFolder(id: string, name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    const previous = state
    setState((current) => ({
      ...current,
      folders: current.folders.map((folder) => (folder.id === id ? { ...folder, name: trimmed } : folder)),
    }))
    void save(previous, () => renameGuideFolder(id, trimmed))
  }

  // Removes the folder only; its guides go back to "Not in a folder".
  function deleteFolder(id: string) {
    const previous = state
    setState((current) => ({
      folders: current.folders.filter((folder) => folder.id !== id),
      assignments: Object.fromEntries(Object.entries(current.assignments).filter(([, folderId]) => folderId !== id)),
    }))
    void save(previous, () => deleteGuideFolder(id))
  }

  // folderId null takes the guide out of its folder.
  function moveToFolder(key: string, folderId: string | null) {
    const previous = state
    setState((current) => {
      const assignments = { ...current.assignments }
      if (folderId) assignments[key] = folderId
      else delete assignments[key]
      return { ...current, assignments }
    })
    void save(previous, () => moveGuideToFolder(scope, key, folderId))
  }

  // Assignments to a deleted folder fall back to no folder.
  const folderIds = new Set(state.folders.map((folder) => folder.id))
  function folderOf(key: string) {
    const id = state.assignments[key]
    return id && folderIds.has(id) ? id : null
  }

  return { folders: state.folders, error, folderOf, createFolder, renameFolder, deleteFolder, moveToFolder }
}

export type GuideFolders = ReturnType<typeof useGuideFolders>

const DRAG_TYPE = 'application/x-og-guide-key'

export type FolderListItem = { key: string; title: string; node: ReactNode }

// The library card's body in folders mode: each folder (closed by default)
// with its guides, then the guides in no folder. `renderItems` lays out a
// group of guides, so card and grid views both work inside a folder.
export function FolderedGuideList({
  items,
  folders,
  searching,
  renderItems,
  empty,
}: {
  items: FolderListItem[]
  folders: GuideFolders
  searching: boolean
  renderItems: (items: FolderListItem[]) => ReactNode
  empty: ReactNode
}) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const byFolder = new Map<string, FolderListItem[]>()
  const loose: FolderListItem[] = []
  for (const item of items) {
    const folderId = folders.folderOf(item.key)
    if (folderId) byFolder.set(folderId, [...(byFolder.get(folderId) ?? []), item])
    else loose.push(item)
  }

  function toggle(id: string) {
    setOpenIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function dropProps(target: string, folderId: string | null) {
    return {
      onDragOver: (event: React.DragEvent) => {
        if (!event.dataTransfer.types.includes(DRAG_TYPE)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        if (dropTarget !== target) setDropTarget(target)
      },
      onDragLeave: (event: React.DragEvent) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null)
      },
      onDrop: (event: React.DragEvent) => {
        const key = event.dataTransfer.getData(DRAG_TYPE)
        setDropTarget(null)
        if (!key) return
        event.preventDefault()
        folders.moveToFolder(key, folderId)
      },
      'data-drop-active': dropTarget === target ? 'true' : undefined,
    }
  }

  // While searching, folders without a match hide and the rest open.
  const visibleFolders = searching
    ? folders.folders.filter((folder) => byFolder.has(folder.id))
    : folders.folders

  if (!items.length && !visibleFolders.length) return <>{empty}</>

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2" data-v3-guides-indicator="folder-list">
      {folders.error ? <p role="alert" className="px-2 text-xs font-bold" data-v3-guides-indicator="folder-error">{folders.error}</p> : null}
      {visibleFolders.map((folder) => {
        const folderItems = byFolder.get(folder.id) ?? []
        const isOpen = searching || openIds.has(folder.id)
        return (
          <section key={folder.id} className="min-w-0" data-v3-guides-indicator="guide-folder" data-open={isOpen ? 'true' : undefined} {...dropProps(folder.id, folder.id)}>
            <div className="flex items-center gap-3 px-3 py-2.5">
              <FolderIcon />
              {renamingId === folder.id ? (
                <FolderNameForm
                  initialName={folder.name}
                  onSave={(name) => {
                    folders.renameFolder(folder.id, name)
                    setRenamingId(null)
                  }}
                  onCancel={() => setRenamingId(null)}
                  onDelete={() => {
                    if (!window.confirm(`Delete the folder "${folder.name}"? Only the folder is removed - its guides stay, under Not in a folder.`)) return
                    folders.deleteFolder(folder.id)
                    setRenamingId(null)
                  }}
                />
              ) : (
                <>
                  <button type="button" onClick={() => toggle(folder.id)} className="min-w-0 flex-1 text-left" aria-expanded={isOpen} data-folder-toggle="">
                    <span className="block truncate font-serif text-lg font-black leading-tight" data-v3-guides-indicator="guide-folder-name">
                      {folder.name} <span className="text-sm font-semibold opacity-60">({folderItems.length})</span>
                    </span>
                  </button>
                  <button type="button" onClick={() => setRenamingId(folder.id)} className="grid h-9 w-9 shrink-0 place-items-center" aria-label={`Rename ${folder.name}`} data-v3-guides-indicator="folder-icon-button">
                    <PencilIcon />
                  </button>
                  <button type="button" onClick={() => toggle(folder.id)} className="grid h-9 w-9 shrink-0 place-items-center" aria-label={isOpen ? `Close ${folder.name}` : `Open ${folder.name}`} aria-expanded={isOpen} data-v3-guides-indicator="folder-icon-button">
                    <ChevronIcon up={isOpen} />
                  </button>
                </>
              )}
            </div>
            {isOpen ? (
              <div className="px-2 pb-2">
                {folderItems.length ? renderItems(folderItems) : (
                  <p className="px-2 pb-2 text-xs opacity-70">No guides here yet. Use the folder button on a guide, or drag one onto this folder.</p>
                )}
              </div>
            ) : null}
          </section>
        )
      })}
      {loose.length || folders.folders.length ? (
        <div className="min-w-0" data-v3-guides-indicator="folder-loose" {...dropProps('loose', null)}>
          {folders.folders.length && loose.length ? (
            <p className="px-2 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Not in a folder · {loose.length}</p>
          ) : null}
          {loose.length ? renderItems(loose) : null}
        </div>
      ) : null}
    </div>
  )
}

// Wraps one guide card: a move-to-folder button in its top-right corner, and
// (on desktop) the whole card drags onto a folder.
export function FolderItem({
  itemKey,
  title,
  children,
  folders,
  onMove,
}: {
  itemKey: string
  title: string
  children: ReactNode
  folders: GuideFolders
  onMove: (key: string, title: string) => void
}) {
  const inFolder = folders.folderOf(itemKey)
  return (
    <div
      className="relative"
      data-guide-folder-item=""
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE, itemKey)
        event.dataTransfer.effectAllowed = 'move'
      }}
    >
      {children}
      <button
        type="button"
        onClick={() => onMove(itemKey, title)}
        className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center"
        aria-label={inFolder ? `Move ${title} to another folder` : `Move ${title} to a folder`}
        title="Move to folder"
        data-v3-guides-indicator="move-to-folder"
      >
        <MoveIcon />
      </button>
    </div>
  )
}

export function MoveToFolderSheet({
  itemKey,
  title,
  folders,
  onClose,
}: {
  itemKey: string
  title: string
  folders: GuideFolders
  onClose: () => void
}) {
  const [isCreating, setIsCreating] = useState(folders.folders.length === 0)
  const current = folders.folderOf(itemKey)

  function move(folderId: string | null) {
    folders.moveToFolder(itemKey, folderId)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-end bg-black/65 px-3 py-4 backdrop-blur-sm" onClick={onClose}>
      <section
        className="mx-auto w-full max-w-md p-4"
        data-v3-guides-indicator="move-folder-sheet"
        role="dialog"
        aria-label="Move to folder"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-xl font-black">Move to folder</h2>
            <p className="truncate text-xs opacity-70">{title}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center" aria-label="Close" data-v3-guides-indicator="folder-icon-button">
            ✕
          </button>
        </div>
        <div className="grid max-h-[50vh] gap-2 overflow-y-auto">
          {folders.folders.map((folder) => (
            <button key={folder.id} type="button" onClick={() => move(folder.id)} className="flex items-center gap-3 px-3 py-2.5 text-left" data-v3-guides-indicator="folder-choice" data-active={current === folder.id ? 'true' : undefined}>
              <FolderIcon small />
              <span className="min-w-0 flex-1 truncate font-serif text-base font-bold">{folder.name}</span>
              {current === folder.id ? <span className="text-xs font-bold opacity-70">Current</span> : null}
            </button>
          ))}
          {current ? (
            <button type="button" onClick={() => move(null)} className="flex items-center gap-3 px-3 py-2.5 text-left" data-v3-guides-indicator="folder-choice">
              <span className="grid h-7 w-8 place-items-center text-lg">↩</span>
              <span className="font-bold">Take out of folder</span>
            </button>
          ) : null}
        </div>
        <div className="mt-3">
          {isCreating ? (
            <FolderNameForm
              initialName=""
              placeholder="New folder name"
              saveLabel="Create & move"
              onSave={async (name) => {
                const folder = await folders.createFolder(name)
                if (folder) move(folder.id)
              }}
              onCancel={folders.folders.length ? () => setIsCreating(false) : onClose}
            />
          ) : (
            <button type="button" onClick={() => setIsCreating(true)} className="w-full px-3 py-2.5 text-sm font-black" data-v3-guides-indicator="new-folder-button">
              + New Folder
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

export function NewFolderButton({ folders, onCreated }: { folders: GuideFolders; onCreated?: (folder: GuideFolder) => void }) {
  const [isCreating, setIsCreating] = useState(false)
  if (isCreating) {
    return (
      <div className="px-2 pb-2">
        <FolderNameForm
          initialName=""
          placeholder="New folder name"
          saveLabel="Create"
          onSave={async (name) => {
            const folder = await folders.createFolder(name)
            if (!folder) return
            setIsCreating(false)
            onCreated?.(folder)
          }}
          onCancel={() => setIsCreating(false)}
        />
      </div>
    )
  }
  return (
    <button type="button" onClick={() => setIsCreating(true)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black" data-v3-guides-indicator="new-folder-link">
      <FolderPlusIcon /> New Folder
    </button>
  )
}

function FolderNameForm({
  initialName,
  placeholder = 'Folder name',
  saveLabel = 'Save',
  onSave,
  onCancel,
  onDelete,
}: {
  initialName: string
  placeholder?: string
  saveLabel?: string
  onSave: (name: string) => void | Promise<void>
  onCancel: () => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(initialName)
  const [isSaving, setIsSaving] = useState(false)
  return (
    <form
      className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
      data-v3-guides-indicator="folder-name-form"
      onSubmit={async (event) => {
        event.preventDefault()
        if (!name.trim() || isSaving) return
        setIsSaving(true)
        try {
          await onSave(name)
        } finally {
          setIsSaving(false)
        }
      }}
    >
      <input
        autoFocus
        value={name}
        maxLength={60}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel()
        }}
        placeholder={placeholder}
        aria-label="Folder name"
        className="h-10 min-w-0 flex-1 basis-40 px-3 text-sm font-semibold outline-none"
      />
      <div className="flex gap-2">
        <button type="submit" disabled={!name.trim() || isSaving} className="h-10 px-3 text-xs font-black disabled:opacity-50" data-primary="true">{saveLabel}</button>
        <button type="button" onClick={onCancel} className="h-10 px-3 text-xs font-black">Cancel</button>
        {onDelete ? (
          <button type="button" onClick={onDelete} className="h-10 px-3 text-xs font-black" data-danger="true" title="Delete folder (its guides stay, outside any folder)">Delete</button>
        ) : null}
      </div>
    </form>
  )
}

export function FolderIcon({ small = false }: { small?: boolean }) {
  const size = small ? 28 : 40
  return (
    <svg aria-hidden="true" width={size} height={size * 0.82} viewBox="0 0 40 33" className="shrink-0" data-v3-guides-indicator="folder-glyph">
      <path d="M3 6.5A3.5 3.5 0 0 1 6.5 3h8.2a3 3 0 0 1 2.3 1.1l2 2.4h14.5A3.5 3.5 0 0 1 37 10v17.5a3.5 3.5 0 0 1-3.5 3.5h-27A3.5 3.5 0 0 1 3 27.5Z" fill="#5a3a1c" stroke="#2c1a0b" strokeWidth="1.5" />
      <path d="M3 12.5A2.5 2.5 0 0 1 5.5 10h29A2.5 2.5 0 0 1 37 12.5v15A3.5 3.5 0 0 1 33.5 31h-27A3.5 3.5 0 0 1 3 27.5Z" fill="#7a5328" stroke="#2c1a0b" strokeWidth="1.5" />
      <rect x="14" y="17" width="12" height="7" rx="1.5" fill="#c9a45c" stroke="#3a2410" strokeWidth="1" />
    </svg>
  )
}

export function FoldersIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.2l2 2.2h8.8A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z" />
    </svg>
  )
}

export function SortIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 19V5M4.5 8.5 8 5l3.5 3.5M16 5v14M12.5 15.5 16 19l3.5-3.5" />
    </svg>
  )
}

function FolderPlusIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.2l2 2.2h8.8A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z" />
      <path d="M12 11v6M9 14h6" />
    </svg>
  )
}

function MoveIcon() {
  return (
    <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.2l2 2.2h8.8A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z" />
      <path d="M9 13.5h6M12.5 11l2.5 2.5-2.5 2.5" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" /><path d="m14 7 3 3" /></svg>
  )
}

function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d={up ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
    </svg>
  )
}
