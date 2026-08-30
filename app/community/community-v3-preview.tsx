'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import AppHamburgerMenu from '../components/app-hamburger-menu'
import FeatureGuideTour from '../components/feature-guide-tour'
import { findVisibleFeatureGuideIndex } from '../components/feature-guide-navigation'
import { communityFeatureGuides } from '../components/feature-guide-presets'
import V3PerfIndicator from '../components/v3-perf-indicator'
import styles from './community-v3-silver.module.css'

type CommunityTab = 'contests' | 'news'

const tabs: Array<{ id: CommunityTab; label: string }> = [
  { id: 'contests', label: 'Contests' },
  { id: 'news', label: 'News' },
]

const newsItems = [
  {
    title: 'New Vallejo Xpress Colors',
    text: 'New high-pigment acrylics are here, with a first look from the community.',
    time: '2 days ago',
    tag: 'Paints',
    image: '/onboarding/pains/paint-management.jpeg',
  },
  {
    title: 'Guide of the Week',
    text: 'Master rust and verdigris with a new step-by-step deck.',
    time: '4 days ago',
    tag: 'Guides',
    image: '/onboarding/pains/pile-of-shame.jpeg',
  },
  {
    title: 'Community Contest Winners',
    text: 'See the entries from the Summer Showcase.',
    time: '1 week ago',
    tag: 'Community',
    image: '/onboarding/pains/fragmentation.jpeg',
  },
]

const openChallenges = [
  {
    title: 'Path to Glory: Coolest Army',
    text: 'A campaign-only ranked vote for invited Path to Glory army projects.',
    meta: 'Limited seats',
    href: '/contests/path-to-glory-coolest-army',
    mark: '12',
  },
  {
    title: 'Remote Campaign Roll',
    text: 'Roll and log 1d6 or 2d6 for the active campaign table.',
    meta: 'Campaign tool',
    href: '/contests/dice-roll',
    mark: 'd6',
  },
]

export default function CommunityV3Preview() {
  const [activeTab, setActiveTab] = useState<CommunityTab>('contests')
  const [activeGuideIndex, setActiveGuideIndex] = useState<number | null>(null)
  const activeGuide =
    activeGuideIndex === null
      ? null
      : communityFeatureGuides[activeGuideIndex] ?? null

  function showGuideAt(index: number) {
    setActiveGuideIndex(index)
  }

  return (
    <main
      className={styles.communitySilver}
      data-v3-community-indicator="root"
    >
      <V3PerfIndicator surface="community" detail={activeTab} />
      <div
        className="mx-auto flex w-full max-w-md flex-col gap-3 px-3 pb-28 pt-6"
        data-v3-community-indicator="content"
      >
        <TopNav
          isHelpOpen={activeGuide !== null}
          onHelp={() =>
            showGuideAt(
              findVisibleFeatureGuideIndex(communityFeatureGuides, null, 1) ?? 0
            )
          }
        />

        <Tabs activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'contests' ? <ContestsTab /> : null}
        {activeTab === 'news' ? <NewsTab /> : null}
      </div>

      {activeGuide ? (
        <FeatureGuideTour
          activeIndex={activeGuideIndex ?? 0}
          guide={activeGuide}
          onClose={() => setActiveGuideIndex(null)}
          onNext={() =>
            showGuideAt(
              findVisibleFeatureGuideIndex(
                communityFeatureGuides,
                activeGuideIndex,
                1
              ) ??
                activeGuideIndex ??
                0
            )
          }
          onPrevious={() =>
            showGuideAt(
              findVisibleFeatureGuideIndex(
                communityFeatureGuides,
                activeGuideIndex,
                -1
              ) ??
                activeGuideIndex ??
                0
            )
          }
          totalGuides={communityFeatureGuides.length}
        />
      ) : null}
    </main>
  )
}

