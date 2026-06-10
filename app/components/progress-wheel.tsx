type ProgressWheelProps = {
  value: number
  className?: string
  label?: string
  showLabel?: boolean
  svgClassName?: string
  centerTextSize?: number
}

export default function ProgressWheel({
  value,
  className = '',
  label = 'PROGRESS TRACKER',
  showLabel = true,
  svgClassName = 'h-24 w-24 sm:h-[118px] sm:w-[118px]',
  centerTextSize = 28,
}: ProgressWheelProps) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)))
  const size = 120
  const strokeWidth = 9
  const center = size / 2
  const radius = center - strokeWidth / 2
  const progressGap = 100 - safeValue

  return (
    <div
      className={`flex w-fit flex-col items-center gap-2 text-center ${className}`}
      aria-label={`${label}: ${safeValue}%`}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className={`${svgClassName} overflow-visible drop-shadow-[0_0_18px_rgba(34,211,238,0.25)]`}
        role="img"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(8, 16, 24, 0.72)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#22d3ee"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${safeValue} ${progressGap}`}
          pathLength={100}
          transform={`rotate(-90 ${center} ${center})`}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          className="fill-white"
          fontSize={centerTextSize}
          fontWeight={900}
        >
          {safeValue}%
        </text>
      </svg>
      {showLabel ? (
        <p className="max-w-24 text-[10px] font-semibold uppercase leading-4 tracking-[0.18em] text-white/75 sm:max-w-28">
          {label}
        </p>
      ) : null}
    </div>
  )
}
