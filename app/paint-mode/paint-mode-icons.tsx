import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 20, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export function CloseIcon(props: IconProps) {
  return <Svg {...props}><path d="M6 6l12 12M18 6 6 18" /></Svg>
}

export function HelpIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9.2 9.2a2.9 2.9 0 1 1 4.3 2.5c-.9.5-1.5 1.1-1.5 2.1v.4" />
      <path d="M12 17.6h.01" strokeWidth={2.6} />
    </Svg>
  )
}

export function SwitchIcon(props: IconProps) {
  return <Svg {...props}><path d="M4 8h13l-3-3M20 16H7l3 3" /></Svg>
}

export function PlusIcon(props: IconProps) {
  return <Svg {...props}><path d="M12 5v14M5 12h14" /></Svg>
}

export function BrushIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 4 10.5 13.5" />
      <path d="M10.5 13.5c-2.4-.6-4.4 1-4.6 3.3-.1 1.4-.9 2.4-2.4 2.7 3.6 1.6 7.6.4 7.9-3.4" />
    </Svg>
  )
}

export function HelmIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 15c0-5 3-9 7-9s7 4 7 9v3h-5v-4h-4v4H5z" />
      <path d="M12 6v8" />
    </Svg>
  )
}

export function ChevronIcon(props: IconProps) {
  return <Svg {...props}><path d="m9 5 7 7-7 7" /></Svg>
}

export function BackIcon(props: IconProps) {
  return <Svg {...props}><path d="m15 5-7 7 7 7" /></Svg>
}

export function PauseIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </Svg>
  )
}

export function PlayIcon(props: IconProps) {
  return <Svg {...props} fill="currentColor" stroke="none"><path d="M7 5v14l12-7z" /></Svg>
}

export function StopwatchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="13.5" r="7" />
      <path d="M12 13.5V10M10 3h4M18.5 6.5l1.5-1.5" />
    </Svg>
  )
}

export function ClockIcon(props: IconProps) {
  return <Svg {...props}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>
}

export function LayersIcon(props: IconProps) {
  return <Svg {...props}><path d="m12 4 8.5 4.5L12 13 3.5 8.5z" /><path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5" /></Svg>
}

export function CalendarIcon(props: IconProps) {
  return <Svg {...props}><rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></Svg>
}

export function DeadlineIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
      <circle cx="12" cy="15" r="2.2" />
    </Svg>
  )
}

export function GalleryIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4.5 17.5 5-5 3.5 3.5 2.5-2.5 4 4" />
    </Svg>
  )
}

export function ChartIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <rect x="4" y="12" width="3.5" height="7" rx="0.6" />
      <rect x="10.25" y="7" width="3.5" height="12" rx="0.6" />
      <rect x="16.5" y="10" width="3.5" height="9" rx="0.6" />
    </Svg>
  )
}

export function CheckIcon(props: IconProps) {
  return <Svg {...props}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>
}

// Dashed "nothing here yet" drawings for the empty tiles.

export function DashedNoteArt() {
  return (
    <svg width="96" height="60" viewBox="0 0 96 60" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="4" y="4" width="88" height="52" rx="6" strokeDasharray="4 3" />
      <path d="M16 20h52M16 30h40M16 40h28" strokeDasharray="3 3" />
      <path d="M78 36v12M72 42h12" strokeWidth="2" />
    </svg>
  )
}

export function DashedBookArt() {
  return (
    <svg width="88" height="60" viewBox="0 0 88 60" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M44 12c-8-6-24-7-38-4v44c14-3 30-2 38 4 8-6 24-7 38-4V8C68 5 52 6 44 12z" strokeDasharray="4 3" />
      <path d="M44 12v44" strokeDasharray="3 3" />
      <path d="M44 26v12M38 32h12" strokeWidth="2" />
    </svg>
  )
}

export function DashedPhotoArt({ count = 2 }: { count?: number }) {
  return (
    <svg width={count > 1 ? 96 : 56} height="60" viewBox={count > 1 ? '0 0 96 60' : '0 0 56 60'} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <g transform="rotate(-6 26 32)">
        <rect x="4" y="8" width="44" height="40" rx="4" strokeDasharray="4 3" />
        <circle cx="32" cy="20" r="4" fill="currentColor" stroke="none" opacity="0.55" />
        <path d="m8 42 12-12 9 9 6-5 9 8" fill="currentColor" stroke="none" opacity="0.4" />
      </g>
      {count > 1 ? (
        <g transform="rotate(7 70 32)">
          <rect x="48" y="12" width="42" height="38" rx="4" strokeDasharray="4 3" />
          <circle cx="76" cy="23" r="3.6" fill="currentColor" stroke="none" opacity="0.55" />
          <path d="m52 45 11-11 8 8 5-4 9 7" fill="currentColor" stroke="none" opacity="0.4" />
        </g>
      ) : null}
    </svg>
  )
}

export function DashedSwatchArt({ count = 3, withAdd = false }: { count?: number; withAdd?: boolean }) {
  const total = count + (withAdd ? 1 : 0)
  return (
    <svg width={total * 28 + 4} height="34" viewBox={`0 0 ${total * 28 + 4} 34`} fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <circle key={index} cx={17 + index * 28} cy="17" r="13" strokeDasharray={index < count ? '0' : '3 2.5'} />
      ))}
      {withAdd ? <path d={`M${17 + count * 28} 11v12M${11 + count * 28} 17h12`} strokeWidth="1.8" /> : null}
    </svg>
  )
}

export function MiniatureOutlineArt() {
  return (
    <svg viewBox="0 0 120 170" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="5 4" aria-hidden="true">
      <circle cx="56" cy="34" r="13" />
      <path d="M38 62c4-10 32-10 36 0l8 52H30z" />
      <path d="M86 20 92 6l6 14M92 20v112" />
      <path d="M74 70 90 58" />
      <ellipse cx="60" cy="140" rx="46" ry="12" />
      <path d="M14 140v10c0 7 21 12 46 12s46-5 46-12v-10" />
    </svg>
  )
}
