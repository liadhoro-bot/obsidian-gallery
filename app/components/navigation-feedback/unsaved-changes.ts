'use client'

import { useLayoutEffect, useState } from 'react'

const blockers = new Set<symbol>()
let completingExit = false
const message = 'You have unsaved changes. Leave this editor and discard them? Choose Cancel to keep editing.'

function beforeUnload(event: BeforeUnloadEvent) {
  if (!blockers.size) return
  event.preventDefault()
  event.returnValue = ''
}

export function confirmLeaveEditor() {
  return completingExit || blockers.size === 0 || window.confirm(message)
}

// A successful, explicitly confirmed deletion already authorizes this exit.
export function completeEditorExit(navigate: () => void) {
  completingExit = true
  try { navigate() } finally { completingExit = false }
}

export function isPageChange(href: string) {
  const next = new URL(href, window.location.href)
  return next.origin !== window.location.origin || next.pathname !== window.location.pathname || next.search !== window.location.search
}

export function useUnsavedChanges(dirty: boolean) {
  useLayoutEffect(() => {
    if (!dirty) return
    const id = Symbol('editor')
    blockers.add(id)
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      blockers.delete(id)
      if (!blockers.size) window.removeEventListener('beforeunload', beforeUnload)
    }
  }, [dirty])
}

// Compare against the submitted version, not the current form: edits made while
// a request is in flight must remain dirty after that request succeeds.
export function useEditorChanges(snapshot: string, busy: boolean) {
  const [saved, setSaved] = useState(snapshot)
  useUnsavedChanges(snapshot !== saved || busy)
  return async (save: () => void | boolean | Promise<boolean>) => {
    const submitted = snapshot
    const succeeded = await save()
    if (succeeded === true) setSaved(submitted)
  }
}

// Install once at the app navigation boundary. History indices let us restore
// a cancelled Back/Forward before Next sees the popstate, without adding fake
// entries or replacing Next's own history state.
export function installEditorNavigationProtection() {
  const key = '__editorHistoryIndex'
  const originalPush = history.pushState
  const originalReplace = history.replaceState
  let index: number = history.state?.[key] ?? 0
  let restoring: { delta: number } | null = null
  let approvedTraversal = false
  originalReplace.call(history, { ...history.state, [key]: index }, '')
  const push: History['pushState'] = function (data, unused, url) {
    originalPush.call(history, { ...data, [key]: index + 1 }, unused, url)
    index += 1
  }
  const replace: History['replaceState'] = function (data, unused, url) {
    originalReplace.call(history, { ...data, [key]: index }, unused, url)
  }
  history.pushState = push
  history.replaceState = replace

  const click = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
    if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return
    // Cross-document exits get the browser's beforeunload confirmation.
    if (anchor.origin !== location.origin || !isPageChange(anchor.href)) return
    if (!confirmLeaveEditor()) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }
  const pop = (event: PopStateEvent) => {
    const nextIndex = event.state?.[key]
    if (restoring) {
      event.stopImmediatePropagation()
      const { delta } = restoring
      restoring = null
      if (confirmLeaveEditor()) {
        approvedTraversal = true
        history.go(delta)
      }
      return
    }
    if (typeof nextIndex !== 'number') return // Cross-document history uses beforeunload.
    if (approvedTraversal) {
      approvedTraversal = false
      index = nextIndex
      return
    }
    if (blockers.size && nextIndex !== index) {
      event.stopImmediatePropagation()
      restoring = { delta: nextIndex - index }
      history.go(index - nextIndex)
      return
    }
    index = nextIndex
  }
  document.addEventListener('click', click, true)
  window.addEventListener('popstate', pop, true)
  return () => {
    document.removeEventListener('click', click, true)
    window.removeEventListener('popstate', pop, true)
    if (history.pushState === push) history.pushState = originalPush
    if (history.replaceState === replace) history.replaceState = originalReplace
  }
}
