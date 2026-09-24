import { Hono } from 'hono'
import { sql } from '../lib/db.js'
import { logAction } from '../lib/actions.js'
import { authenticateCaller } from '../lib/auth.js'

const app = new Hono()

// GET /recommendations — all pending recs for the user, joined with subscription data
app.get('/', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)

  const rows = await sql`
    SELECT
      r.id,
      r.action,
      r.confidence,
      r.evidence,
      r.status,
      r.created_at,
      s.id          AS subscription_id,
      s.merchant,
      s.name,
      s.amount,
      s.currency,
      s.cadence,
      s.source,
      s.last_charged
    FROM recommendations r
    JOIN subscriptions s ON s.id = r.subscription_id
    WHERE s.user_id = ${auth.dbUserId}
      AND r.status = 'pending'
      AND s.status = 'active'
    ORDER BY r.confidence DESC
  `
  return c.json({
    recommendations: rows.map((r: Record<string, unknown>) => ({
      ...r,
      amount: parseFloat(r.amount as string),
    })),
  })
})

// PATCH /recommendations/:id — accept or dismiss
app.patch('/:id', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)
  const { id } = c.req.param()

  const { status } = await c.req.json<{ status: 'accepted' | 'dismissed' }>()
  if (!['accepted', 'dismissed'].includes(status)) {
    return c.json({ error: 'status must be accepted or dismissed' }, 400)
  }

  // Verify rec belongs to this user
  const [rec] = await sql`
    SELECT r.id, r.action, r.subscription_id
    FROM recommendations r
    JOIN subscriptions s ON s.id = r.subscription_id
    WHERE r.id = ${id} AND s.user_id = ${auth.dbUserId}
  `
  if (!rec) return c.json({ error: 'Not found' }, 404)

  await sql`UPDATE recommendations SET status = ${status} WHERE id = ${id}`

  // On accept: apply the action to the subscription and record a signed,
  // attributable audit entry (same path the policy engine uses).
  if (status === 'accepted') {
    if (rec.action === 'cancel') {
      await sql`UPDATE subscriptions SET status = 'cancelled' WHERE id = ${rec.subscription_id}`
    } else if (rec.action === 'pause') {
      await sql`UPDATE subscriptions SET status = 'paused' WHERE id = ${rec.subscription_id}`
    }

    if (['cancel', 'pause', 'remind'].includes(rec.action)) {
      await logAction({
        subscriptionId: rec.subscription_id,
        actionType: rec.action,
        triggeredBy: 'user',
        userPrivyDid: auth.privyDid,
        reversible: rec.action !== 'remind',
      })
    }
  }

  return c.json({ ok: true, action_taken: status === 'accepted' ? rec.action : null })
})

export default app
