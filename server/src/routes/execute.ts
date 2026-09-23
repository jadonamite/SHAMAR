import { Hono } from 'hono'
import { readBody } from '../lib/body.js'
import { sql, getOrCreateUser } from '../lib/db.js'
import { gatherEvidence, decide, persistDecision, monthlyUsd, type Decision } from '../lib/reasoning.js'
import { dispatchCancellation, cancellationRecipient, type DispatchResult } from '../lib/dispatch.js'
import { checkOnchainAuthorization, SCOPES, isAgentConfigured, getAgentAddress, getPolicyContract } from '../lib/agent.js'
import { calendarClientFor, writeRenewalEvent, writeCancellationEvent, type RenewalEvent } from '../lib/calendar.js'
import { pollControl, sendTelegram, dispatchReport, getHaltState } from '../lib/telegram.js'
import { currencySymbol } from '../lib/currency.js'

const app = new Hono()

type Authorization = {
  scope: 'shamar.cancel'
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
    scope: 'shamar.cancel' as const,
    agent: getAgentAddress(),
    contract: getPolicyContract(),
  }

  const [user] = await sql`SELECT wallet_address FROM users WHERE id = ${dbUserId}`
  const wallet = (user?.wallet_address as string | null) ?? null

  // On-chain verification is the production authority, but a judge or reviewer
  // running this without a funded wallet should still see the agent work.
  // Setting ONCHAIN_AUTH=off skips the chain and falls through to the local grant.
  const onchainEnabled = (process.env.ONCHAIN_AUTH ?? 'on').toLowerCase() !== 'off'
  const onchainPossible = onchainEnabled && isAgentConfigured() && Boolean(base.contract) && Boolean(wallet)
  if (onchainPossible) {
    try {
      const granted = await checkOnchainAuthorization(wallet as string, SCOPES.CANCEL)
      if (granted) {
        return { ...base, granted: true, checked: true, source: 'onchain', wallet, expires_at: null,
          reason: 'shamar.cancel granted on-chain and unexpired' }
      }
      return { ...base, granted: false, checked: true, source: 'onchain', wallet, expires_at: null,
        reason: 'shamar.cancel not granted, expired, or revoked on-chain' }
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

  const why = !onchainEnabled
    ? 'On-chain authorization disabled and no local grant configured'
    : !isAgentConfigured()
    ? 'Agent key not configured'
    : !base.contract
      ? 'SHAMAR_POLICY_CONTRACT not set'
      : !wallet
        ? 'User has no wallet address on record'
        : 'No grant on-chain and no local grant configured'

  return { ...base, granted: false, checked: onchainPossible, source: 'none', wallet, expires_at: null, reason: why }
}



// Every pre-flight check talks to something outside this process. None of them
// is worth failing the whole run over, so each gets a hard ceiling and a
// stated fallback.
function withTimeout<T>(work: Promise<T>, ms: number, fallback: T, label: string): Promise<T> {
  return Promise.race([
    work.catch((err) => {
      console.warn(`[execute] ${label} failed:`, (err as Error).message)
      return fallback
    }),
    new Promise<T>((resolve) =>
      setTimeout(() => {
        console.warn(`[execute] ${label} timed out after ${ms}ms`)
        resolve(fallback)
      }, ms)
    ),
  ])
}

// Reasoning is slow and belongs off the request path. Decisions persisted by a
// prior run are replayed here so a page load never waits on a model.
async function cachedDecisions(dbUserId: string): Promise<Decision[] | null> {
  const rows = (await sql`
    SELECT r.subscription_id, r.action, r.confidence, r.evidence,
           s.merchant, s.amount, s.currency, s.cadence, s.category
    FROM recommendations r
    JOIN subscriptions s ON s.id = r.subscription_id
    WHERE s.user_id = ${dbUserId} AND s.status = 'active'
    ORDER BY r.confidence DESC
  `) as Array<Record<string, any>>
  if (rows.length === 0) return null

  return rows.map((r) => {
    const notes: string[] = Array.isArray(r.evidence) ? r.evidence : []
    const [rationale, ...rest] = notes
    return {
      subscription_id: r.subscription_id,
      merchant: r.merchant,
      action: r.action,
      confidence: Number(r.confidence),
      rationale: rationale ?? '',
      blast_radius: {
        data_loss: 'recoverable',
        access_loss: 'solo',
        repurchase: 'same_price',
        irreversible: rest.some((n) => /permanent|legacy|irreversible/i.test(n)),
        notes: rest,
      },
      savings_usd_monthly:
        r.action === 'cancel' || r.action === 'pause'
          ? monthlyUsd(Number(r.amount), r.currency, r.cadence)
          : 0,
      requires_authorization: r.action === 'cancel' || r.action === 'pause',
      reasoned_by: 'model' as const,
    }
  })
}

// POST /execute — reason, check authorization, then dispatch.
// Dry-run unless { apply: true }. Nothing leaves the building without it.
app.post('/', async (c) => {
  const userId = c.req.header('x-user-id')
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  const body = await readBody<{ apply: boolean; fresh: boolean; subscription_id: string; account_email: string }>(c)

  const apply = body.apply ?? false
  const fresh = body.fresh ?? false
  const accountEmail = body.account_email ?? process.env.NOTIFY_EMAIL_TO ?? ''
  if (apply && !accountEmail) {
    return c.json({ error: 'account_email required to dispatch (or set NOTIFY_EMAIL_TO)' }, 400)
  }

  const t0 = Date.now()
  const dbUserId = await getOrCreateUser(userId)
  const [authorization, control, calendar] = await Promise.all([
    withTimeout(resolveAuthorization(dbUserId), 6000,
      { scope: 'shamar.cancel' as const, granted: false, checked: false, source: 'none' as const,
        agent: getAgentAddress(), contract: getPolicyContract(), wallet: null, expires_at: null,
        reason: 'Authorization check timed out; refusing rather than assuming permission' },
      'authorization'),
    withTimeout(pollControl(), 4000,
      { halted: false, source: 'unavailable' as const, reason: 'Control channel unreachable' },
      'telegram control'),
    withTimeout(calendarClientFor(userId), 4000, null, 'calendar'),
  ])

  let evidence = await gatherEvidence(dbUserId)
  if (body.subscription_id) {
    evidence = evidence.filter((e) => e.subscription_id === body.subscription_id)
    if (evidence.length === 0) return c.json({ error: 'Subscription not found' }, 404)
  }

  const decisions: Decision[] = []
  const dispatches: DispatchResult[] = []
  const calendarWrites: RenewalEvent[] = []

  // A serverless function has a hard ceiling that live model calls can exceed,
  // so persisted decisions are replayed unless a fresh pass is asked for.
  const cached = fresh ? null : await cachedDecisions(dbUserId)
  const reasoned = cached && cached.length === evidence.length
    ? evidence.map((e) => cached.find((c) => c.subscription_id === e.subscription_id)!).filter(Boolean)
    : await Promise.all(evidence.map(decide))
  const replayed = Boolean(cached && cached.length === evidence.length)

  for (let i = 0; i < evidence.length; i++) {
    const e = evidence[i]
    const decision = reasoned[i]
    decisions.push(decision)
    if (!replayed) await persistDecision(decision)

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
    reasoning: replayed ? 'replayed' : 'live',
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
