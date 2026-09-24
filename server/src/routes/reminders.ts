import { Hono, type Context } from 'hono'
import { sql } from '../lib/db.js'
import { sendEmail, reminderEmail } from '../lib/email.js'
import { authenticateCaller } from '../lib/auth.js'

const app = new Hono()

// GET /reminders — list user's upcoming (unsent) reminders
app.get('/', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)

  const rows = await sql`
    SELECT r.id, r.type, r.remind_at, r.sent_at, r.message, r.user_email,
           s.merchant, s.amount, s.currency, s.cadence, s.id AS subscription_id
    FROM reminders r
    JOIN subscriptions s ON s.id = r.subscription_id
    WHERE r.user_id = ${auth.dbUserId}
    ORDER BY r.remind_at ASC
  `
  return c.json({ reminders: rows })
})

// POST /reminders — schedule a reminder
app.post('/', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json<{
    subscription_id: string
    remind_at: string      // ISO datetime
    type?: string
    message?: string
    user_email?: string
  }>()

  const { subscription_id, remind_at, type = 'review', message, user_email } = body
  if (!subscription_id || !remind_at) {
    return c.json({ error: 'subscription_id and remind_at required' }, 400)
  }

  const remindDate = new Date(remind_at)
  if (isNaN(remindDate.getTime()) || remindDate <= new Date()) {
    return c.json({ error: 'remind_at must be a future date' }, 400)
  }

  // Confirm subscription belongs to user
  const [sub] = await sql`
    SELECT id FROM subscriptions WHERE id = ${subscription_id} AND user_id = ${auth.dbUserId}
  `
  if (!sub) return c.json({ error: 'Not found' }, 404)

  const [reminder] = await sql`
    INSERT INTO reminders (subscription_id, user_id, type, remind_at, message, user_email)
    VALUES (${subscription_id}, ${auth.dbUserId}, ${type}, ${remind_at}, ${message ?? null}, ${user_email ?? null})
    RETURNING *
  `
  return c.json({ reminder }, 201)
})

// DELETE /reminders/:id — cancel a reminder
app.delete('/:id', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)
  const { id } = c.req.param()

  const [deleted] = await sql`
    DELETE FROM reminders
    WHERE id = ${id} AND user_id = ${auth.dbUserId} AND sent_at IS NULL
    RETURNING id
  `
  if (!deleted) return c.json({ error: 'Not found or already sent' }, 404)
  return c.json({ deleted: true })
})

// send-due handler — send all unsent reminders due now
// Called by a cron job or external scheduler. Enforces CRON_SECRET.
const handleSendDue = async (c: Context) => {
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

  const due = await sql`
    SELECT r.id, r.user_email, r.message, r.type,
           s.merchant, s.amount, s.currency, s.cadence
    FROM reminders r
    JOIN subscriptions s ON s.id = r.subscription_id
    WHERE r.sent_at IS NULL AND r.remind_at <= NOW()
    LIMIT 50
  `

  let sent = 0
  let failed = 0

  for (const r of due) {
    if (!r.user_email) { failed++; continue }

    const ok = await sendEmail({
      to: r.user_email,
      subject: `Shamar: ${r.merchant} subscription reminder`,
      html: reminderEmail(r.merchant, r.amount, r.currency, r.cadence, r.message),
    })

    if (ok) {
      await sql`UPDATE reminders SET sent_at = NOW() WHERE id = ${r.id}`
      sent++
    } else {
      failed++
    }
  }

  return c.json({ processed: due.length, sent, failed })
}

app.post('/send-due', handleSendDue)
app.get('/send-due', handleSendDue)

export default app