function TopNav({
  isHelpOpen,
  onHelp,
}: {
  isHelpOpen: boolean
  onHelp: () => void
}) {
  return (
    <header data-v3-community-indicator="app-header">
      <AppHamburgerMenu
        data-v3-community-indicator="menu-control"
        aria-label="Open community menu"
      />

      <h1
        data-v3-community-indicator="app-title"
        data-feature-guide-target="community.page"
      >
        Community
      </h1>

      <div data-v3-community-indicator="app-header-actions">
        <button
          type="button"
          aria-expanded={isHelpOpen}
          aria-label="Show community explanation"
          data-feature-guide-launcher-button="true"
          onClick={onHelp}
        >
          ?
        </button>
        <a href="/settings?preview=1" aria-label="Profile">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
            <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.8 1.8 0 0 0 15 19.45a1.8 1.8 0 0 0-1 .55 1.8 1.8 0 0 0-.5 1.3V21a2 2 0 0 1-4 0v-.09a1.8 1.8 0 0 0-.5-1.3 1.8 1.8 0 0 0-1-.55 1.8 1.8 0 0 0-1.98.36l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.8 1.8 0 0 0 3.55 15a1.8 1.8 0 0 0-.55-1 1.8 1.8 0 0 0-1.3-.5H1.5a2 2 0 0 1 0-4h.2A1.8 1.8 0 0 0 3 9a1.8 1.8 0 0 0 .55-1 1.8 1.8 0 0 0-.36-1.98l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.8 1.8 0 0 0 8 3.55a1.8 1.8 0 0 0 1-.55 1.8 1.8 0 0 0 .5-1.3V1.5a2 2 0 0 1 4 0v.2A1.8 1.8 0 0 0 14 3a1.8 1.8 0 0 0 1 .55 1.8 1.8 0 0 0 1.98-.36l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.8 1.8 0 0 0 19.45 8a1.8 1.8 0 0 0 .55 1 1.8 1.8 0 0 0 1.3.5h.2a2 2 0 0 1 0 4h-.2a1.8 1.8 0 0 0-1.3.5 1.8 1.8 0 0 0-.6 1Z" />
          </svg>
        </a>
      </div>
    </header>
  )
}

