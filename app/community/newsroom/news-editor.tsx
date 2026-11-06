'use client'

import Image from 'next/image'
import Link from '@/app/components/navigation-feedback/navigation-link'
import { useRouter } from '@/app/components/navigation-feedback/navigation-provider'
import { useRef, useState, useTransition } from 'react'
import {
  countWords,
  getNewsAvailability,
  MAX_HEADLINE_LENGTH,
  NEWS_CATEGORIES,
  newsArticleHref,
  newsCategoryLabels,
  newsImageRightsLabels,
  slugifyHeadline,
  TARGET_SUMMARY_WORDS,
  type NewsArticle,
  type NewsImageRights,
} from '../news/news-data'
import styles from '../news/news.module.css'
import {
  deleteNewsArticle,
  saveNewsArticle,
  withdrawNewsArticle,
  type NewsActionResult,
} from './actions'

type Message = { tone: 'error' | 'success'; text: string }

function toLocalInputValue(iso: string | null) {
  if (!iso) return ''
  const date = new Date(iso)
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

// The message lives out here because the form remounts after each save, which
// clears the picked file so it can't upload twice.
export default function NewsEditor({ article }: { article: NewsArticle | null }) {
  const [message, setMessage] = useState<Message | null>(null)

  return (
    <NewsEditorForm
      key={article?.updatedAt ?? 'new'}
      article={article}
      message={message}
      setMessage={setMessage}
    />
  )
}

function NewsEditorForm({
  article,
  message,
  setMessage,
}: {
  article: NewsArticle | null
  message: Message | null
  setMessage: (message: Message | null) => void
}) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [headline, setHeadline] = useState(article?.headline ?? '')
  const [summary, setSummary] = useState(article?.summary ?? '')
  const [category, setCategory] = useState<string>(article?.category ?? 'paints')
  const [availability] = useState(() => (article ? getNewsAvailability(article) : 'draft'))
  const [publishAt, setPublishAt] = useState(
    availability === 'scheduled' ? toLocalInputValue(article?.publishedAt ?? null) : ''
  )
  const [removeImage, setRemoveImage] = useState(false)
  const [pickedImage, setPickedImage] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteText, setDeleteText] = useState('')

  const isLive = availability === 'live'
  const isScheduled = availability === 'scheduled'
  const isOfficial = category === 'og_announcement'
  const slugLocked = Boolean(article?.firstPublishedAt)
  const words = countWords(summary)
  const outsideTarget =
    words > 0 && (words < TARGET_SUMMARY_WORDS.min || words > TARGET_SUMMARY_WORDS.max)
  const showsCurrentImage = Boolean(article?.imageUrl) && !removeImage
  const hasImage = showsCurrentImage || pickedImage

  function finish(result: NewsActionResult, successText: string) {
    if (!result.ok) {
      setMessage({ tone: 'error', text: result.error })
      return
    }
    setMessage({ tone: 'success', text: successText })
    if (article) {
      router.refresh()
    } else {
      router.replace(`/community/newsroom/${result.id}`)
    }
  }

  function submit(intent: 'save' | 'publish', successText: string) {
    const form = formRef.current
    if (!form || !form.reportValidity()) return
    const formData = new FormData(form)
    formData.set('intent', intent)
    // Sent as an absolute time: the server doesn't know the editor's timezone.
    formData.set('publishAt', publishAt ? new Date(publishAt).toISOString() : '')
    setMessage(null)
    startTransition(async () => {
      finish(await saveNewsArticle(formData), successText)
    })
  }

  function withdraw() {
    if (!article) return
    const prompt = isLive
      ? 'Retract this article? Its page will stop being public right away.'
      : 'Cancel this schedule and return the article to drafts?'
    if (!window.confirm(prompt)) return
    setMessage(null)
    startTransition(async () => {
      finish(
        await withdrawNewsArticle(article.id),
        isLive ? 'Article retracted.' : 'Returned to drafts.'
      )
    })
  }

  function remove() {
    if (!article) return
    setMessage(null)
    startTransition(async () => {
      const result = await deleteNewsArticle(article.id)
      if (result.ok) {
        router.replace('/community/newsroom')
      } else {
        setMessage({ tone: 'error', text: result.error })
      }
    })
  }

  return (
    <form
      ref={formRef}
      data-v3-community-indicator="section-card"
      className={styles.editor}
      onSubmit={(event) => event.preventDefault()}
    >
      {article ? <input type="hidden" name="id" value={article.id} /> : null}
      <input type="hidden" name="removeImage" value={removeImage ? '1' : '0'} />

      {article ? (
        <div className={styles.newsroomRowTop}>
          <span className={styles.statusPill} data-status={availability}>
            {availability}
          </span>
          {isLive ? <Link href={newsArticleHref(article.slug)}>View live page</Link> : null}
        </div>
      ) : null}

      <label className={styles.field}>
        <span>Category</span>
        <select name="category" value={category} onChange={(event) => setCategory(event.target.value)}>
          {NEWS_CATEGORIES.map((option) => (
            <option key={option} value={option}>
              {option === 'og_announcement' ? 'Official Obsidian Gallery announcement' : newsCategoryLabels[option]}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>Headline</span>
        <input
          name="headline"
          required
          maxLength={MAX_HEADLINE_LENGTH}
          value={headline}
          onChange={(event) => setHeadline(event.target.value)}
        />
      </label>

      <label className={styles.field}>
        <span>URL slug</span>
        <input
          name="slug"
          defaultValue={article?.slug ?? ''}
          readOnly={slugLocked}
          placeholder={slugifyHeadline(headline) || 'made-from-the-headline'}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          maxLength={96}
        />
        <span className={styles.fieldHint}>
          {slugLocked ? 'Locked, because this address has been published.' : 'Locks when first published.'}
        </span>
      </label>

      <label className={styles.field}>
        <span>Summary</span>
        <textarea
          name="summary"
          rows={6}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
        />
        <span className={styles.fieldHint} data-warn={outsideTarget || undefined}>
          {words} words. Aim for {TARGET_SUMMARY_WORDS.min}–{TARGET_SUMMARY_WORDS.max}.
        </span>
      </label>

      <label className={styles.field}>
        <span>Why painters care (optional)</span>
        <textarea name="whyPaintersCare" rows={2} defaultValue={article?.whyPaintersCare ?? ''} />
      </label>

      <label className={styles.field}>
        <span>Manufacturer (optional)</span>
        <input name="manufacturer" defaultValue={article?.manufacturer ?? ''} />
      </label>

      <label className={styles.field}>
        <span>Source name{isOfficial ? ' (optional)' : ''}</span>
        <input name="sourceName" defaultValue={article?.sourceName ?? ''} placeholder="Warhammer Community" />
      </label>

      <label className={styles.field}>
        <span>Original source link{isOfficial ? ' (optional)' : ''}</span>
        <input name="sourceUrl" type="url" defaultValue={article?.sourceUrl ?? ''} placeholder="https://" />
      </label>

      <label className={styles.field}>
        <span>Date the source announced it{isOfficial ? ' (optional)' : ''}</span>
        <input name="sourcePublishedAt" type="date" defaultValue={article?.sourcePublishedAt ?? ''} />
      </label>

      {showsCurrentImage && article?.imageUrl ? (
        <div className={styles.editorImage}>
          <Image src={article.imageUrl} alt="" fill sizes="448px" className="object-cover" />
        </div>
      ) : null}

      <label className={styles.field}>
        <span>{showsCurrentImage ? 'Replace image' : 'Featured image (optional)'}</span>
        <input
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => setPickedImage(Boolean(event.target.files?.length))}
        />
        <span className={styles.fieldHint}>
          Only images we have the rights to. Leave empty to use the category artwork.
        </span>
      </label>

      {showsCurrentImage ? (
        <button
          type="button"
          className={styles.secondaryAction}
          onClick={() => setRemoveImage(true)}
        >
          Remove image and use artwork
        </button>
      ) : null}

      {hasImage ? (
        <>
          <label className={styles.field}>
            <span>Image rights</span>
            <select name="imageRights" defaultValue={article?.imageRights ?? ''}>
              <option value="">Choose…</option>
              {(Object.keys(newsImageRightsLabels) as NewsImageRights[]).map((option) => (
                <option key={option} value={option}>
                  {newsImageRightsLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Image description</span>
            <input name="imageAlt" defaultValue={article?.imageAlt ?? ''} />
          </label>
          <label className={styles.field}>
            <span>Image credit (optional)</span>
            <input name="imageCredit" defaultValue={article?.imageCredit ?? ''} />
          </label>
        </>
      ) : null}

      {isLive ? null : (
        <label className={styles.field}>
          <span>Publish time (optional)</span>
          <input
            type="datetime-local"
            value={publishAt}
            onChange={(event) => setPublishAt(event.target.value)}
          />
          <span className={styles.fieldHint}>
            {isScheduled ? 'Use Cancel schedule below to stop it.' : 'Leave empty to publish right away.'}
          </span>
        </label>
      )}

      {message ? (
        <p className={styles.editorMessage} data-tone={message.tone} role="status">
          {message.text}
        </p>
      ) : null}

      <div className={styles.editorActions}>
        {availability === 'draft' || availability === 'retracted' ? (
          <>
            <button
              type="button"
              className={styles.secondaryAction}
              disabled={isPending}
              onClick={() => submit('save', 'Draft saved.')}
            >
              Save draft
            </button>
            <button
              type="button"
              className={styles.primaryAction}
              disabled={isPending}
              onClick={() =>
                submit('publish', publishAt ? 'Article scheduled.' : 'Article published.')
              }
            >
              {publishAt ? 'Schedule' : 'Publish now'}
            </button>
          </>
        ) : (
          <button
            type="button"
            className={styles.primaryAction}
            disabled={isPending}
            onClick={() => submit('save', 'Changes saved.')}
          >
            Save changes
          </button>
        )}
        {article ? (
          <Link href={`/community/newsroom/${article.id}/preview`} className={styles.secondaryAction}>
            Preview saved version
          </Link>
        ) : null}
      </div>

      {article ? (
        <div className={styles.dangerZone}>
          <div className={styles.editorActions}>
            {isLive || isScheduled ? (
              <button type="button" className={styles.dangerAction} disabled={isPending} onClick={withdraw}>
                {isLive ? 'Retract article' : 'Cancel schedule'}
              </button>
            ) : (
              <button
                type="button"
                className={styles.dangerAction}
                disabled={isPending}
                onClick={() => setConfirmingDelete(true)}
              >
                Delete article
              </button>
            )}
          </div>
          {confirmingDelete && !isLive && !isScheduled ? (
            <>
              <label className={styles.field}>
                <span>Type DELETE to remove this permanently</span>
                <input value={deleteText} onChange={(event) => setDeleteText(event.target.value)} />
              </label>
              <button
                type="button"
                className={styles.dangerAction}
                disabled={isPending || deleteText !== 'DELETE'}
                onClick={remove}
              >
                Permanently delete
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </form>
  )
}
