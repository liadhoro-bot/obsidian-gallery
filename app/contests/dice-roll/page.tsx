import Link from 'next/link'
import DiceRollForm from './dice-roll-form'

export const metadata = {
  title: 'Campaign Dice Roll | Obsidian Gallery',
  description: 'Roll a logged 2d6 result for an Obsidian Gallery campaign.',
}

export default function CampaignDiceRollPage() {
  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pb-24 pt-6 sm:max-w-2xl">
        <header>
          <Link
            href="/contests"
            className="text-sm font-bold text-cyan-200/80 transition hover:text-cyan-100"
          >
            Back to contests
          </Link>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
            Campaign tool
          </p>
          <h1 className="mt-2 text-4xl font-black">2d6 Remote Roll</h1>
          <p className="mt-3 text-base leading-7 text-white/65">
            Enter your campaign player name and the reason for the roll. Each player can roll
            once per reason, with every result logged and sent to the campaign organizer.
          </p>
        </header>

        <DiceRollForm />
      </div>
    </main>
  )
}
