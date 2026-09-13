import { Hono } from 'hono'
import { sql, getOrCreateUser } from '../lib/db.js'
import { gatherEvidence, decide, persistDecision, type Decision } from '../lib/reasoning.js'
import { dispatchCancellation, cancellationRecipient, type DispatchResult } from '../lib/dispatch.js'
import { checkOnchainAuthorization, SCOPES, isAgentConfigured, getAgentAddress, getPolicyContract } from '../lib/agent.js'
import { calendarClientFor, writeRenewalEvent, writeCancellationEvent, type RenewalEvent } from '../lib/calendar.js'
import { pollControl, sendTelegram, dispatchReport, getHaltState } from '../lib/telegram.js'
import { currencySymbol } from '../lib/currency.js'

const app = new Hono()

type Authorization = {
  scope: 'sam.cancel'
  granted: boolean
  checked: boolean
  source: 'onchain' | 'local' | 'none'
  agent: string
  contract: string
  wallet: string | null
  expires_at: string | null
  reason: string
}

// A locally-held grant with an expiry, used when the chain cannot be consulted.
// It is the same shape of permission — scoped and time-bounded — but it is only
// as trustworthy as this server, so the source is always reported.
function localGrant(): { granted: boolean; expiresAt: string | null } {
  const until = process.env.LOCAL_GRANT_UNTIL
  if (!until) return { granted: false, expiresAt: null }
  const expiry = new Date(until)
  if (isNaN(expiry.getTime())) return { granted: false, expiresAt: null }
  return { granted: expiry.getTime() > Date.now(), expiresAt: expiry.toISOString() }
}

async function resolveAuthorization(dbUserId: string): Promise<Authorization> {
  const base = {
    scope: 'sam.cancel' as const,
    agent: getAgentAddress(),
    contract: getPolicyContract(),
  }

  const [user] = await sql`SELECT wallet_address FROM users WHERE id = ${dbUserId}`
  const wallet = (user?.wallet_address as string | null) ?? null

  const onchainPossible = isAgentConfigured() && Boolean(base.contract) && Boolean(wallet)
  if (onchainPossible) {
    try {
      const granted = await checkOnchainAuthorization(wallet as string, SCOPES.CANCEL)
      if (granted) {
        return { ...base, granted: true, checked: true, source: 'onchain', wallet, expires_at: null,
          reason: 'sam.cancel granted on-chain and unexpired' }
      }
      return { ...base, granted: false, checked: true, source: 'onchain', wallet, expires_at: null,
        reason: 'sam.cancel not granted, expired, or revoked on-chain' }
    } catch (err) {
      // Chain unreachable — fall through to the local grant rather than
      // treating an RPC failure as a denial.
      console.warn('[auth] on-chain check failed:', (err as Error).message)
    }
  }

  const local = localGrant()
  if (local.granted) {
    return { ...base, granted: true, checked: true, source: 'local', wallet, expires_at: local.expiresAt,
      reason: `No on-chain grant available; acting under a local grant expiring ${local.expiresAt}` }
  }

  const why = !isAgentConfigured()
    ? 'Agent key not configured'
    : !base.contract
      ? 'SAM_POLICY_CONTRACT not set'
      : !wallet
        ? 'User has no wallet address on record'
        : 'No grant on-chain and no local grant configured'

  return { ...base, granted: false, checked: onchainPossible, source: 'none', wallet, expires_at: null, reason: why }
}

