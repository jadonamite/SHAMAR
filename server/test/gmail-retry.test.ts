import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isRateLimited,
  isAuthExpired,
  retryAfterMs,
  withGmailRetry,
} from '../src/lib/gmail-retry.js'

// Shapes match what googleapis (gaxios) throws.
const concurrent429 = {
  message: 'Too many concurrent requests for user.',
  response: { status: 429, data: { error: { errors: [{ reason: 'rateLimitExceeded' }] } } },
}
const userRate403 = {
  message: 'User-rate limit exceeded.',
  response: { status: 403, data: { error: { errors: [{ reason: 'userRateLimitExceeded' }] } } },
}
const forbidden403 = {
  message: 'Insufficient Permission',
  response: { status: 403, data: { error: { errors: [{ reason: 'insufficientPermissions' }] } } },
}
const invalidGrant = {
  message: 'invalid_grant',
  response: { status: 400, data: { error: 'invalid_grant' } },
}

function fakeClock(start = 0) {
  let t = start
  const slept: number[] = []
  return {
    now: () => t,
    sleep: async (ms: number) => {
      slept.push(ms)
      t += ms
    },
    slept,
  }
}

test('Gmail errors: recognises rate limits by status and reason, not wording', () => {
  assert.equal(isRateLimited(concurrent429), true)
  assert.equal(isRateLimited(userRate403), true)
  assert.equal(isRateLimited(forbidden403), false)
  assert.equal(isRateLimited(invalidGrant), false)
  assert.equal(isRateLimited(new Error('network down')), false)
})

test('Gmail errors: recognises an expired or revoked Gmail login', () => {
  assert.equal(isAuthExpired(invalidGrant), true)
  assert.equal(isAuthExpired(new Error('invalid_grant: Token has been expired or revoked.')), true)
  assert.equal(isAuthExpired(concurrent429), false)
})

test('Gmail errors: reads Retry-After as seconds, as a date, and from a Headers object', () => {
  const secs = { response: { status: 429, headers: { 'retry-after': '3' } } }
  assert.equal(retryAfterMs(secs), 3000)

  const now = Date.parse('2026-09-24T08:00:00Z')
  const date = { response: { status: 429, headers: { 'retry-after': 'Thu, 24 Sep 2026 08:00:05 GMT' } } }
  assert.equal(retryAfterMs(date, now), 5000)

  const headersObj = { response: { status: 429, headers: new Headers({ 'retry-after': '2' }) } }
  assert.equal(retryAfterMs(headersObj), 2000)

  assert.equal(retryAfterMs(concurrent429), undefined)
})

test('Gmail retry: retries a rate limit and then succeeds', async () => {
  const clock = fakeClock()
  let calls = 0
  const result = await withGmailRetry(
    async () => {
      calls++
      if (calls < 3) throw concurrent429
      return 'ok'
    },
    { deadline: 60_000, sleep: clock.sleep, now: clock.now, random: () => 1 }
  )
  assert.equal(result, 'ok')
  assert.equal(calls, 3)
  assert.deepEqual(clock.slept, [1000, 2000]) // exponential: 1s then 2s
})

test('Gmail retry: does not retry errors that are not rate limits', async () => {
  const clock = fakeClock()
  let calls = 0
  await assert.rejects(
    withGmailRetry(
      async () => {
        calls++
        throw forbidden403
      },
      { deadline: 60_000, sleep: clock.sleep, now: clock.now }
    ),
    (err) => err === forbidden403
  )
  assert.equal(calls, 1)
  assert.equal(clock.slept.length, 0)
})

test('Gmail retry: gives up after the allowed number of attempts', async () => {
  const clock = fakeClock()
  let calls = 0
  await assert.rejects(
    withGmailRetry(
      async () => {
        calls++
        throw userRate403
      },
      { deadline: 60_000, attempts: 3, sleep: clock.sleep, now: clock.now, random: () => 1 }
    )
  )
  assert.equal(calls, 3)
})

test('Gmail retry: never waits past the deadline', async () => {
  const clock = fakeClock(10_000)
  let calls = 0
  await assert.rejects(
    withGmailRetry(
      async () => {
        calls++
        throw { ...concurrent429, response: { ...concurrent429.response, headers: { 'retry-after': '30' } } }
      },
      { deadline: 20_000, sleep: clock.sleep, now: clock.now }
    )
  )
  assert.equal(calls, 1)
  assert.equal(clock.slept.length, 0)
})

test("Gmail retry: honours Google's Retry-After when it is longer than the backoff", async () => {
  const clock = fakeClock()
  let calls = 0
  await withGmailRetry(
    async () => {
      calls++
      if (calls === 1) {
        throw { ...concurrent429, response: { ...concurrent429.response, headers: { 'retry-after': '4' } } }
      }
      return 'ok'
    },
    { deadline: 60_000, sleep: clock.sleep, now: clock.now, random: () => 0.1 }
  )
  assert.deepEqual(clock.slept, [4000])
})
