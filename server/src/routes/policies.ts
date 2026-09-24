import { Hono } from 'hono'
import { readBody } from '../lib/body.js'
import { sql, getOrCreateUser } from '../lib/db.js'
import { logAction } from '../lib/actions.js'
import { toUsd } from '../lib/currency.js'
import { executeSubscriptionById } from '../lib/execution.js'
import { authenticateCaller } from '../lib/auth.js'

const app = new Hono()

type PolicyTrigger = 'trial_cancel' | 'spend_alert' | 'inactivity_pause'
type PolicyAction = 'cancel' | 'pause' | 'remind' | 'alert'

type PolicyConditions = {
  // trial_cancel: cancel after N days if merchant matches 'trial' in name, zero-price, or trial category
  trial_days?: number
  // spend_alert: fire when monthly spend exceeds threshold
  spend_threshold?: number
  currency?: string
  // inactivity_pause: pause if last_charged older than N days
  inactive_days?: number
  // optional merchant filter
  merchant?: string
}

// GET /policies — list user's policies
app.get('/', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const rows = await sql`
      SELECT id, name, trigger, conditions, action, enabled,
             created_at, last_evaluated_at, last_triggered_at
      FROM policies
      WHERE user_id = ${auth.dbUserId}
      ORDER BY created_at DESC
    `
    return c.json({ policies: rows })
  } catch (err) {
    const msg = (err as Error).message
    console.error('[policies/list] error:', msg)
    if (/relation .*policies.* does not exist/i.test(msg)) {
      return c.json({ policies: [], warning: 'policies_table_missing' })
    }
    return c.json({ policies: [], error: msg }, 500)
  }
})

// POST /policies — create a policy
app.post('/', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json<{
    name: string
    trigger: PolicyTrigger
    conditions: PolicyConditions
    action: PolicyAction
  }>()

  const { name, trigger, conditions, action } = body
  if (!name || !trigger || !action) {
    return c.json({ error: 'name, trigger, and action required' }, 400)
  }

  const VALID_TRIGGERS: PolicyTrigger[] = ['trial_cancel', 'spend_alert', 'inactivity_pause']
  const VALID_ACTIONS: PolicyAction[] = ['cancel', 'pause', 'remind', 'alert']
  if (!VALID_TRIGGERS.includes(trigger)) return c.json({ error: 'Invalid trigger' }, 400)
  if (!VALID_ACTIONS.includes(action)) return c.json({ error: 'Invalid action' }, 400)

  const [policy] = await sql`
    INSERT INTO policies (user_id, name, trigger, conditions, action)
    VALUES (${auth.dbUserId}, ${name}, ${trigger}, ${JSON.stringify(conditions)}, ${action})
    RETURNING *
  `
  return c.json({ policy }, 201)
})

// PATCH /policies/:id — toggle enabled or update conditions
app.patch('/:id', async (c) => {
  const auth = await authenticateCaller(c)
  const { id } = c.req.param()
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json<{ enabled?: boolean; name?: string; conditions?: PolicyConditions }>()

  const [existing] = await sql`
    SELECT id FROM policies WHERE id = ${id} AND user_id = ${auth.dbUserId}
  `
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const [updated] = await sql`
    UPDATE policies SET
      enabled = COALESCE(${body.enabled ?? null}, enabled),
      name = COALESCE(${body.name ?? null}, name),
      conditions = COALESCE(${body.conditions ? JSON.stringify(body.conditions) : null}::jsonb, conditions)
    WHERE id = ${id}
    RETURNING *
  `
  return c.json({ policy: updated })
})

// DELETE /policies/:id
app.delete('/:id', async (c) => {
  const auth = await authenticateCaller(c)
  const { id } = c.req.param()
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)

  const [deleted] = await sql`
    DELETE FROM policies WHERE id = ${id} AND user_id = ${auth.dbUserId} RETURNING id
  `
  if (!deleted) return c.json({ error: 'Not found' }, 404)
  return c.json({ deleted: true })
})