// POST /execute — reason, check authorization, then dispatch.
// Dry-run unless { apply: true }. Nothing leaves the building without it.
app.post('/', async (c) => {
  const userId = c.req.header('x-user-id')
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req
    .json<{ apply?: boolean; subscription_id?: string; account_email?: string }>()
    .catch(() => ({}) as Record<string, never>)

  const apply = body.apply ?? false
  const accountEmail = body.account_email ?? process.env.NOTIFY_EMAIL_TO ?? ''
  if (apply && !accountEmail) {
    return c.json({ error: 'account_email required to dispatch (or set NOTIFY_EMAIL_TO)' }, 400)
  }

  const t0 = Date.now()
  const dbUserId = await getOrCreateUser(userId)
  const authorization = await resolveAuthorization(dbUserId)
  const control = await pollControl()
  const calendar = await calendarClientFor(userId)

  let evidence = await gatherEvidence(dbUserId)
  if (body.subscription_id) {
    evidence = evidence.filter((e) => e.subscription_id === body.subscription_id)
    if (evidence.length === 0) return c.json({ error: 'Subscription not found' }, 404)
  }

  const decisions: Decision[] = []
  const dispatches: DispatchResult[] = []
  const calendarWrites: RenewalEvent[] = []

  // Reason over everything at once; a serverless function has a hard ceiling
  // and one model call per subscription in sequence exceeds it.
  const reasoned = await Promise.all(evidence.map(decide))

  for (let i = 0; i < evidence.length; i++) {
    const e = evidence[i]
    const decision = reasoned[i]
    decisions.push(decision)
    await persistDecision(decision)

    // Every subscription it keeps gets its next charge put on the calendar —
    // knowing the deadline is most of the value even when nothing is cancelled.
    if (calendar && apply && decision.action !== 'cancel') {
      calendarWrites.push(
        await writeRenewalEvent(calendar, {
          id: e.subscription_id,
          merchant: e.merchant,
          amount: e.amount,
          currency: e.currency,
          cadence: e.cadence,
          last_charged: e.days_since_charge === null ? null : new Date(Date.now() - e.days_since_charge * 86_400_000),
        })
      )
    }

    if (decision.action !== 'cancel') continue

    const result = await dispatchCancellation({
      decision,
      userPrivyDid: userId,
      dbUserId,
      accountEmail,
      authorized: authorization.granted && !control.halted,
      apply,
    })
    if (control.halted && result.status === 'blocked_unauthorized') {
      result.reason = 'Halted from Telegram — /resume to re-authorize'
    }
    dispatches.push(result)

    if (result.status === 'sent') {
      if (calendar) {
        calendarWrites.push(
          await writeCancellationEvent(calendar, { id: e.subscription_id, merchant: e.merchant }, result.recipient ?? '')
        )
      }
      await sendTelegram(
        dispatchReport({
          merchant: e.merchant,
          recipient: result.recipient ?? '',
          amount: `${currencySymbol(e.currency)}${e.amount}/${e.cadence}`,
          rationale: decision.rationale,
          attested: Boolean(result.attestation),
        })
      )
    }
  }

  const sent = dispatches.filter((d) => d.status === 'sent')
  return c.json({
    mode: apply ? 'apply' : 'dry_run',
    authorization,
    control,
    calendar_connected: calendar !== null,
    calendar_writes: calendarWrites,
    reasoned: decisions.length,
    fell_back: decisions.filter((d) => d.reasoned_by === 'fallback').length,
    proposed_cancellations: dispatches.length,
    dispatched: sent.length,
    blocked: dispatches.filter((d) => d.status === 'blocked_unauthorized').length,
    duplicates_prevented: dispatches.filter((d) => d.status === 'skipped_duplicate').length,
    monthly_savings_usd: Number(
      sent.reduce((sum, d) => {
        const match = decisions.find((x) => x.subscription_id === d.subscription_id)
        return sum + (match?.savings_usd_monthly ?? 0)
      }, 0).toFixed(2)
    ),
    elapsed_ms: Date.now() - t0,
    decisions,
    dispatches,
  })
})

// GET /execute/authorization — current on-chain grant, without reasoning
app.get('/authorization', async (c) => {
  const userId = c.req.header('x-user-id')
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)
  const dbUserId = await getOrCreateUser(userId)
  return c.json(await resolveAuthorization(dbUserId))
})

// GET /execute/control — halt state, without draining the Telegram queue
app.get('/control', async (c) => {
  return c.json(await getHaltState())
})

// POST /execute/control/poll — drain Telegram and apply /stop or /resume
app.post('/control/poll', async (c) => {
  return c.json(await pollControl())
})

// GET /execute/recipient/:merchant — where a cancellation would be sent
app.get('/recipient/:merchant', (c) => {
  const { merchant } = c.req.param()
  const recipient = cancellationRecipient(merchant)
  return c.json({ merchant, recipient, known: recipient !== null })
})

export default app
