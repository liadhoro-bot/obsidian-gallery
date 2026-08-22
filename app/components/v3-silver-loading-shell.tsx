import type { CSSProperties } from 'react'

type V3SilverLoadingShellProps = {
  title: string
  tabs?: string[]
  cardCount?: number
}

const workbenchStyle: CSSProperties = {
  backgroundColor: 'var(--og-bg-workbench)',
  backgroundImage: 'var(--og-material-walnut-board)',
  backgroundPosition: 'center, center, center, center',
  backgroundRepeat: 'no-repeat, no-repeat, repeat, no-repeat',
  backgroundSize: '100% 100%, 100% 100%, 900px auto, 100% 100%',
  color: 'var(--og-text-primary)',
  fontFamily: 'var(--og-font-ui)',
}

const headerStyle: CSSProperties = {
  border: 'var(--og-border-width) solid color-mix(in srgb, var(--og-brass-700) 82%, var(--og-ink-950))',
  borderTop: 0,
  borderRadius: '0 0 var(--og-radius-m) var(--og-radius-m)',
  backgroundColor: 'var(--og-walnut-950)',
  backgroundImage: 'var(--og-material-walnut-control)',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat, repeat, no-repeat',
  backgroundSize: '100% 100%, 280px auto, 100% 100%',
  boxShadow: 'var(--og-shadow-walnut-control)',
}

const controlStyle: CSSProperties = {
  border: 'var(--og-border-width) solid color-mix(in srgb, var(--og-brass-700) 84%, var(--og-ink-950))',
  borderRadius: 'var(--og-radius-round)',
  backgroundColor: 'var(--og-walnut-950)',
  backgroundImage: 'var(--og-material-ebonized-control)',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat, repeat, no-repeat',
  backgroundSize: '100% 100%, 180px auto, 100% 100%',
  boxShadow: 'var(--og-shadow-control-built)',
}

const controlRingStyle: CSSProperties = {
  inset: 2,
  border: '2px solid color-mix(in srgb, var(--og-brass-500) 68%, var(--og-walnut-950))',
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--og-paper-50) 14%, transparent)',
}

const tabBandStyle: CSSProperties = {
  border: 'var(--og-border-width) solid color-mix(in srgb, var(--og-brass-700) 76%, var(--og-ink-950))',
  borderRadius: 'var(--og-radius-l)',
  backgroundColor: 'var(--og-walnut-950)',
  backgroundImage: 'var(--og-material-dark-inset)',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat, repeat, no-repeat',
  backgroundSize: '100% 100%, 180px auto, 100% 100%',
  boxShadow: 'var(--og-shadow-pressed), var(--og-shadow-contact)',
}

const activeTabStyle: CSSProperties = {
  backgroundColor: 'var(--og-surface-primary)',
  backgroundImage: 'var(--og-material-paper-card)',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat, repeat, no-repeat',
  backgroundSize: '100% 100%, 220px auto, 100% 100%',
  boxShadow:
    'inset 0 1px 0 color-mix(in srgb, var(--og-paper-50) 32%, transparent), 0 1px 2px color-mix(in srgb, var(--og-walnut-950) 36%, transparent)',
}

const parchmentStyle: CSSProperties = {
  border: 'var(--og-border-width) solid color-mix(in srgb, var(--og-brass-700) 58%, var(--og-border-subtle))',
  borderRadius: 'var(--og-radius-m)',
  backgroundColor: 'var(--og-surface-primary)',
  backgroundImage: 'var(--og-material-parchment-panel)',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat, repeat, no-repeat',
  backgroundSize: '100% 100%, 220px auto, 100% 100%',
  boxShadow: 'var(--og-shadow-constructed-card)',
}

const photoMountStyle: CSSProperties = {
  border: 'var(--og-border-width) solid color-mix(in srgb, var(--og-brass-700) 66%, var(--og-ink-950))',
  borderRadius: 'var(--og-radius-m)',
  backgroundColor: 'var(--og-surface-primary)',
  backgroundImage: 'var(--og-material-paper-card)',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat, repeat, no-repeat',
  backgroundSize: '100% 100%, 240px auto, 100% 100%',
  boxShadow: 'var(--og-shadow-photo-mount)',
}

const darkInsetStyle: CSSProperties = {
  backgroundColor: 'var(--og-bg-recess)',
  backgroundImage: 'var(--og-material-dark-inset)',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat, repeat, no-repeat',
  backgroundSize: '100% 100%, 180px auto, 100% 100%',
}

function HeaderControl() {
  return (
    <span
      aria-hidden="true"
      className="relative inline-grid h-10 w-10 place-items-center overflow-hidden"
      style={controlStyle}
    >
      <span className="absolute rounded-full" style={controlRingStyle} />
      <span className="h-3 w-3 rounded-full bg-[color:var(--og-brass-500)] opacity-70" />
    </span>
  )
}

