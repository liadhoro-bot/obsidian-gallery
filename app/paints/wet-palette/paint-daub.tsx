import { useId } from 'react'
import { getPaintDaubShape } from './paint-daub-shapes'

type PaintDaubProps = {
  seed: string
  color: string
  className?: string
}

export default function PaintDaub({ seed, color, className }: PaintDaubProps) {
  const reactId = useId()
  const uid = reactId.replace(/[^a-zA-Z0-9-]/g, '')
  const shape = getPaintDaubShape(seed)

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 240 176"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ color, overflow: 'visible' }}
    >
      <defs>
        <filter id={`aura-${uid}`} x="0" y="0" width="240" height="176" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <filter id={`softShadow-${uid}`} x="0" y="0" width="240" height="176" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000000" floodOpacity="0.22" />
        </filter>
        <radialGradient id={`body-${uid}`} cx="42%" cy="38%" r="70%">
          <stop offset="0" stopColor="white" stopOpacity="0.14" />
          <stop offset="0.2" stopColor="currentColor" stopOpacity="0.98" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.92" />
        </radialGradient>
        <linearGradient id={`rim-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="white" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="white" stopOpacity="0.18" />
          <stop offset="1" stopColor="black" stopOpacity="0.16" />
        </linearGradient>
        <linearGradient id={`highlight-${uid}`} x1="0.15" y1="0.08" x2="0.9" y2="0.9">
          <stop offset="0" stopColor="white" stopOpacity="0.9" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`clip-${uid}`}>
          <path d={shape.body} />
        </clipPath>
      </defs>
      <g filter={`url(#aura-${uid})`} opacity="0.22">
        <path d={shape.aura} fill="currentColor" />
      </g>
      <g filter={`url(#softShadow-${uid})`}>
        <path d={shape.body} fill={`url(#body-${uid})`} />
        <path d={shape.body} stroke={`url(#rim-${uid})`} strokeWidth="3" fill="none" />
      </g>
      <g clipPath={`url(#clip-${uid})`}>
        <path
          d={shape.highlight}
          stroke={`url(#highlight-${uid})`}
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.95"
          fill="none"
        />
        <path
          d={shape.underGlow}
          stroke="white"
          strokeOpacity="0.12"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </svg>
  )
}
