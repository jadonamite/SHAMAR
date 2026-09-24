import { Hono } from 'hono'
import { readBody } from '../lib/body.js'
import { authenticateCaller } from '../lib/auth.js'
import {
  gatherEvidence,
  decide,
  persistDecision,
  quickPass,
  reasonOverAll,
} from '../lib/reasoning.js'

const app = new Hono()

// POST /intelligence/analyze/:id — full model reasoning for one subscription
app.post('/analyze/:id', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)
  const { id } = c.req.param()

  const evidence = (await gatherEvidence(auth.dbUserId)).find((e) => e.subscription_id === id)
  if (!evidence) return c.json({ error: 'Not found' }, 404)

  const decision = await decide(evidence)
  await persistDecision(decision)

  return c.json({ evidence, decision })
})

// POST /intelligence/reason — model reasoning across every active subscription.
// Dry-run by default: returns decisions without writing recommendations.
app.post('/reason', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)

  const body = await readBody<{ persist: boolean }>(c)

  const t0 = Date.now()
  const decisions = await reasonOverAll(auth.dbUserId, { persist: body.persist ?? false })

  const actionable = decisions.filter((d) => d.action === 'cancel' || d.action === 'pause')
  return c.json({
    reasoned: decisions.length,
    actionable: actionable.length,
    monthly_savings_usd: Number(
      actionable.reduce((sum, d) => sum + d.savings_usd_monthly, 0).toFixed(2)
    ),
    fell_back: decisions.filter((d) => d.reasoned_by === 'fallback').length,
    persisted: body.persist ?? false,
    elapsed_ms: Date.now() - t0,
    decisions,
  })
})

// POST /intelligence/analyze-all — deterministic pass, no model calls
app.post('/analyze-all', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)

  const analyzed = await quickPass(auth.dbUserId)
  return c.json({ analyzed })
})

// GET /intelligence/evidence — raw facts the reasoning runs on
app.get('/evidence', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)

  return c.json({ evidence: await gatherEvidence(auth.dbUserId) })
})

export default app
