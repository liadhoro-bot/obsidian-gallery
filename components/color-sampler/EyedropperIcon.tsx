export default function EyedropperIcon({
  className = 'h-4 w-4',
}: {
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m14 5 5 5" />
      <path d="M6 19h3.5L19 9.5 14.5 5 5 14.5V18a1 1 0 0 0 1 1Z" />
      <path d="m12 7 5 5" />
    </svg>
  )
}
