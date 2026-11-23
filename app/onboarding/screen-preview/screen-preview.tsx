'use client'

import styles from '../../auth-flow-silver.module.css'
import CuratorBridgeScreen from '../components/screens/curator-bridge-screen'
import FirstProjectScreen from '../components/screens/first-project-screen'
import GoalScreen from '../components/screens/goal-screen'
import GuideCreationScreen from '../components/screens/guide-creation-screen'
import LegalScreen from '../components/screens/legal-screen'
import NotificationsScreen from '../components/screens/notifications-screen'
import type { PreviewScreen } from './screens'

const noop = () => {}

export default function ScreenPreview({ screen }: { screen: PreviewScreen }) {
  return (
    <main className={styles.onboardingRoot}>
      <div className={styles.onboardingViewport}>
        {screen === 'terms' ? <LegalScreen previewMode shouldPersistAcceptance={false} onAccepted={noop} /> : null}
        {screen === 'goal' ? <GoalScreen previewMode onContinue={noop} /> : null}
        {screen === 'first_unit' ? <FirstProjectScreen previewMode onCreated={noop} onSkip={noop} /> : null}
        {screen === 'first_guide' ? <GuideCreationScreen previewMode onCreated={noop} onSkip={noop} /> : null}
        {screen === 'notifications' ? <NotificationsScreen preview="live" onDone={noop} /> : null}
        {screen === 'notifications_proposed' ? <NotificationsScreen preview="proposed" onDone={noop} /> : null}
        {screen === 'curator' ? <CuratorBridgeScreen onEnter={noop} /> : null}
      </div>
    </main>
  )
}
