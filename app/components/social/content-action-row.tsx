'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import ReportDialog from './report-dialog'

type ToggleResult = {
  active: boolean
}

type ReportResult = {
  status: 'reported' | 'duplicate'
  message: string
}

type Props = {
  contentId: string
  contentType: 'recipe' | 'theme'
  className?: string
  likeCount: number
  saveCount: number
  viewerHasLiked: boolean
  viewerHasSaved: boolean
  viewerHasReported: boolean
  toggleLikeAction: (contentId: string) => Promise<ToggleResult>
  toggleSaveAction: (contentId: string) => Promise<ToggleResult>
  reportAction: (contentId: string, reason?: string) => Promise<ReportResult>
}

export default function ContentActionRow({
  contentId,
  contentType,
  className = 'px-4',
  likeCount,
  saveCount,
  viewerHasLiked,
  viewerHasSaved,
  viewerHasReported,
  toggleLikeAction,
  toggleSaveAction,
  reportAction,
}: Props) {
  const [liked, setLiked] = useState(viewerHasLiked)
  const [saved, setSaved] = useState(viewerHasSaved)
  const [reported, setReported] = useState(viewerHasReported)
  const [likes, setLikes] = useState(likeCount)
  const [saves, setSaves] = useState(saveCount)
  const [error, setError] = useState('')
  const [, startLikeTransition] = useTransition()
  const [, startSaveTransition] = useTransition()
  const likeInFlight = useRef(false)
  const saveInFlight = useRef(false)

  useEffect(() => {
    setLiked(viewerHasLiked)
    setSaved(viewerHasSaved)
    setReported(viewerHasReported)
    setLikes(likeCount)
    setSaves(saveCount)
  }, [
    likeCount,
    saveCount,
    viewerHasLiked,
    viewerHasSaved,
    viewerHasReported,
  ])

  function handleToggleLike() {
    if (likeInFlight.current) return

    setError('')
    likeInFlight.current = true
    const previousLiked = liked
    const previousLikes = likes
    const nextLiked = !liked

    setLiked(nextLiked)
    setLikes(Math.max(0, likes + (nextLiked ? 1 : -1)))

    startLikeTransition(async () => {
      try {
        const result = await toggleLikeAction(contentId)
        setLiked(result.active)
        setLikes(Math.max(0, previousLikes + (result.active ? 1 : -1)))
      } catch (toggleError) {
        setLiked(previousLiked)
        setLikes(previousLikes)
        setError(
          toggleError instanceof Error
            ? toggleError.message
            : 'Could not update like.'
        )
      } finally {
        likeInFlight.current = false
      }
    })
  }

  function handleToggleSave() {
    if (saveInFlight.current) return

    setError('')
    saveInFlight.current = true
    const previousSaved = saved
    const previousSaves = saves
    const nextSaved = !saved

    setSaved(nextSaved)
    setSaves(Math.max(0, saves + (nextSaved ? 1 : -1)))

    startSaveTransition(async () => {
      try {
        const result = await toggleSaveAction(contentId)
        setSaved(result.active)
        setSaves(Math.max(0, previousSaves + (result.active ? 1 : -1)))
      } catch (toggleError) {
        setSaved(previousSaved)
        setSaves(previousSaves)
        setError(
          toggleError instanceof Error
            ? toggleError.message
            : 'Could not update save.'
        )
      } finally {
        saveInFlight.current = false
      }
    })
  }

  return (
    <section className={className}>
      <div className="flex min-h-12 items-center justify-between border-b border-white/[0.06] py-3">
        <div className="flex items-center gap-7">
          <button
          type="button"
          onClick={handleToggleLike}
          className={actionClassName(liked)}
          aria-pressed={liked}
          aria-label={`${liked ? 'Unlike' : 'Like'} ${contentType}`}
        >
          <HeartIcon filled={liked} />
          <span>{Math.max(0, likes)}</span>
        </button>

          <button
          type="button"
          onClick={handleToggleSave}
          className={actionClassName(saved)}
          aria-pressed={saved}
          aria-label={`${saved ? 'Unsave' : 'Save'} ${contentType}`}
        >
          <BookmarkIcon filled={saved} />
          <span>{Math.max(0, saves)}</span>
        </button>
        </div>

        <ReportDialog
          contentId={contentId}
          contentType={contentType}
          viewerHasReported={reported}
          reportAction={reportAction}
          onReported={(nextReported) => {
            setReported(nextReported)
          }}
        />
      </div>

      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
    </section>
  )
}

function actionClassName(active: boolean) {
  return [
    'micro-toggle inline-flex items-center justify-center gap-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-70',
    active
      ? 'text-cyan-300 hover:text-cyan-200'
      : 'text-white/55 hover:text-white/80',
  ].join(' ')
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  )
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M6 3h12a1 1 0 0 1 1 1v18l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
    </svg>
  )
}
