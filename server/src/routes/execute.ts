import { Hono } from 'hono'
import { sql, getOrCreateUser } from '../lib/db.js'
import { gatherEvidence, decide, persistDecision, type Decision } from '../lib/reasoning.js'
import { dispatchCancellation, cancellationRecipient, type DispatchResult } from '../lib/dispatch.js'
import { checkOnchainAuthorization, SCOPES, isAgentConfigured, getAgentAddress, getPolicyContract } from '../lib/agent.js'

const app = new Hono()

type Authorization = {
  scope: 'sam.cancel'
  granted: boolean
  checked: boolean
  agent: string
  contract: string
  wallet: string | null
  reason: string
}

async function resolveAuthorization(dbUserId: string): Promise<Authorization> {
  const base = {
    scope: 'sam.cancel' as const,
    agent: getAgentAddress(),
    contract: getPolicyContract(),
  }

  const [user] = await sql`SELECT wallet_address FROM users WHERE id = ${dbUserId}`
  const wallet = (user?.wallet_address as string | null) ?? null

  if (!isAgentConfigured()) {
    return { ...base, granted: false, checked: false, wallet, reason: 'Agent key not configured on this server' }
  }
  if (!base.contract) {
    return { ...base, granted: false, checked: false, wallet, reason: 'SAM_POLICY_CONTRACT not set' }
  }
  if (!wallet) {
    return { ...base, granted: false, checked: false, wallet, reason: 'User has no wallet address on record' }
  }

  const granted = await checkOnchainAuthorization(wallet, SCOPES.CANCEL)
  return {
    ...base,
    granted,
    checked: true,
    wallet,
    reason: granted
      ? 'sam.cancel granted on-chain and unexpired'
      : 'sam.cancel not granted, expired, or revoked',
  }
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

  let evidence = await gatherEvidence(dbUserId)
  if (body.subscription_id) {
    evidence = evidence.filter((e) => e.subscription_id === body.subscription_id)
    if (evidence.length === 0) return c.json({ error: 'Subscription not found' }, 404)
  }

  const decisions: Decision[] = []
  const dispatches: DispatchResult[] = []

  for (const e of evidence) {
    const decision = await decide(e)
    decisions.push(decision)
    await persistDecision(decision)

    if (decision.action !== 'cancel') continue

    dispatches.push(
      await dispatchCancellation({
        decision,
        userPrivyDid: userId,
        dbUserId,
        accountEmail,
        authorized: authorization.granted,
        apply,
      })
    )
  }

  const sent = dispatches.filter((d) => d.status === 'sent')
  return c.json({
    mode: apply ? 'apply' : 'dry_run',
    authorization,
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

// GET /execute/recipient/:merchant — where a cancellation would be sent
app.get('/recipient/:merchant', (c) => {
  const { merchant } = c.req.param()
  const recipient = cancellationRecipient(merchant)
  return c.json({ merchant, recipient, known: recipient !== null })
})

export default app
