import { Hono } from 'hono'
import { sql, getOrCreateUser } from '../lib/db.js'
import { complete } from '../lib/ai.js'

const app = new Hono()

// Known cancellation URLs — shared with frontend CANCEL_URLS
const CANCEL_URLS: Record<string, string> = {
  Netflix: 'https://www.netflix.com/cancelplan',
  Spotify: 'https://www.spotify.com/account/subscription/cancel',
  'GitHub Copilot': 'https://github.com/settings/copilot',
  GitHub: 'https://github.com/settings/billing',
  Figma: 'https://www.figma.com/settings/billing',
  Adobe: 'https://account.adobe.com/plans',
  Dropbox: 'https://www.dropbox.com/account/plan',
  'Notion AI': 'https://www.notion.so/profile/billing',
  Zoom: 'https://zoom.us/billing',
  Slack: 'https://slack.com/account/settings',
  Grammarly: 'https://account.grammarly.com/subscription',
  Canva: 'https://www.canva.com/settings/billing',
  'ChatGPT Plus': 'https://chat.openai.com/settings/subscription',
  Midjourney: 'https://www.midjourney.com/account/',
  'Amazon Prime': 'https://www.amazon.com/mc/pipelines/cancellation',
  'Disney+': 'https://www.disneyplus.com/account/subscription',
  Hulu: 'https://secure.hulu.com/account/cancel_confirm',
  'YouTube Premium': 'https://music.youtube.com/paid_memberships',
  Duolingo: 'https://www.duolingo.com/settings/subscription',
  Linear: 'https://linear.app/settings/billing',
  Vercel: 'https://vercel.com/account/billing',
  Loom: 'https://www.loom.com/settings/subscriptions',
  Zapier: 'https://zapier.com/app/billing',
  Airtable: 'https://airtable.com/account',
}

// GET /actions — full action audit log for user
app.get('/', async (c) => {
  const userId = c.req.header('x-user-id')
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  const dbUserId = await getOrCreateUser(userId)
  const rows = await sql`
    SELECT a.id, a.type, a.triggered_by, a.executed_at, a.reversible,
           a.reversed_at, a.signature, a.agent_address,
           s.merchant, s.amount, s.currency, s.cadence, s.id AS subscription_id, s.status
    FROM actions a
    JOIN subscriptions s ON s.id = a.subscription_id
    WHERE s.user_id = ${dbUserId}
    ORDER BY a.executed_at DESC
    LIMIT 100
  `
  return c.json({ actions: rows })
})

// PATCH /actions/:id/reverse — undo a reversible action
app.patch('/:id/reverse', async (c) => {
  const userId = c.req.header('x-user-id')
  const { id } = c.req.param()
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  const dbUserId = await getOrCreateUser(userId)

  const [action] = await sql`
    SELECT a.id, a.type, a.reversible, a.reversed_at, a.subscription_id
    FROM actions a
    JOIN subscriptions s ON s.id = a.subscription_id
    WHERE a.id = ${id} AND s.user_id = ${dbUserId}
  `

  if (!action) return c.json({ error: 'Not found' }, 404)
  if (!action.reversible) return c.json({ error: 'Action is not reversible' }, 400)
  if (action.reversed_at) return c.json({ error: 'Already reversed' }, 400)

  // Re-activate the subscription
  await sql`UPDATE subscriptions SET status = 'active' WHERE id = ${action.subscription_id}`
  await sql`UPDATE actions SET reversed_at = NOW() WHERE id = ${id}`

  return c.json({ reversed: true, subscription_id: action.subscription_id })
})

// GET /actions/:subscriptionId/cancel-guide — AI-generated cancellation guide
app.get('/cancel-guide/:subscriptionId', async (c) => {
  const userId = c.req.header('x-user-id')
  const { subscriptionId } = c.req.param()
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  const dbUserId = await getOrCreateUser(userId)
  const [sub] = await sql`
    SELECT merchant, amount, currency, cadence
    FROM subscriptions WHERE id = ${subscriptionId} AND user_id = ${dbUserId}
  `
  if (!sub) return c.json({ error: 'Not found' }, 404)

  const cancelUrl = CANCEL_URLS[sub.merchant] ?? null

  const steps = await complete([
    {
      role: 'system',
      content: 'You are SAM. Give exactly 3 numbered steps to cancel a specific subscription. Be concise and specific about UI locations. No fluff.',
    },
    {
      role: 'user',
      content: `How do I cancel my ${sub.merchant} subscription? It costs ${sub.currency === 'USD' ? '$' : ''}${sub.amount}/${sub.cadence}.`,
    },
  ], { maxTokens: 200, temperature: 0.2 })

  return c.json({
    merchant: sub.merchant,
    cancelUrl,
    steps,
    timeEstimate: '2–5 minutes',
  })
})

export default app
