import assert from 'node:assert/strict'
import test from 'node:test'
import { lockBodyScroll } from '../utils/body-scroll-lock'

test('overlapping dialogs release scrolling even when closed out of order', () => {
  const body = { style: { overflow: '' } } as HTMLElement
  const closeFirst = lockBodyScroll(body)
  const closeSecond = lockBodyScroll(body)
  closeFirst()
  assert.equal(body.style.overflow, 'hidden')
  closeSecond()
  assert.equal(body.style.overflow, '')
  closeSecond()
  assert.equal(body.style.overflow, '')
})

test('cleanup restores prior styles and supports reopening after unmount', () => {
  const body = { style: { overflow: 'auto' } } as HTMLElement
  lockBodyScroll(body)()
  assert.equal(body.style.overflow, 'auto')
  const close = lockBodyScroll(body)
  assert.equal(body.style.overflow, 'hidden')
  close()
  assert.equal(body.style.overflow, 'auto')
})
