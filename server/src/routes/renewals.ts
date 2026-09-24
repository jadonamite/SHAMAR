import { Hono, type Context } from 'hono'
import { readBody } from '../lib/body.js'
import { sql } from '../lib/db.js'
import { tick, pollDecisions, getNotice, stageNotice } from '../lib/renewal.js'
import { authenticateCaller } from '../lib/auth.js'

const app = new Hono()

// POST /renewals/tick — one pass for authenticated user: apply button presses, send due notices,
// auto-cancel anything undecided in the final window. Dry-run by default.
app.post('/tick', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)
  const body = await readBody<{ apply: boolean }>(c)
  return c.json(await tick(auth.dbUserId, { apply: body.apply ?? false }))
})

// POST /renewals/poll — read button presses without running the schedule
app.post('/poll', async (c) => c.json({ applied: await pollDecisions() }))

// Autonomous renewal heartbeat: triggers hourly via cron or external scheduler
const runCron = async (c: Context) => {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = c.req.header('authorization')
  const secretHeader = c.req.header('x-cron-secret')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const provided = secretHeader || bearerToken

  if (process.env.NODE_ENV === 'production' && !cronSecret) {
    return c.json({ error: 'CRON_SECRET must be configured in production' }, 503)
  }
  if (cronSecret && provided !== cronSecret) {
    return c.json({ error: 'Unauthorized cron runner' }, 401)
  }

  const users = await sql`
    SELECT DISTINCT u.id, u.privy_did
    FROM users u
    JOIN subscriptions s ON s.user_id = u.id
    WHERE s.status = 'active'
  `

  const results: Record<string, unknown>[] = []
  for (const user of users) {
    try {
      const tickRes = await tick(user.id as string, { apply: true })
      results.push({ user_id: user.id, ...tickRes })
    } catch (err) {
      results.push({ user_id: user.id, error: (err as Error).message })
    }
  }

  return c.json({
    ran_at: new Date().toISOString(),
    users_processed: users.length,
    results,
  })
}

app.get('/cron', runCron)
app.post('/cron', runCron)

// GET /renewals/:id — notice state for one subscription
app.get('/:id', async (c) => {
  const state = await getNotice(c.req.param('id'))
  return state ? c.json(state) : c.json({ error: 'No notice' }, 404)
})

// POST /renewals/stage — position a subscription near its renewal so the
// escalation can be demonstrated without waiting for real time to pass.
app.post('/stage', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)
  const { merchant = '', hours_out = 100, notices_sent = 0 } =
    await readBody<{ merchant: string; hours_out: number; notices_sent: number }>(c)

  const [sub] = await sql`
    SELECT id, merchant FROM subscriptions
    WHERE user_id = ${auth.dbUserId} AND merchant ILIKE ${merchant} AND status = 'active' LIMIT 1
  `
  if (!sub) return c.json({ error: `No active subscription matching ${merchant}` }, 404)
  return c.json(await stageNotice(sub.id, sub.merchant, hours_out, notices_sent))
})

export default app
