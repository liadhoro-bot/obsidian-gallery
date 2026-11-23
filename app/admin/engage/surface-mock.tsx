'use client'

import { useState } from 'react'
import { PopupView, TopperView } from '../../components/engage/engage-surfaces'
import type { RenderedMessage } from '../../../lib/engage/types'
import styles from './surface-mock.module.css'

// How a message looks where users meet it: popups and toppers are the real
// app components (engage-surfaces) on a stand-in dashboard; pushes sit on a
// phone lock screen; email is a plain letter.

const noop = () => {}
const NAV = ['Dashboard', 'Projects', 'Paints', 'Guides', 'Community']

function Phone({ children }: { children: React.ReactNode }) {
  return <div className={styles.phone}>{children}</div>
}

function StatusBar({ light = true }: { light?: boolean }) {
  return (
    <div className={styles.statusBar} style={light ? undefined : { color: '#fff' }}>
      <span>16:00</span>
      <span>▲ ◼ ▮</span>
    </div>
  )
}

function StandInDashboard() {
  return (
    <>
      <StatusBar />
      <div className={styles.app} aria-hidden>
        <p className={styles.appTitle}>Dashboard</p>
        <div className={styles.appCard} />
        <div className={`${styles.appCard} ${styles.appCardShort}`} />
        <div className={styles.appCard} />
      </div>
      <nav className={styles.nav} aria-hidden>
        {NAV.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </nav>
    </>
  )
}

function PushMock({ rendered }: { rendered: RenderedMessage }) {
  const [os, setOs] = useState<'android' | 'iphone'>('android')
  const card = os === 'android' ? styles.androidCard : styles.iosCard
  return (
    <div>
      <div className={styles.toggle}>
        {(['android', 'iphone'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setOs(value)}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
              os === value ? 'border-cyan-300/60 bg-cyan-300/20 text-cyan-50' : 'border-white/15 text-white/50'
            }`}
          >
            {value === 'android' ? 'Android' : 'iPhone'}
          </button>
        ))}
      </div>
      <Phone>
        <div className={styles.lock}>
          <StatusBar light={false} />
          <div className={styles.lockTime}>16:00</div>
          <div className={styles.lockDate}>Monday, 23 November</div>
          <div className={card}>
            <div className={styles.cardHead}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-192.png" alt="" className={styles.cardIcon} />
              <span>{os === 'android' ? 'Obsidian Gallery · now' : 'OBSIDIAN GALLERY'}</span>
              {os === 'iphone' ? <span style={{ marginLeft: 'auto' }}>now</span> : null}
            </div>
            <div className={styles.cardTitle}>{rendered.title}</div>
            <div className={styles.cardBody}>{rendered.body}</div>
          </div>
        </div>
      </Phone>
    </div>
  )
}

export default function SurfaceMock({ rendered }: { rendered: RenderedMessage }) {
  if (rendered.surface === 'push') return <PushMock rendered={rendered} />

  if (rendered.surface === 'email') {
    return (
      <div className="rounded-2xl bg-[#f6f1e7] p-4 text-[#2a2118]">
        <div className="text-[0.7rem] text-[#7a6a55]">Subject</div>
        <div className="font-bold">{rendered.title}</div>
        <p className="mt-2 text-sm leading-snug">{rendered.body}</p>
        <span className="mt-3 inline-block rounded-lg bg-[#b08a3e] px-3 py-1.5 text-sm font-bold text-[#1d160e]">
          {rendered.ctaLabel}
        </span>
      </div>
    )
  }

  const shown = { ...rendered, isPreview: false }
  return (
    <Phone>
      <StandInDashboard />
      {rendered.surface === 'topper' ? (
        <TopperView message={shown} onAct={noop} onDismiss={noop} />
      ) : (
        <PopupView message={shown} onAct={noop} onDismiss={noop} modal={false} />
      )}
    </Phone>
  )
}