function SkeletonLine({
  className,
  dark = false,
}: {
  className: string
  dark?: boolean
}) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-full ${className}`}
      style={{
        background: dark
          ? 'color-mix(in srgb, var(--og-paper-50) 12%, transparent)'
          : 'color-mix(in srgb, var(--og-walnut-700) 18%, transparent)',
      }}
    />
  )
}

export function V3SilverLoadingShell({
  title,
  tabs = ['Active', 'Progress'],
  cardCount = 3,
}: V3SilverLoadingShellProps) {
  return (
    <main className="min-h-screen" style={workbenchStyle}>
      <div className="mx-auto flex w-full max-w-[var(--og-workbench-compact-max-width)] flex-col gap-3 px-[14px] pb-[calc(74px+env(safe-area-inset-bottom))]">
        <header
          className="relative flex min-h-[62px] items-center justify-between gap-2 overflow-hidden px-[14px] pb-[7px] pt-2"
          style={headerStyle}
        >
          <HeaderControl />

          <h1 className="absolute inset-x-0 mx-auto w-fit whitespace-nowrap text-center font-[var(--og-font-display)] text-[1.76rem] font-semibold leading-[var(--og-leading-title)] text-[color:var(--og-paper-50)]">
            {title}
          </h1>

          <div className="relative z-[1] flex items-center justify-end gap-2">
            <HeaderControl />
            <HeaderControl />
          </div>
        </header>

        <section className="animate-pulse pt-2">
          <div className="grid min-h-[42px] grid-cols-2 gap-1 p-[5px]" style={tabBandStyle}>
            {tabs.slice(0, 2).map((tab, index) => (
              <div
                key={tab}
                className="grid min-h-[30px] place-items-center rounded-[var(--og-radius-m)] font-[var(--og-font-display)] text-[0.98rem] font-semibold"
                style={
                  index === 0
                    ? activeTabStyle
                    : { color: 'var(--og-paper-200)' }
                }
              >
                {tab}
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-3">
          {Array.from({ length: cardCount }).map((_, index) => (
            <article
              key={index}
              className="grid gap-3 overflow-hidden p-3"
              style={parchmentStyle}
            >
              <div className="h-[112px] overflow-hidden rounded-[var(--og-radius-s)] p-2" style={photoMountStyle}>
                <div className="h-full rounded-[var(--og-radius-xs)]" style={darkInsetStyle} />
              </div>

              <div className="space-y-2">
                <SkeletonLine className="h-4 w-3/5" />
                <SkeletonLine className="h-3 w-4/5" />
                <div className="flex items-center justify-between gap-3 pt-1">
                  <SkeletonLine className="h-5 w-20" />
                  <SkeletonLine className="h-5 w-16" />
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}

export function V3SilverUnitLoadingShell() {
  return (
    <main className="min-h-screen" style={workbenchStyle}>
      <div className="mx-auto flex w-full max-w-[var(--og-workbench-compact-max-width)] flex-col gap-4 px-4 pb-24">
        <section
          className="relative min-h-[292px] overflow-hidden rounded-b-[var(--og-radius-l)] p-4"
          style={{
            ...darkInsetStyle,
            border: 'var(--og-border-width) solid color-mix(in srgb, var(--og-brass-700) 76%, var(--og-ink-950))',
            borderTop: 0,
            boxShadow:
              'var(--og-shadow-large), inset 0 -28px 38px color-mix(in srgb, var(--og-ink-950) 24%, transparent)',
          }}
        >
          <div className="relative z-[1] flex items-center justify-between">
            <HeaderControl />
            <HeaderControl />
          </div>

          <div className="absolute inset-x-6 bottom-7 animate-pulse space-y-3">
            <SkeletonLine className="h-5 w-24" dark />
            <SkeletonLine className="h-8 w-52" dark />
            <SkeletonLine className="h-4 w-32" dark />
          </div>
        </section>

        <section className="animate-pulse">
          <div className="grid min-h-[42px] grid-cols-3 gap-1 p-[5px]" style={tabBandStyle}>
            {['Details', 'Paint', 'Progress'].map((tab, index) => (
              <div
                key={tab}
                className="grid min-h-[30px] place-items-center rounded-[var(--og-radius-m)] font-[var(--og-font-display)] text-[0.98rem] font-semibold"
                style={
                  index === 0
                    ? activeTabStyle
                    : { color: 'var(--og-paper-200)' }
                }
              >
                {tab}
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-3 p-4" style={parchmentStyle}>
          <SkeletonLine className="h-4 w-24" />
          <div className="grid grid-cols-3 gap-3">
            <SkeletonLine className="h-12 w-full rounded-[var(--og-radius-s)]" />
            <SkeletonLine className="h-12 w-full rounded-[var(--og-radius-s)]" />
            <SkeletonLine className="h-12 w-full rounded-[var(--og-radius-s)]" />
          </div>
        </section>
      </div>
    </main>
  )
}
