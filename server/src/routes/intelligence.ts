import { Hono } from 'hono'
import { sql, getOrCreateUser } from '../lib/db.js'
import { getCachedInsight, setCachedInsight } from '../lib/cache.js'
import { generateSubscriptionInsight } from '../lib/ai.js'
import { buildSignals, scoreSubscription, recommendAction, runAnalyzeAll } from '../lib/scoring.js'

const app = new Hono()

// POST /intelligence/analyze/:subscriptionId
app.post('/analyze/:id', async (c) => {
  const userId = c.req.header('x-user-id')
  const { id } = c.req.param()
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  const dbUserId = await getOrCreateUser(userId)
  const rows = await sql`
    SELECT * FROM subscriptions WHERE id = ${id} AND user_id = ${dbUserId}
  `
  const sub = rows[0] as {
    amount: number
    currency: string
    cadence: string
    last_charged: Date | null
    detected_at: Date
    name: string
  } | undefined
  if (!sub) return c.json({ error: 'Not found' }, 404)

  const signals = buildSignals(sub)
  const confidence = scoreSubscription(signals)
  const action = recommendAction(confidence, signals)

  for (const sig of signals) {
    await sql`
      INSERT INTO signals (subscription_id, type, value, weight)
      VALUES (${id}, ${sig.type}, ${sig.label}, ${sig.value})
      ON CONFLICT DO NOTHING
    `
  }

  await sql`DELETE FROM recommendations WHERE subscription_id = ${id}`
  const [rec] = await sql`
    INSERT INTO recommendations (subscription_id, action, confidence, evidence)
    VALUES (${id}, ${action}, ${confidence}, ${JSON.stringify(signals.map((s) => s.label))})
    RETURNING *
  `

  let insight = await getCachedInsight(id)
  if (!insight) {
    insight = await generateSubscriptionInsight({
      name: sub.name,
      amount: sub.amount,
      cadence: sub.cadence,
      signals: signals.map((s) => s.label),
    })
    if (insight) await setCachedInsight(id, insight)
  }

  return c.json({ confidence, action, signals, recommendation: rec, insight })
})

// POST /intelligence/analyze-all — score + persist all active subs for a user
app.post('/analyze-all', async (c) => {
  const userId = c.req.header('x-user-id')
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  const dbUserId = await getOrCreateUser(userId)
  const analyzed = await runAnalyzeAll(dbUserId)
  return c.json({ analyzed })
})

export default app
