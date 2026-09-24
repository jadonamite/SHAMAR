import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { sql } from './lib/db.js'
import { tick } from './lib/renewal.js'
import { sendEmail, reminderEmail } from './lib/email.js'
import subscriptions from './routes/subscriptions.js'
import gmail from './routes/gmail.js'
import intelligence from './routes/intelligence.js'
import wallet from './routes/wallet.js'
import recommendations from './routes/recommendations.js'
import agent from './routes/agent.js'
import reminders from './routes/reminders.js'
import actions from './routes/actions.js'
import policies from './routes/policies.js'
import execute from './routes/execute.js'
import renewals from './routes/renewals.js'
import telegram from './routes/telegram.js'
import account from './routes/account.js'

const app = new Hono()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return '*'
      if (
        origin.includes('namite.xyz') ||
        origin.includes('vercel.app') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        return origin
      }
      return process.env.FRONTEND_URL ?? origin
    },
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'authorization',
      'x-user-id',
      'x-wallet-address',
      'x-wallet-signature',
      'x-wallet-timestamp',
      'x-cron-secret',
    ],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })
)

app.get('/health', (c) => c.json({ status: 'ok', service: 'shamar-server' }))

// Unified autonomous scheduler endpoint for cron-job.org or external runners
const handleCronRunner = async (c: Context) => {
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

  // 1. Process renewal escalations and auto-cancels for all active users
  const users = await sql`
    SELECT DISTINCT u.id, u.privy_did
    FROM users u
    JOIN subscriptions s ON s.user_id = u.id
    WHERE s.status = 'active'
  `

  const renewalResults: Record<string, unknown>[] = []
  for (const user of users) {
    try {
      const tickRes = await tick(user.id as string, { apply: true })
      renewalResults.push({ user_id: user.id, ...tickRes })
    } catch (err) {
      renewalResults.push({ user_id: user.id, error: (err as Error).message })
    }
  }

  // 2. Dispatch any due reminders
  const due = await sql`
    SELECT r.id, r.user_email, r.message, r.type,
           s.merchant, s.amount, s.currency, s.cadence
    FROM reminders r
    JOIN subscriptions s ON s.id = r.subscription_id
    WHERE r.sent_at IS NULL AND r.remind_at <= NOW()
    LIMIT 50
  `

  let sentReminders = 0
  for (const r of due) {
    if (r.user_email) {
      const ok = await sendEmail({
        to: r.user_email,
        subject: `Shamar: ${r.merchant} subscription reminder`,
        html: reminderEmail(r.merchant, r.amount, r.currency, r.cadence, r.message),
      })
      if (ok) {
        await sql`UPDATE reminders SET sent_at = NOW() WHERE id = ${r.id}`
        sentReminders++
      }
    }
  }

  return c.json({
    status: 'ok',
    ran_at: new Date().toISOString(),
    renewals: { users_checked: users.length, results: renewalResults },
    reminders: { due: due.length, sent: sentReminders },
  })
}

app.get('/cron/runner', handleCronRunner)
app.post('/cron/runner', handleCronRunner)

app.route('/subscriptions', subscriptions)
app.route('/gmail', gmail)
app.route('/intelligence', intelligence)
app.route('/wallet', wallet)
app.route('/recommendations', recommendations)
app.route('/agent', agent)
app.route('/reminders', reminders)
app.route('/actions', actions)
app.route('/policies', policies)
app.route('/execute', execute)
app.route('/renewals', renewals)
app.route('/telegram', telegram)
app.route('/account', account)

export default app
