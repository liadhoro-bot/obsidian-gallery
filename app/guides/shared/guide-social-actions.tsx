'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { toggleRecipeLike, toggleRecipeSave } from '../../components/social/actions'

type GuideSocialActionsProps = {
  recipeId: string
  likeCount: number
  saveCount: number
  viewerHasLiked: boolean
  viewerHasSaved: boolean
  className?: string
  size?: 'sm' | 'md'
  stopClickPropagation?: boolean
}

export default function GuideSocialActions({
  recipeId,
  likeCount,
  saveCount,
  viewerHasLiked,
  viewerHasSaved,
  className = '',
  size = 'md',
  stopClickPropagation = false,
}: GuideSocialActionsProps) {
  const [liked, setLiked] = useState(viewerHasLiked)
  const [saved, setSaved] = useState(viewerHasSaved)
  const [likes, setLikes] = useState(likeCount)
  const [saves, setSaves] = useState(saveCount)
  const [, startTransition] = useTransition()
  const likeInFlight = useRef(false)
  const saveInFlight = useRef(false)

  useEffect(() => {
    setLiked(viewerHasLiked)
    setLikes(likeCount)
  }, [viewerHasLiked, likeCount])

  useEffect(() => {
    setSaved(viewerHasSaved)
    setSaves(saveCount)
  }, [viewerHasSaved, saveCount])

  function handleToggleLike() {
    if (likeInFlight.current) return
    likeInFlight.current = true
    const previousLiked = liked
    const nextLiked = !liked
    setLiked(nextLiked)
    setLikes((count) => Math.max(0, count + (nextLiked ? 1 : -1)))

    startTransition(async () => {
      try {
        const result = await toggleRecipeLike(recipeId)
        setLiked(result.active)
      } catch {
        setLiked(previousLiked)
        setLikes((count) => Math.max(0, count + (nextLiked ? -1 : 1)))
      } finally {
        likeInFlight.current = false
      }
    })
  }

  function handleToggleSave() {
    if (saveInFlight.current) return
    saveInFlight.current = true
    const previousSaved = saved
    const nextSaved = !saved
    setSaved(nextSaved)
    setSaves((count) => Math.max(0, count + (nextSaved ? 1 : -1)))

    startTransition(async () => {
      try {
        const result = await toggleRecipeSave(recipeId)
        setSaved(result.active)
      } catch {
        setSaved(previousSaved)
        setSaves((count) => Math.max(0, count + (nextSaved ? -1 : 1)))
      } finally {
        saveInFlight.current = false
      }
    })
  }

  const buttonSizeClass =
    size === 'sm' ? 'gap-1 px-2 py-1 text-[10px]' : 'gap-1.5 px-2.5 py-1.5 text-xs'
  const iconSize = size === 'sm' ? 13 : 16

  const wrapperInterceptProps = stopClickPropagation
    ? {
        onClick: (event: React.MouseEvent) => {
          event.preventDefault()
          event.stopPropagation()
        },
        onPointerDown: (event: React.PointerEvent) => event.stopPropagation(),
      }
    : {}

  return (
    <div className={`flex items-center gap-2 ${className}`} {...wrapperInterceptProps}>
      <button
        type="button"
        onClick={handleToggleLike}
        aria-pressed={liked}
        aria-label={liked ? 'Unlike guide' : 'Like guide'}
        className={`flex items-center rounded-full bg-black/50 font-semibold backdrop-blur-sm transition-colors ${buttonSizeClass} ${
          liked ? 'text-rose-400' : 'text-white/85'
        }`}
      >
        <HeartIcon filled={liked} size={iconSize} />
        <span style={{ color: 'inherit' }}>{likes}</span>
      </button>
      <button
        type="button"
        onClick={handleToggleSave}
        aria-pressed={saved}
        aria-label={saved ? 'Remove from your guides' : 'Save to your guides'}
        className={`flex items-center rounded-full bg-black/50 font-semibold backdrop-blur-sm transition-colors ${buttonSizeClass} ${
          saved ? 'text-cyan-300' : 'text-white/85'
        }`}
      >
        <BookmarkIcon filled={saved} size={iconSize} />
        <span style={{ color: 'inherit' }}>{saves}</span>
      </button>
    </div>
  )
}

function HeartIcon({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        d="M12 21s-6.7-4.35-9.3-8.2C1 10.1 1.7 6.6 4.6 5.1c2.2-1.1 4.7-.4 6 1.4l1.4 1.9 1.4-1.9c1.3-1.8 3.8-2.5 6-1.4 2.9 1.5 3.6 5 1.9 7.7C18.7 16.65 12 21 12 21z"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BookmarkIcon({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1z" strokeLinejoin="round" />
    </svg>
  )
}
