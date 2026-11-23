'use client'

import { useState } from 'react'
import {
  OgDialog,
  OgDialogAction,
  OgDialogCheckbox,
  OgDialogField,
  OgDialogRow,
  OgDialogSelect,
} from '@/src/components/v3'
import { CalendarIcon, ClockIcon } from '../paint-mode/paint-mode-icons'
import styles from '../paint-mode/paint-mode-og.module.css'

function NoteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" />
      <path d="M8 9h6M8 13h4" />
      <path d="m15.5 15.5 5-5-2-2-5 5-.5 2.5z" />
    </svg>
  )
}

function CalendarPlusIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4M12 12.5v5M9.5 15h5" />
    </svg>
  )
}

type Demo = 'schedule' | 'simple' | 'confirm' | null

export default function DialogDemo() {
  const [open, setOpen] = useState<Demo>(null)
  const [addToSchedule, setAddToSchedule] = useState(true)
  const close = () => setOpen(null)

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <div className={styles.sheetActions}>
          <button type="button" className={styles.actionButton} data-variant="primary" onClick={() => setOpen('schedule')}>
            Schedule dialog (fields)
          </button>
          <button type="button" className={styles.actionButton} onClick={() => setOpen('simple')}>
            Simple dialog (image + CTA)
          </button>
          <button type="button" className={styles.actionButton} onClick={() => setOpen('confirm')}>
            Confirm dialog (no image)
          </button>
        </div>
      </div>

      <OgDialog
        open={open === 'schedule'}
        onClose={close}
        title="Schedule Painting Session"
        subtitle="Plan your next painting time and keep the momentum going."
        image={{ src: '/onboarding/welcome-hero.jpeg', alt: '' }}
        onSubmit={(event) => {
          event.preventDefault()
          close()
        }}
        actions={
          <OgDialogAction type="submit" icon={<CalendarPlusIcon />}>
            Schedule Session
          </OgDialogAction>
        }
      >
        <OgDialogRow>
          <OgDialogField label="Date & Time" icon={<CalendarIcon size={20} />} type="datetime-local" defaultValue="2026-11-21T20:30" />
          <OgDialogSelect label="Duration" icon={<ClockIcon size={20} />} defaultValue="90">
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
            <option value="90">1 hour 30 minutes</option>
            <option value="120">2 hours</option>
          </OgDialogSelect>
        </OgDialogRow>
        <OgDialogField label="Session Goal" labelNote="(Optional)" icon={<NoteIcon />} placeholder="e.g. Finish basecoats and start highlights..." />
        <OgDialogCheckbox
          label="Add to my painting schedule"
          description="I'll see it in Upcoming Sessions and get a reminder."
          checked={addToSchedule}
          onChange={(event) => setAddToSchedule(event.target.checked)}
        />
      </OgDialog>

      <OgDialog
        open={open === 'simple'}
        onClose={close}
        title="Unit Complete"
        subtitle="The Gaunt Summoner is ready for the table."
        image={{ src: '/onboarding/pains/scheme-loss.jpeg', alt: 'The finished miniature' }}
        actions={<OgDialogAction onClick={close}>Share to Gallery</OgDialogAction>}
      />

      <OgDialog
        open={open === 'confirm'}
        onClose={close}
        title="Discard Changes?"
        subtitle="Your edits to this guide have not been saved."
        actions={
          <>
            <OgDialogAction variant="danger" onClick={close}>Discard</OgDialogAction>
            <OgDialogAction variant="secondary" onClick={close}>Keep editing</OgDialogAction>
          </>
        }
      />
    </main>
  )
}
