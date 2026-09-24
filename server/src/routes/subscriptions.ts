import { Hono } from 'hono'
import { sql } from '../lib/db.js'
import { getCachedInsight, setCachedInsight, invalidateInsight, redis } from '../lib/cache.js'
import { generateSubscriptionInsight } from '../lib/ai.js'
import { SUBSCRIPTION_REGISTRY } from '../lib/subscriptions-registry.js'
import { authenticateCaller } from '../lib/auth.js'

const app = new Hono()

const REGISTERED_MERCHANT_NAMES = new Set(
  SUBSCRIPTION_REGISTRY.map((s) => s.name.toLowerCase())
)

app.get('/', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)

  const rows = (await sql`
    SELECT s.*,
      json_agg(sig ORDER BY sig.created_at DESC) FILTER (WHERE sig.id IS NOT NULL) AS signals,
      json_agg(r ORDER BY r.confidence DESC) FILTER (WHERE r.id IS NOT NULL) AS recommendations
    FROM subscriptions s
    LEFT JOIN signals sig ON sig.subscription_id = s.id
    LEFT JOIN recommendations r ON r.subscription_id = s.id AND r.status = 'pending'
    WHERE s.user_id = ${auth.dbUserId} AND s.status = 'active'
    GROUP BY s.id
    ORDER BY s.amount DESC, s.detected_at DESC
  `) as unknown as Record<string, unknown>[]

  // 1. Exclude legacy non-subscription entries (banks/fintech alerts & shopping orders)
  const nonExcluded = rows.filter((r) => {
    const m = ((r.merchant as string) || (r.name as string) || '').toLowerCase()
    return (
      !m.includes('opay') &&
      !m.includes('moniepoint') &&
      !m.includes('palmpay') &&
      !m.includes('kuda') &&
      !m.includes('orders.temu') &&
      !m.includes('temu@')
    )
  })

  // 2. Deduplicate by merchant (prefer rows with positive amount, then latest detected_at)
  const byMerchant = new Map<string, Record<string, unknown>>()
  for (const r of nonExcluded) {
    const key = ((r.merchant as string) || (r.name as string) || '').trim().toLowerCase()
    const existing = byMerchant.get(key)
    if (!existing) {
      byMerchant.set(key, r)
    } else {
      const curAmount = parseFloat(r.amount as string) || 0
      const prevAmount = parseFloat(existing.amount as string) || 0
      if (curAmount > 0 && prevAmount === 0) {
        byMerchant.set(key, r)
      }
    }
  }

  const deduplicated = Array.from(byMerchant.values()).map((r) => ({
    ...r,
    amount: parseFloat(r.amount as string),
  }))

  return c.json({
    subscriptions: deduplicated,
  })
})

app.get('/:id', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)
  const { id } = c.req.param()

  const [sub] = await sql`
    SELECT * FROM subscriptions WHERE id = ${id} AND user_id = ${auth.dbUserId}
  `
  if (!sub) return c.json({ error: 'Not found' }, 404)
  sub.amount = parseFloat(sub.amount)

  const signals = await sql`
    SELECT * FROM signals WHERE subscription_id = ${id} ORDER BY created_at DESC
  `

  let insight = await getCachedInsight(id)
  if (!insight && signals.length > 0) {
    insight = await generateSubscriptionInsight({
      name: sub.name,
      amount: sub.amount,
      cadence: sub.cadence,
      signals: signals.map((s: any) => `${s.type}: ${s.value}`),
    })
    if (insight) await setCachedInsight(id, insight)
  }

  return c.json({ subscription: sub, signals, insight })
})

// POST /subscriptions/purge-unregistered
app.post('/purge-unregistered', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)

  const rows = await sql`
    SELECT id, merchant FROM subscriptions WHERE user_id = ${auth.dbUserId}
  `

  const stale = (rows as any[]).filter(
    (r) => !REGISTERED_MERCHANT_NAMES.has((r.merchant as string).toLowerCase())
  )
  if (stale.length === 0) return c.json({ deleted: 0, merchants: [] })

  const ids = stale.map((r) => r.id as string)
  await sql`DELETE FROM subscriptions WHERE id = ANY(${ids})`

  return c.json({
    deleted: stale.length,
    merchants: stale.map((r) => r.merchant as string),
  })
})

app.patch('/:id/status', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)
  const { id } = c.req.param()

  const { status } = await c.req.json<{ status: string }>()
  if (!['active', 'paused', 'cancelled'].includes(status)) {
    return c.json({ error: 'Invalid status' }, 400)
  }

  const [updated] = await sql`
    UPDATE subscriptions SET status = ${status}
    WHERE id = ${id} AND user_id = ${auth.dbUserId}
    RETURNING *
  `
  if (!updated) return c.json({ error: 'Not found' }, 404)

  await invalidateInsight(id)
  return c.json({ subscription: { ...updated, amount: parseFloat(updated.amount) } })
})

app.delete('/', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)
  const source = c.req.query('source')

  const subs = source
    ? await sql`DELETE FROM subscriptions WHERE user_id = ${auth.dbUserId} AND source = ${source} RETURNING id`
    : await sql`DELETE FROM subscriptions WHERE user_id = ${auth.dbUserId} RETURNING id`

  for (const s of subs as { id: string }[]) {
    await invalidateInsight(s.id)
    await redis.del(`renewal:${s.id}`)
  }

  return c.json({ deleted: subs.length })
})

app.delete('/:id', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)
  const { id } = c.req.param()

  const [deleted] = await sql`
    DELETE FROM subscriptions WHERE id = ${id} AND user_id = ${auth.dbUserId}
    RETURNING id
  `
  if (!deleted) return c.json({ error: 'Not found' }, 404)

  await invalidateInsight(id)
  await redis.del(`renewal:${id}`)
  return c.json({ deleted: true, id })
})

export default app
