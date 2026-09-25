import 'dotenv/config'
import test from 'node:test'
import assert from 'node:assert/strict'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import app from '../src/app.js'
import { sendNotice } from '../src/lib/renewal.js'

test('Security: Unauthenticated requests to protected endpoints return 401', async () => {
  const protectedRoutes = [
    { method: 'GET', path: '/actions' },
    { method: 'GET', path: '/recommendations' },
    { method: 'GET', path: '/reminders' },
    { method: 'GET', path: '/wallet/status' },
    { method: 'POST', path: '/intelligence/analyze/sub-123' },
    { method: 'GET', path: '/agent/status' },
    { method: 'DELETE', path: '/account' },
    { method: 'GET', path: '/telegram/status' },
    { method: 'POST', path: '/telegram/link-code' },
    { method: 'GET', path: '/subscriptions' },
    { method: 'GET', path: '/gmail/status' },
  ]

  for (const route of protectedRoutes) {
    const res = await app.request(route.path, { method: route.method })
    assert.equal(
      res.status,
      401,
      `Expected ${route.method} ${route.path} to return 401 when unauthenticated, got ${res.status}`
    )
  }
})

test('Security: Unverified x-user-id header is strictly rejected without proof', async () => {
  const res = await app.request('/actions', {
    method: 'GET',
    headers: {
      'x-user-id': 'did:privy:victim_user_spoofed',
    },
  })
  assert.equal(res.status, 401, 'Spoofed x-user-id without token or signature must be rejected with 401')
})

test('Security: Valid EVM wallet cryptographic signature authenticates caller', async () => {
  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)
  const timestamp = Date.now().toString()
  const message = `Sign in to SHAMAR\nAddress: ${account.address.toLowerCase()}\nTimestamp: ${timestamp}`
  const signature = await account.signMessage({ message })

  const res = await app.request('/agent/status', {
    method: 'GET',
    headers: {
      'x-wallet-address': account.address,
      'x-wallet-signature': signature,
      'x-wallet-timestamp': timestamp,
    },
  })

  assert.equal(res.status, 200, `Valid wallet signature must return 200, got ${res.status}`)
  const data = await res.json()
  assert.ok('state' in data, 'Status response should contain state')
  assert.ok('gmail_connected' in data, 'Status response should contain gmail_connected flag')
  assert.ok('telegram_linked' in data, 'Status response should contain telegram_linked flag')
})

test('Security: Expired wallet signature (> 10 minutes) is rejected', async () => {
  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)
  const expiredTimestamp = (Date.now() - 15 * 60 * 1000).toString() // 15 mins ago
  const message = `Sign in to SHAMAR\nAddress: ${account.address.toLowerCase()}\nTimestamp: ${expiredTimestamp}`
  const signature = await account.signMessage({ message })

  const res = await app.request('/agent/status', {
    method: 'GET',
    headers: {
      'x-wallet-address': account.address,
      'x-wallet-signature': signature,
      'x-wallet-timestamp': expiredTimestamp,
    },
  })

  assert.equal(res.status, 401, 'Expired signature must return 401')
})

test('Security: Gmail legacy /auth and /scan-lock endpoints are removed', async () => {
  const authRes = await app.request('/gmail/auth?user_id=attacker', { method: 'GET' })
  assert.equal(authRes.status, 404, 'Legacy /gmail/auth endpoint must be removed')

  const scanLockRes = await app.request('/gmail/scan-lock', { method: 'DELETE' })
  assert.equal(scanLockRes.status, 404, 'Debug /gmail/scan-lock endpoint must be removed')
})

test('Security: Gmail OAuth callback rejects invalid/expired state nonce without creating user', async () => {
  const res = await app.request('/gmail/callback?code=mock_code&state=non_existent_or_expired_state', {
    method: 'GET',
  })
  // Must redirect to error=oauth_expired
  assert.equal(res.status, 302, 'Callback should redirect on invalid state')
  const location = res.headers.get('location') || ''
  assert.match(location, /error=oauth_expired/, 'Redirect location must specify oauth_expired')
})

test('Security: CRON_SECRET enforcement on autonomous scheduler endpoints', async () => {
  // Test invalid secret on /renewals/cron
  const renewalsRes = await app.request('/renewals/cron', {
    method: 'GET',
    headers: { 'x-cron-secret': 'wrong_secret_key' },
  })
  assert.equal(renewalsRes.status, 401, 'Invalid secret on /renewals/cron must return 401')

  // Test invalid secret on /reminders/send-due
  const remindersRes = await app.request('/reminders/send-due', {
    method: 'GET',
    headers: { 'x-cron-secret': 'wrong_secret_key' },
  })
  assert.equal(remindersRes.status, 401, 'Invalid secret on /reminders/send-due must return 401')

  // Test invalid secret on /cron/runner
  const runnerRes = await app.request('/cron/runner', {
    method: 'GET',
    headers: { 'x-cron-secret': 'wrong_secret_key' },
  })
  assert.equal(runnerRes.status, 401, 'Invalid secret on /cron/runner must return 401')
})

test('Security: Telegram notice safety never sends to shared chat for unlinked user', async () => {
  const noticeState = {
    subscription_id: 'sub-test',
    merchant: 'TestSub',
    renewal_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    notices_sent: 0,
    last_notice_at: null,
    decision: null,
    decided_at: null,
    auto_cancelled: false,
  }

  // Passing null or undefined chatId must return false and not deliver to DEFAULT_CHAT_ID
  const sentWithoutChat = await sendNotice(noticeState, '$10/mo', 48, null)
  assert.equal(sentWithoutChat, false, 'sendNotice must refuse delivery when user has no linked Telegram chat')
})

test('Security: Removed legacy fake grant, revoke, and self endpoints return 404', async () => {
  const grantRes = await app.request('/agent/grant-policy', { method: 'POST' })
  assert.equal(grantRes.status, 404, 'Fake grant-policy route must return 404')

  const revokeRes = await app.request('/agent/revoke-policy', { method: 'POST' })
  assert.equal(revokeRes.status, 404, 'Fake revoke-policy route must return 404')

  const selfRes = await app.request('/self/status', { method: 'GET' })
  assert.equal(selfRes.status, 404, 'Legacy self route must return 404')
})

test('Security: Health check reports shamar-server', async () => {
  const res = await app.request('/health', { method: 'GET' })
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.service, 'shamar-server', 'Health check service must be shamar-server')
})

test('Security: Telegram webhook endpoint accepts valid payloads and returns 200', async () => {
  const res = await app.request('/telegram/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      update_id: 999999,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 123456789, type: 'private' },
        text: 'help',
      },
    }),
  })
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.ok, true)
})

