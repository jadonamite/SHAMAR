import 'dotenv/config'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getRail, cardRail, emailRail } from '../src/lib/rails/index.js'
import type { Decision } from '../src/lib/reasoning.js'

const decision: Decision = {
  subscription_id: 'sub-123',
  merchant: 'Netflix',
  action: 'cancel',
  confidence: 95,
  rationale: 'Dormant for three cycles.',
  blast_radius: {
    data_loss: 'recoverable',
    access_loss: 'solo',
    repurchase: 'same_price',
    irreversible: false,
    notes: [],
  },
  savings_usd_monthly: 15,
  requires_authorization: true,
  reasoned_by: 'fallback',
}

const params = { decision, userPrivyDid: 'did:privy:x', dbUserId: 'u1', accountEmail: '', apply: true }

test('Rails: email is the default for missing or unknown values', () => {
  assert.equal(getRail().kind, 'email')
  assert.equal(getRail(null).kind, 'email')
  assert.equal(getRail('fax').kind, 'email')
  assert.equal(getRail('EMAIL').kind, 'email')
  assert.equal(getRail('card').kind, 'card')
})

test('Rails: the card placeholder never reports a cancel, even with apply', async () => {
  const result = await cardRail.cancel(params)
  assert.equal(result.status, 'blocked_by_rail')
  assert.equal(result.subscription_id, 'sub-123')
  assert.equal(result.merchant, 'Netflix')
  assert.equal(result.reversible, false)
})

test('Rails: card pause and resume are refused until the card tier is active', async () => {
  const control = { decision, userPrivyDid: 'did:privy:x', dbUserId: 'u1' }
  assert.equal((await cardRail.pause(control)).ok, false)
  assert.equal((await cardRail.resume(control)).ok, false)
})

test('Rails: email cannot pause, and a sent email cancel is not undoable', async () => {
  const control = { decision, userPrivyDid: 'did:privy:x', dbUserId: 'u1' }
  const paused = await emailRail.pause(control)
  assert.equal(paused.ok, false)
  assert.equal(paused.status, 'not_supported')
  assert.equal(emailRail.reversible, false)
})