// POST /policies/evaluate — run all enabled policies for user against their subscriptions
// Returns what would fire (dry-run) or executes through executeDecision if { apply: true }
app.post('/evaluate', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)

  const body = await readBody<{ apply: boolean }>(c)
  const apply = body.apply ?? false
  const dbUserId = auth.dbUserId
  const userId = auth.privyDid

  type DBPolicy = { id: string; name: string; trigger: string; action: string; conditions: PolicyConditions }
  type DBSub = { id: string; merchant: string; name?: string; amount: number; currency: string; cadence: string; status: string; source: string; category?: string; last_charged: string | null; created_at: string }
  type DBEvent = { policy_id: string; subscription_id: string }

  const policies = (await sql`
    SELECT * FROM policies WHERE user_id = ${dbUserId} AND enabled = true
  `) as DBPolicy[]
  const subs = (await sql`
    SELECT id, name, merchant, amount, currency, cadence, status, source, category, last_charged, created_at
    FROM subscriptions WHERE user_id = ${dbUserId} AND status = 'active'
  `) as DBSub[]

  const monthlyTotal = subs.reduce((sum: number, s: DBSub) => {
    const usd = toUsd(s.amount, s.currency)
    if (s.cadence === 'yearly') return sum + usd / 12
    if (s.cadence === 'weekly') return sum + usd * 4.33
    if (s.cadence === 'daily') return sum + usd * 30
    return sum + usd
  }, 0)

  const fired: Array<{
    policy_id: string
    policy_name: string
    trigger: string
    action: string
    subscription_id: string | null
    merchant: string | null
    reason: string
    dispatch_status?: string
  }> = []

  const alreadyFired = (await sql`
    SELECT policy_id, subscription_id FROM policy_events
    WHERE policy_id = ANY(${policies.map((p) => p.id)})
  `) as DBEvent[]
  const firedSet = new Set(alreadyFired.map((e) => `${e.policy_id}:${e.subscription_id}`))
  const firedPolicyIds = new Set(alreadyFired.map((e) => e.policy_id))

  for (const policy of policies) {
    const cond: PolicyConditions = policy.conditions ?? {}

    if (policy.trigger === 'spend_alert') {
      const threshold = toUsd(cond.spend_threshold ?? 0, cond.currency ?? 'USD')
      if (subs.length > 0 && monthlyTotal >= threshold && !firedPolicyIds.has(policy.id)) {
        fired.push({
          policy_id: policy.id,
          policy_name: policy.name,
          trigger: policy.trigger,
          action: policy.action,
          subscription_id: null,
          merchant: null,
          reason: `Monthly spend $${monthlyTotal.toFixed(2)} exceeds threshold $${threshold.toFixed(2)}`,
        })
        if (apply) {
          await sql`INSERT INTO policy_events (policy_id, subscription_id, action) VALUES (${policy.id}, ${subs[0].id}, ${policy.action}) ON CONFLICT DO NOTHING`
          await sql`UPDATE policies SET last_triggered_at = NOW() WHERE id = ${policy.id}`
        }
      }
    }

    for (const sub of subs) {
      const key = `${policy.id}:${sub.id}`
      if (firedSet.has(key)) continue
      if (cond.merchant && sub.merchant !== cond.merchant) continue

      if (policy.trigger === 'trial_cancel') {
        const days = cond.trial_days ?? 7
        const age = (Date.now() - new Date(sub.created_at).getTime()) / 86_400_000
        // Precise trial check: requires 'trial' in merchant name or title, zero amount, or trial category.
        // Never matches solely because source is 'gmail'.
        const isTrialMerchant = /trial/i.test(sub.merchant) || /trial/i.test(sub.name ?? '')
        const isZeroAmountTrial = Number(sub.amount) === 0
        const looksLikeTrial = isTrialMerchant || isZeroAmountTrial || sub.category === 'trial'

        if (age >= days && looksLikeTrial) {
          const reason = `Trial older than ${days} days (age: ${Math.floor(age)}d)`
          let dispatchStatus: string | undefined

          if (policy.action === 'cancel') {
            const dispatchRes = await executeSubscriptionById({
              subscriptionId: sub.id,
              trigger: 'policy',
              dbUserId,
              userPrivyDid: userId,
              apply,
              rationale: `Cancelled by policy "${policy.name}": ${reason}`,
            })
            dispatchStatus = dispatchRes.status
            if (apply && dispatchRes.status === 'sent') {
              await sql`INSERT INTO policy_events (policy_id, subscription_id, action) VALUES (${policy.id}, ${sub.id}, ${policy.action}) ON CONFLICT DO NOTHING`
              await sql`UPDATE policies SET last_triggered_at = NOW() WHERE id = ${policy.id}`
            }
          } else {
            if (apply) {
              const newStatus = policy.action === 'pause' ? 'paused' : sub.status
              if (newStatus !== sub.status) {
                await sql`UPDATE subscriptions SET status = ${newStatus} WHERE id = ${sub.id}`
                await logAction({ subscriptionId: sub.id, actionType: policy.action, triggeredBy: 'policy', userPrivyDid: userId, reversible: true })
              }
              await sql`INSERT INTO policy_events (policy_id, subscription_id, action) VALUES (${policy.id}, ${sub.id}, ${policy.action}) ON CONFLICT DO NOTHING`
              await sql`UPDATE policies SET last_triggered_at = NOW() WHERE id = ${policy.id}`
            }
          }

          fired.push({
            policy_id: policy.id,
            policy_name: policy.name,
            trigger: policy.trigger,
            action: policy.action,
            subscription_id: sub.id,
            merchant: sub.merchant,
            reason,
            dispatch_status: dispatchStatus,
          })
        }
      }

      if (policy.trigger === 'inactivity_pause') {
        const days = cond.inactive_days ?? 30
        if (!sub.last_charged) continue
        const daysSince = (Date.now() - new Date(sub.last_charged).getTime()) / 86_400_000
        if (daysSince >= days) {
          const reason = `No charge in ${Math.floor(daysSince)} days (threshold: ${days}d)`
          let dispatchStatus: string | undefined

          if (policy.action === 'cancel') {
            const dispatchRes = await executeSubscriptionById({
              subscriptionId: sub.id,
              trigger: 'policy',
              dbUserId,
              userPrivyDid: userId,
              apply,
              rationale: `Cancelled by policy "${policy.name}": ${reason}`,
            })
            dispatchStatus = dispatchRes.status
            if (apply && dispatchRes.status === 'sent') {
              await sql`INSERT INTO policy_events (policy_id, subscription_id, action) VALUES (${policy.id}, ${sub.id}, ${policy.action}) ON CONFLICT DO NOTHING`
              await sql`UPDATE policies SET last_triggered_at = NOW() WHERE id = ${policy.id}`
            }
          } else {
            if (apply) {
              const newStatus = 'paused'
              if (newStatus !== sub.status) {
                await sql`UPDATE subscriptions SET status = ${newStatus} WHERE id = ${sub.id}`
                await logAction({ subscriptionId: sub.id, actionType: policy.action, triggeredBy: 'policy', userPrivyDid: userId, reversible: true })
              }
              await sql`INSERT INTO policy_events (policy_id, subscription_id, action) VALUES (${policy.id}, ${sub.id}, ${policy.action}) ON CONFLICT DO NOTHING`
              await sql`UPDATE policies SET last_triggered_at = NOW() WHERE id = ${policy.id}`
            }
          }

          fired.push({
            policy_id: policy.id,
            policy_name: policy.name,
            trigger: policy.trigger,
            action: policy.action,
            subscription_id: sub.id,
            merchant: sub.merchant,
            reason,
            dispatch_status: dispatchStatus,
          })
        }
      }
    }

    await sql`UPDATE policies SET last_evaluated_at = NOW() WHERE id = ${policy.id}`
  }

  return c.json({ evaluated: policies.length, fired: fired.length, results: fired, applied: apply })
})

export default app
