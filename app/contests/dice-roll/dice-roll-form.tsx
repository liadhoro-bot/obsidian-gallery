'use client'

import { useActionState, useState } from 'react'
import SubmitButton from '../../components/SubmitButton'
import {
  rollCampaignDice,
  type DiceRollState,
  type DiceRollType,
} from './actions'
import styles from '../../../components/contests/contest-v3-silver.module.css'

const initialDiceRollState: DiceRollState = {
  error: null,
  result: null,
}

function formatRollTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function RollResult({ state }: { state: DiceRollState }) {
  if (state.error) {
    return (
      <div className={styles.errorPanel}>
        {state.error}
      </div>
    )
  }

  if (!state.result) {
    return null
  }

  return (
    <section className={styles.resultPanel}>
      <p className={styles.eyebrow}>
        {state.result.duplicate
          ? `${state.result.rollType} already recorded`
          : `${state.result.rollType} roll recorded`}
      </p>
      <div className={styles.diceEquation}>
        <div className={styles.dieBox}>
          <div className={styles.dieValue}>{state.result.dieOne}</div>
          <div className={styles.statLabel}>
            Die 1
          </div>
        </div>
        {state.result.rollType === '2d6' && state.result.dieTwo ? (
          <>
            <div className={styles.operator}>+</div>
            <div className={styles.dieBox}>
              <div className={styles.dieValue}>{state.result.dieTwo}</div>
              <div className={styles.statLabel}>
                Die 2
              </div>
            </div>
          </>
        ) : null}
        <div className={styles.operator}>=</div>
        <div className={styles.totalBox}>
          <div className={styles.totalValue}>
            {state.result.total}
          </div>
          <div className={styles.statLabel}>
            Total
          </div>
        </div>
      </div>
      <dl className={styles.resultMetaGrid}>
        <div>
          <dt>Player</dt>
          <dd>{state.result.playerName}</dd>
        </div>
        {state.result.appUsername ? (
          <div>
            <dt>App username</dt>
            <dd>@{state.result.appUsername}</dd>
          </div>
        ) : null}
        <div>
          <dt>Reason</dt>
          <dd>{state.result.rollReason}</dd>
        </div>
        <div>
          <dt>Rolled</dt>
          <dd>{state.result.rollType}</dd>
        </div>
        <div>
          <dt>Recorded</dt>
          <dd>{formatRollTime(state.result.createdAt)}</dd>
        </div>
      </dl>
      {state.result.duplicate ? (
        <p className={styles.helperText}>
          This player name already has a roll for that reason, so the original saved result is
          shown.
        </p>
      ) : null}
    </section>
  )
}

export default function DiceRollForm() {
  const [state, formAction] = useActionState(rollCampaignDice, initialDiceRollState)
  const [rollType, setRollType] = useState<DiceRollType>('2d6')

  return (
    <div className={styles.formStack}>
      <form action={formAction} className={styles.formPanel}>
        <div className={styles.fieldGroup}>
          <span className={styles.labelText}>Roll type</span>
          <input type="hidden" name="rollType" value={rollType} />
          <div className={styles.rollTypeChooser} role="group" aria-label="Roll type">
            {(['1d6', '2d6'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={rollType === option}
                className={styles.rollTypeOption}
                onClick={() => setRollType(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.labelText} htmlFor="playerName">
            Campaign player name
          </label>
          <input
            id="playerName"
            name="playerName"
            type="text"
            minLength={2}
            maxLength={80}
            required
            autoComplete="name"
            className={styles.textInput}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.labelText} htmlFor="rollReason">
            Roll reason
          </label>
          <input
            id="rollReason"
            name="rollReason"
            type="text"
            minLength={3}
            maxLength={160}
            required
            className={styles.textInput}
            placeholder="Example: Skeleton Chariots, veteran abilities roll +2XP"
          />
        </div>

        <p className={styles.helperText}>
          One saved roll is allowed for each player name, reason, and roll type. A new reason
          can be rolled separately.
        </p>
        <SubmitButton
          idleText={`Roll ${rollType}`}
          pendingText="Rolling..."
          className={styles.submitButton}
        />
      </form>

      <RollResult state={state} />
    </div>
  )
}
