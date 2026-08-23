'use client'

import Image from 'next/image'
import { useState } from 'react'
import AppHamburgerMenu from '../components/app-hamburger-menu'
import FeatureGuideTour from '../components/feature-guide-tour'
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

const contests = [
  {
    title: 'Best Painted Unit',
    text: 'Showcase the best painted unit on your desk.',
    meta: 'Ends Jun 21 - 112 entries',
  },
  {
    title: 'Best Base',
    text: 'Create a base that brings the miniature to life.',
    meta: 'Ends Jun 18 - 66 entries',
  },
  {
    title: 'Beginner Challenge',
    text: 'A welcoming contest for newer painters.',
    meta: 'Ends Jun 30 - 71 entries',
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
    const guide = communityFeatureGuides[index]
    if (guide?.uid === 'community.tabs.news') {
      setActiveTab('news')
    }
    if (
      guide?.uid === 'community.tabs.contests' ||
      guide?.uid === 'community.hero' ||
      guide?.uid === 'community.primary_list' ||
      guide?.uid === 'community.secondary_list'
    ) {
      setActiveTab('contests')
    }
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
          onHelp={() => showGuideAt(0)}
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
              Math.min(
                communityFeatureGuides.length - 1,
                (activeGuideIndex ?? 0) + 1
              )
            )
          }
          onPrevious={() => showGuideAt(Math.max(0, (activeGuideIndex ?? 0) - 1))}
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
        title="Golden Obsidian Showcase"
        text="Show us your most heroic miniature worthy of the Golden Obsidian."
        action="Enter now"
        image="/onboarding/pains/fragmentation.jpeg"
      />

      <SectionCard title="Open Challenges" action="View all">
        {contests.map((contest) => (
          <ChallengeRow key={contest.title} contest={contest} />
        ))}
      </SectionCard>

      <SectionCard title="Your Nominations" action="View all">
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
      <HeroCard
        eyebrow="Featured Story"
        title="Obsidian 2.8 Update"
        text="New tools, smarter painting workflows, and community-requested features."
        action="Read more"
        image="/onboarding/pains/scheme-loss.jpeg"
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {['App', 'Hobby', 'Paints', 'Creators', 'Releases'].map((tag) => (
          <button
            key={tag}
            type="button"
            className="shrink-0 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-white/52 transition hover:border-cyan-300/45 hover:text-cyan-300"
          >
            {tag}
          </button>
        ))}
      </div>

      <SectionCard title="Latest News" action="View all">
        {newsItems.map((item) => (
          <NewsRow key={item.title} item={item} />
        ))}
      </SectionCard>

      <CreatorSpotlight />

      <ForYouCard />
    </section>
  )
}

function HeroCard({
  action,
  eyebrow,
  image,
  text,
  title,
}: {
  action: string
  eyebrow: string
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
          <button
            type="button"
            className="mt-4 h-10 w-fit rounded-[8px] bg-cyan-300 px-4 text-xs font-black text-black"
          >
            {action}
          </button>
        </div>
      </div>
    </article>
  )
}

function SectionCard({
  action,
  children,
  title,
}: {
  action: string
  children: React.ReactNode
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
        <button
          type="button"
          className="text-[10px] font-black text-cyan-300 transition hover:text-cyan-200"
        >
          {action}
        </button>
      </div>
      <div className="divide-y divide-white/[0.06]">{children}</div>
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

function ChallengeRow({ contest }: { contest: (typeof contests)[number] }) {
  return (
    <article
      className="grid grid-cols-[48px_1fr_auto] items-center gap-3 px-4 py-3"
      data-v3-community-indicator="challenge-row"
    >
      <span className="grid h-10 w-10 place-items-center rounded-[8px] border border-cyan-300/20 bg-cyan-300/8 text-cyan-300">
        #
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
    </article>
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
      className="grid grid-cols-[88px_1fr] gap-4 rounded-[8px] border border-white/[0.06] bg-[#111821] p-4"
      data-v3-community-indicator="spotlight-card"
    >
      <span className="relative h-20 w-20 overflow-hidden rounded-full border border-cyan-300/20 bg-black">
        <Image
          src="/curator/the-curator.png"
          alt=""
          fill
          sizes="80px"
          className="object-cover"
        />
      </span>
      <span className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/28">
          Creator Spotlight
        </p>
        <h2 className="mt-2 text-lg font-black">Duncan Rhodes</h2>
        <p className="mt-1 text-xs font-semibold leading-5 text-white/50">
          Painter, author, educator. A conversation about teaching, creativity,
          and miniature painting.
        </p>
        <button type="button" className="mt-3 text-xs font-black text-cyan-300">
          Read interview
        </button>
      </span>
    </article>
  )
}

function ForYouCard() {
  return (
    <article
      className="grid grid-cols-[88px_1fr] gap-4 rounded-[8px] border border-white/[0.06] bg-[#111821] p-4"
      data-v3-community-indicator="for-you-card"
    >
      <span className="relative h-24 overflow-hidden rounded-[8px] bg-black">
        <Image
          src="/onboarding/pains/paint-management.jpeg"
          alt=""
          fill
          sizes="88px"
          className="object-cover"
        />
      </span>
      <span className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/28">
          For You
        </p>
        <h2 className="mt-2 text-base font-black">Weathered Metal Guide</h2>
        <p className="mt-1 text-xs font-semibold leading-5 text-white/50">
          This guide matches paints in your collection.
        </p>
        <button type="button" className="mt-3 text-xs font-black text-cyan-300">
          See guide
        </button>
      </span>
    </article>
  )
}
