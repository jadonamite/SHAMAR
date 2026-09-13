import { Hono } from 'hono'
import { getOrCreateUser, sql } from '../lib/db.js'
import { tick, pollDecisions, getNotice, stageNotice } from '../lib/renewal.js'

const app = new Hono()

// POST /renewals/tick — one pass: apply button presses, send due notices,
// auto-cancel anything undecided in the final window. Dry-run by default.
app.post('/tick', async (c) => {
  const userId = c.req.header('x-user-id')
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)
  const body = await c.req.json<{ apply?: boolean }>().catch(() => ({}) as { apply?: boolean })
  const dbUserId = await getOrCreateUser(userId)
  return c.json(await tick(dbUserId, { apply: body.apply ?? false }))
})

// POST /renewals/poll — read button presses without running the schedule
app.post('/poll', async (c) => c.json({ applied: await pollDecisions() }))

// GET /renewals/:id — notice state for one subscription
app.get('/:id', async (c) => {
  const state = await getNotice(c.req.param('id'))
  return state ? c.json(state) : c.json({ error: 'No notice' }, 404)
})

// POST /renewals/stage — position a subscription near its renewal so the
// escalation can be demonstrated without waiting for real time to pass.
app.post('/stage', async (c) => {
  const userId = c.req.header('x-user-id')
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)
  const { merchant, hours_out = 100, notices_sent = 0 } =
    await c.req.json<{ merchant: string; hours_out?: number; notices_sent?: number }>()

  const dbUserId = await getOrCreateUser(userId)
  const [sub] = await sql`
    SELECT id, merchant FROM subscriptions
    WHERE user_id = ${dbUserId} AND merchant ILIKE ${merchant} AND status = 'active' LIMIT 1
  `
  if (!sub) return c.json({ error: `No active subscription matching ${merchant}` }, 404)
  return c.json(await stageNotice(sub.id, sub.merchant, hours_out, notices_sent))
})

export default app
