import Image from 'next/image'
import type { ReactNode } from 'react'
import type { Contest, ContestNomineeType } from '../../lib/contests/types'
import { saveContestAction } from '../../lib/contests/actions'
import PendingSubmitButton from './pending-submit-button'
import ContestShareLinkBox from './contest-share-link-box'

function toDatetimeLocal(value?: string | null) {
  if (!value) return ''
  return new Date(value).toISOString().slice(0, 16)
}

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

const fieldClass =
  'w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-cyan-300/55 focus:bg-black/40'

const checkboxClass =
  'rounded-2xl border border-white/10 bg-black/20 p-3 text-sm font-bold text-white/80'

const nomineeTypeLabels: Record<ContestNomineeType, string> = {
  project: 'Projects',
  unit: 'Units',
  guide: 'Guides',
}

function FormSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-xl font-black">{title}</h2>
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="grid gap-1.5 text-sm font-bold text-white/65">
      <span>{label}</span>
      {children}
    </label>
  )
}

export default function ContestAdminForm({
  contest,
  isReadOnly = false,
  shareOrigin,
}: {
  contest?: Contest | null
  isReadOnly?: boolean
  shareOrigin?: string
}) {
  const selectedTypes = new Set(
    contest?.allowed_nominee_types?.map((row) => row.nominee_type) ?? [
      'project',
      'unit',
      'guide',
    ]
  )
  const defaultSubmissionsOpenAt = contest?.submissions_open_at ?? hoursFromNow(1)
  const defaultSubmissionsCloseAt =
    contest?.submissions_close_at ?? hoursFromNow(24 * 14)
  const defaultVotingOpenAt = contest?.voting_open_at ?? hoursFromNow(24 * 15)
  const defaultVotingCloseAt = contest?.voting_close_at ?? hoursFromNow(24 * 22)
  const contestPath = contest ? `/contests/${contest.slug}` : ''
  const contestShareUrl =
    contestPath && shareOrigin ? new URL(contestPath, shareOrigin).toString() : contestPath

  return (
    <form action={saveContestAction} className="space-y-5">
      {contest ? <input type="hidden" name="contestId" value={contest.id} /> : null}

      {isReadOnly ? (
        <p className="rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.08] p-4 text-sm leading-6 text-cyan-50">
          This demo contest shows the editable fields and layout, but it does not
          save changes because it is generated locally.
        </p>
      ) : null}

      {contest ? (
        <ContestShareLinkBox path={contestPath} shareUrl={contestShareUrl} />
      ) : null}

      <fieldset disabled={isReadOnly} className="space-y-5 disabled:opacity-80">
        <FormSection eyebrow="Contest" title="Basics">
          <Field label="Name">
            <input
              name="title"
              defaultValue={contest?.title ?? ''}
              required
              placeholder="Community Showcase"
              className={fieldClass}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Slug">
              <input
                name="slug"
                defaultValue={contest?.slug ?? ''}
                required
                placeholder="community-showcase"
                className={fieldClass}
              />
            </Field>
            <Field label="Stage">
              <select
                name="publicationStatus"
                defaultValue={contest?.publication_status ?? 'draft'}
                className={fieldClass}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="cancelled">Cancelled</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Visibility">
              <select
                name="visibility"
                defaultValue={contest?.visibility ?? 'public'}
                className={fieldClass}
              >
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>
            </Field>
            <Field label="Header image URL">
              <input
                name="coverImageUrl"
                defaultValue={contest?.cover_image_url ?? ''}
                placeholder="https://..."
                className={fieldClass}
              />
            </Field>
          </div>

          {contest?.cover_image_url ? (
            <div className="relative aspect-[16/7] overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              <Image
                src={contest.cover_image_url}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, 720px"
                className="object-cover"
              />
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Upload header image">
              <input
                name="coverImageFile"
                type="file"
                accept="image/*"
                className={`${fieldClass} file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-400 file:px-3 file:py-2 file:text-xs file:font-black file:text-black`}
              />
            </Field>
            {contest?.cover_image_url ? (
              <label className={`${checkboxClass} sm:mb-0`}>
                <input type="checkbox" name="removeCoverImage" className="mr-2" />
                Remove image
              </label>
            ) : null}
          </div>

          <Field label="Short description">
            <input
              name="shortDescription"
              defaultValue={contest?.short_description ?? ''}
              placeholder="A one-line summary for cards and headers"
              className={fieldClass}
            />
          </Field>

          <Field label="Description card">
            <textarea
              name="description"
              defaultValue={contest?.description ?? ''}
              rows={5}
              placeholder="What is this contest about?"
              className={fieldClass}
            />
          </Field>

          <Field label="Rules">
            <textarea
              name="rulesMarkdown"
              defaultValue={contest?.rules_markdown ?? ''}
              rows={6}
              required
              placeholder="Eligibility, judging criteria, and submission rules"
              className={fieldClass}
            />
          </Field>
        </FormSection>

        <FormSection eyebrow="Nominations" title="Accepted Objects">
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(nomineeTypeLabels) as ContestNomineeType[]).map((value) => (
              <label key={value} className={checkboxClass}>
                <input
                  type="checkbox"
                  name="nomineeTypes"
                  value={value}
                  defaultChecked={selectedTypes.has(value)}
                  className="mr-2"
                />
                {nomineeTypeLabels[value]}
              </label>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Max nominations per user">
              <input
                name="maxNominations"
                type="number"
                min={1}
                defaultValue={contest?.max_nominations_per_user ?? 1}
                className={fieldClass}
              />
            </Field>
            <label className={checkboxClass}>
              <input
                type="checkbox"
                name="requiresApproval"
                defaultChecked={contest?.requires_nomination_approval ?? true}
                className="mr-2"
              />
              Require nomination approval
            </label>
          </div>
        </FormSection>

        <FormSection eyebrow="Timeline" title="Schedule">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Submissions open">
              <input
                type="datetime-local"
                name="submissionsOpenAt"
                required
                defaultValue={toDatetimeLocal(defaultSubmissionsOpenAt)}
                className={fieldClass}
              />
            </Field>
            <Field label="Submissions close">
              <input
                type="datetime-local"
                name="submissionsCloseAt"
                required
                defaultValue={toDatetimeLocal(defaultSubmissionsCloseAt)}
                className={fieldClass}
              />
            </Field>
            <Field label="Voting opens">
              <input
                type="datetime-local"
                name="votingOpenAt"
                required
                defaultValue={toDatetimeLocal(defaultVotingOpenAt)}
                className={fieldClass}
              />
            </Field>
            <Field label="Voting closes">
              <input
                type="datetime-local"
                name="votingCloseAt"
                required
                defaultValue={toDatetimeLocal(defaultVotingCloseAt)}
                className={fieldClass}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection eyebrow="Voting" title="Ballot Settings">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Method">
              <select
                name="votingMethod"
                defaultValue={contest?.voting_method ?? 'approval'}
                className={fieldClass}
              >
                <option value="approval">Approval</option>
                <option value="ranked">Ranked</option>
              </select>
            </Field>
            <Field label="Minimum picks">
              <input
                name="minimumSelections"
                type="number"
                min={1}
                defaultValue={contest?.minimum_selections_per_ballot ?? 1}
                className={fieldClass}
              />
            </Field>
            <Field label="Maximum picks">
              <input
                name="maximumSelections"
                type="number"
                min={1}
                defaultValue={contest?.maximum_selections_per_ballot ?? 1}
                className={fieldClass}
              />
            </Field>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ['requireExact', 'Require exactly N selections', contest?.require_exact_selection_count],
              ['allowBallotChanges', 'Allow ballot changes', contest?.allow_ballot_changes ?? true],
              ['allowSelfVote', 'Allow self voting', contest?.allow_self_vote],
              [
                'hideIdentity',
                'Hide nominee identity during voting',
                contest?.hide_nominee_identity_during_voting ?? true,
              ],
              ['showLiveResults', 'Show live results', contest?.show_live_results],
            ].map(([name, label, checked]) => (
              <label key={String(name)} className={checkboxClass}>
                <input
                  type="checkbox"
                  name={String(name)}
                  defaultChecked={Boolean(checked)}
                  className="mr-2"
                />
                {label}
              </label>
            ))}
          </div>
        </FormSection>

        <FormSection eyebrow="Access" title="Voting Access">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Who can vote">
              <select
                name="voterAccessMode"
                defaultValue={contest?.voter_access_mode ?? 'public_authenticated'}
                className={fieldClass}
              >
                <option value="public_authenticated">Public authenticated</option>
                <option value="allowlist">Allowlist</option>
                <option value="nominees_only">Approved nominees only</option>
              </select>
            </Field>
            <Field label="Minimum account age hours">
              <input
                name="minimumAccountAgeHours"
                type="number"
                min={0}
                defaultValue={contest?.minimum_account_age_hours ?? 0}
                className={fieldClass}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Minimum projects to vote">
              <input
                name="minimumProjectsForVoting"
                type="number"
                min={0}
                defaultValue={contest?.minimum_projects_for_voting ?? 0}
                className={fieldClass}
              />
            </Field>
            <Field label="Minimum units to vote">
              <input
                name="minimumUnitsForVoting"
                type="number"
                min={0}
                defaultValue={contest?.minimum_units_for_voting ?? 0}
                className={fieldClass}
              />
            </Field>
          </div>

          <label className={checkboxClass}>
            <input
              type="checkbox"
              name="requireVerifiedEmail"
              defaultChecked={contest?.require_verified_email ?? true}
              className="mr-2"
            />
            Require verified email
          </label>
        </FormSection>
      </fieldset>

      {isReadOnly ? null : (
        <div className="grid gap-3 sm:grid-cols-2">
          <PendingSubmitButton
            name="intent"
            value="save"
            pendingLabel="Saving..."
            className="rounded-xl border border-white/10 px-4 py-3 font-black text-white"
          >
            Save Changes
          </PendingSubmitButton>
          <PendingSubmitButton
            name="intent"
            value="publish"
            pendingLabel="Publishing..."
            className="rounded-xl bg-cyan-400 px-4 py-3 font-black text-black"
          >
            Publish
          </PendingSubmitButton>
          {contest ? (
            <>
              <PendingSubmitButton
                name="intent"
                value="cancel"
                pendingLabel="Cancelling..."
                className="rounded-xl border border-red-300/30 px-4 py-3 font-black text-red-100"
              >
                Cancel Contest
              </PendingSubmitButton>
              <PendingSubmitButton
                name="intent"
                value="archive"
                pendingLabel="Archiving..."
                className="rounded-xl border border-white/10 px-4 py-3 font-black text-white/70"
              >
                Archive
              </PendingSubmitButton>
            </>
          ) : null}
        </div>
      )}
    </form>
  )
}