function Tabs({
  activeTab,
  onTabChange,
}: {
  activeTab: CommunityTab
  onTabChange: (tab: CommunityTab) => void
}) {
  return (
    <div
      className="grid grid-cols-2"
      role="tablist"
      aria-label="Community sections"
      data-v3-community-indicator="tabs"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          data-feature-guide-target={`community.tabs.${tab.id}`}
          className="capitalize transition"
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function ContestsTab() {
  return (
    <section className="grid gap-4">
      <HeroCard
        eyebrow="Featured Contest"
        title="Best Painting Guide"
        text="Nominate a guide that teaches clearly, photographs the process, and helps another painter level up."
        action="Open contest"
        href="/contests/best-painting-guide"
        image="/onboarding/pains/pile-of-shame.jpeg"
      />

      <SectionCard title="Open Challenges">
        {openChallenges.map((contest) => (
          <ChallengeRow key={contest.title} contest={contest} />
        ))}
      </SectionCard>

      <SectionCard title="Your Nominations" preview>
        <SavedEntry
          title="My Entry: Ultramarines Veterans"
          meta="Submitted - Summer Showcase"
          button="View entry"
          image="/onboarding/first-project-bg.jpeg"
        />
        <SavedEntry
          title="Saved: Imperial Fist Repulsor"
          meta="Saved - Best Painted Vehicle"
          button="Continue"
          image="/onboarding/pains/paint-management.jpeg"
        />
      </SectionCard>
    </section>
  )
}

function NewsTab() {
  return (
    <section className="grid gap-4">
      <V3LaunchHero />

      <SectionCard title="Latest News" action="View all" preview>
        {newsItems.map((item) => (
          <NewsRow key={item.title} item={item} />
        ))}
      </SectionCard>

      <CreatorSpotlight />

      <ForYouCard />
    </section>
  )
}

function V3LaunchHero() {
  return (
    <article
      data-v3-community-indicator="launch-hero"
      data-feature-guide-target="community.hero"
    >
      <div className="relative h-40" data-v3-community-indicator="launch-hero-photo">
        <Image
          src="/onboarding/welcome-hero.jpeg"
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 448px"
          className="object-cover"
        />
        <span data-v3-community-indicator="launch-hero-tag">News Update</span>
      </div>

      <div data-v3-community-indicator="launch-hero-body">
        <p data-v3-community-indicator="launch-hero-eyebrow">Obsidian Gallery V3</p>
        <h2 data-v3-community-indicator="launch-hero-title">V3 is Live</h2>
        <p data-v3-community-indicator="launch-hero-subtitle">
          More than just a fresh coat of paint.
        </p>
        <span data-v3-community-indicator="launch-hero-divider" aria-hidden="true" />
        <p data-v3-community-indicator="launch-hero-text">
          Rebuilt with richer materials, sharper flows, and a smoother experience,
          from the dashboard to quicker unit and guide forges.
        </p>

        <div data-v3-community-indicator="launch-hero-features">
          <div data-v3-community-indicator="launch-hero-feature">
            <span data-v3-community-indicator="launch-hero-feature-icon">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
              </svg>
            </span>
            <p data-v3-community-indicator="launch-hero-feature-title">New UI</p>
            <p data-v3-community-indicator="launch-hero-feature-text">
              Worktable-inspired walnut, parchment, brass &amp; glass.
            </p>
          </div>

          <div data-v3-community-indicator="launch-hero-feature">
            <span data-v3-community-indicator="launch-hero-feature-icon">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 7h4l3 10h4l3-10h4" />
                <path d="M17 4l3 3-3 3" />
              </svg>
            </span>
            <p data-v3-community-indicator="launch-hero-feature-title">Better Flows</p>
            <p data-v3-community-indicator="launch-hero-feature-text">
              Built around your next goal, with a clearer path to it.
            </p>
          </div>

          <div data-v3-community-indicator="launch-hero-feature">
            <span data-v3-community-indicator="launch-hero-feature-icon">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 15a8 8 0 1 1 16 0" />
                <path d="M12 15l4-5" />
              </svg>
            </span>
            <p data-v3-community-indicator="launch-hero-feature-title">Smoother Feel</p>
            <p data-v3-community-indicator="launch-hero-feature-text">
              Cleaner pages, faster loads, a more intuitive process.
            </p>
          </div>
        </div>
      </div>

      <span data-v3-community-indicator="launch-hero-badge">Live Now</span>
    </article>
  )
}

function HeroCard({
  action,
  eyebrow,
  href,
  image,
  text,
  title,
}: {
  action: string
  eyebrow: string
  href?: string
  image: string
  text: string
  title: string
}) {
  return (
    <article
      className="overflow-hidden rounded-[8px] border border-white/[0.06] bg-[#111821]"
      data-v3-community-indicator="hero-card"
      data-feature-guide-target="community.hero"
    >
      <div className="relative h-52 bg-black">
        <Image
          src={image}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 448px"
          className="object-cover opacity-72"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/56 to-black/14" />
        <div className="absolute inset-0 flex flex-col justify-end p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
            {eyebrow}
          </p>
          <h2 className="mt-2 max-w-[15rem] text-2xl font-black leading-tight">
            {title}
          </h2>
          <p className="mt-2 max-w-[16rem] text-sm font-semibold leading-5 text-white/62">
            {text}
          </p>
          {href ? (
            <Link
              href={href}
              className="mt-4 h-10 w-fit rounded-[8px] bg-cyan-300 px-4 text-xs font-black text-black"
              data-v3-community-indicator="hero-action"
            >
              {action}
            </Link>
          ) : (
            <button
              type="button"
              className="mt-4 h-10 w-fit rounded-[8px] bg-cyan-300 px-4 text-xs font-black text-black"
            >
              {action}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

function SectionCard({
  action,
  children,
  href,
  preview = false,
  title,
}: {
  action?: string
  children: React.ReactNode
  href?: string
  preview?: boolean
  title: string
}) {
  const featureTarget =
    title === 'Open Challenges' || title === 'Latest News'
      ? 'community.primary_list'
      : 'community.secondary_list'

  return (
    <section
      className="overflow-hidden rounded-[8px] border border-white/[0.06] bg-[#111821]"
      data-v3-community-indicator="section-card"
      data-feature-guide-target={featureTarget}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-white/28">
          {title}
        </h2>
        {preview && action ? (
          <span className="text-[10px] font-black text-white/20">{action}</span>
        ) : href && action ? (
          <Link
            href={href}
            className="text-[10px] font-black text-cyan-300 transition hover:text-cyan-200"
          >
            {action}
          </Link>
        ) : action ? (
          <button
            type="button"
            className="text-[10px] font-black text-cyan-300 transition hover:text-cyan-200"
          >
            {action}
          </button>
        ) : null}
      </div>
      <div
        className={
          preview
            ? 'pointer-events-none select-none divide-y divide-white/[0.06] blur-[5px]'
            : 'divide-y divide-white/[0.06]'
        }
        aria-hidden={preview || undefined}
      >
        {children}
      </div>
    </section>
  )
}

function NewsRow({ item }: { item: (typeof newsItems)[number] }) {
  return (
    <article
      className="grid grid-cols-[64px_1fr_auto] items-center gap-3 px-4 py-3"
      data-v3-community-indicator="news-row"
    >
      <span className="relative h-14 w-16 overflow-hidden rounded-[8px] bg-black">
        <Image src={item.image} alt="" fill sizes="64px" className="object-cover" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black">{item.title}</span>
        <span className="mt-1 line-clamp-2 text-xs font-semibold leading-4 text-white/45">
          {item.text}
        </span>
      </span>
      <span className="text-right text-[10px] font-black text-white/34">
        {item.time}
      </span>
    </article>
  )
}

function ChallengeRow({ contest }: { contest: (typeof openChallenges)[number] }) {
  return (
    <Link
      href={contest.href}
      className="grid grid-cols-[48px_1fr_auto] items-center gap-3 px-4 py-3"
      data-v3-community-indicator="challenge-row"
    >
      <span className="grid h-10 w-10 place-items-center rounded-[8px] border border-cyan-300/20 bg-cyan-300/8 text-cyan-300">
        {contest.mark}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black">{contest.title}</span>
        <span className="mt-1 block truncate text-xs font-semibold text-white/42">
          {contest.text}
        </span>
      </span>
      <span className="text-right text-[10px] font-black text-white/40">
        {contest.meta}
      </span>
    </Link>
  )
}

function SavedEntry({
  button,
  image,
  meta,
  title,
}: {
  button: string
  image: string
  meta: string
  title: string
}) {
  return (
    <article
      className="grid grid-cols-[74px_1fr_auto] items-center gap-3 px-4 py-3"
      data-v3-community-indicator="saved-entry"
    >
      <span className="relative h-14 w-[74px] overflow-hidden rounded-[8px] bg-black">
        <Image src={image} alt="" fill sizes="74px" className="object-cover" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black">{title}</span>
        <span className="mt-1 block truncate text-[10px] font-semibold text-white/40">
          {meta}
        </span>
      </span>
      <button
        type="button"
        className="h-9 rounded-[8px] border border-cyan-300/28 bg-cyan-300/10 px-3 text-[10px] font-black text-cyan-300"
      >
        {button}
      </button>
    </article>
  )
}

function CreatorSpotlight() {
  return (
    <article
      className="rounded-[8px] border border-white/[0.06] bg-[#111821] p-4"
      data-v3-community-indicator="spotlight-card"
    >
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/28">
        Creator Spotlight
      </p>
      <div
        className="pointer-events-none mt-3 grid grid-cols-[88px_1fr] gap-4 select-none blur-[5px]"
        aria-hidden="true"
      >
        <span
          className="relative h-20 w-20 overflow-hidden rounded-full"
          data-v3-community-indicator="spotlight-photo"
        >
          <Image
            src="/curator/the-curator.png"
            alt=""
            fill
            sizes="80px"
            className="object-cover"
          />
        </span>
        <span className="min-w-0">
          <h2 className="text-lg font-black">Duncan Rhodes</h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-white/50">
            Painter, author, educator. A conversation about teaching,
            creativity, and miniature painting.
          </p>
          <span className="mt-3 block text-xs font-black text-cyan-300">
            Read interview
          </span>
        </span>
      </div>
    </article>
  )
}

function ForYouCard() {
  return (
    <article
      className="rounded-[8px] border border-white/[0.06] bg-[#111821] p-4"
      data-v3-community-indicator="for-you-card"
    >
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/28">
        For You
      </p>
      <div
        className="pointer-events-none mt-3 grid grid-cols-[88px_1fr] gap-4 select-none blur-[5px]"
        aria-hidden="true"
      >
        <span
          className="relative h-24 overflow-hidden rounded-[8px]"
          data-v3-community-indicator="for-you-photo"
        >
          <Image
            src="/onboarding/pains/paint-management.jpeg"
            alt=""
            fill
            sizes="88px"
            className="object-cover"
          />
        </span>
        <span className="min-w-0">
          <h2 className="text-base font-black">Weathered Metal Guide</h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-white/50">
            This guide matches paints in your collection.
          </p>
          <span className="mt-3 block text-xs font-black text-cyan-300">
            See guide
          </span>
        </span>
      </div>
    </article>
  )
}
