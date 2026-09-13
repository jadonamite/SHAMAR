import { Hono } from 'hono'
import { sql, getOrCreateUser } from '../lib/db.js'
import {
  isAgentConfigured,
  getAgentAddress,
  getPolicyContract,
  checkOnchainAuthorization,
  SCOPES,
} from '../lib/agent.js'
import { logAction } from '../lib/actions.js'

const app = new Hono()

// GET /agent/status — agent identity + user's policy grant status
app.get('/status', async (c) => {
  const userId = c.req.header('x-user-id')
  const agentReady = isAgentConfigured()

  let userStatus = null
  let onchainAuthorized = false

  if (userId) {
    const dbUserId = await getOrCreateUser(userId)
    const [row] = await sql`
      SELECT self_verified, self_verified_at, policy_granted, policy_granted_at, wallet_address
      FROM users WHERE id = ${dbUserId}
    `
    userStatus = row ?? null

    if (row?.wallet_address) {
      onchainAuthorized = await checkOnchainAuthorization(row.wallet_address, SCOPES.ANALYZE)
    }
  }

  return c.json({
    agent: {
      address: getAgentAddress(),
      configured: agentReady,
      policyContract: getPolicyContract() || null,
      erc8004Registry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
      scan8004Url: `https://8004scan.me/agent/${getAgentAddress()}`,
    },
    user: userStatus,
    onchainAuthorized,
  })
})

// POST /agent/attest — log a signed attestation for an action
app.post('/attest', async (c) => {
  const userId = c.req.header('x-user-id')
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json<{
    subscription_id: string
    action_type: string
    triggered_by: 'user' | 'policy'
    reversible?: boolean
  }>()

  const { subscription_id, action_type, triggered_by, reversible = true } = body
  if (!subscription_id || !action_type) {
    return c.json({ error: 'subscription_id and action_type required' }, 400)
  }

  const dbUserId = await getOrCreateUser(userId)

  // Confirm subscription belongs to this user
  const [sub] = await sql`
    SELECT id FROM subscriptions WHERE id = ${subscription_id} AND user_id = ${dbUserId}
  `
  if (!sub) return c.json({ error: 'Not found' }, 404)

  const { action, attestation } = await logAction({
    subscriptionId: subscription_id,
    actionType: action_type,
    triggeredBy: triggered_by,
    userPrivyDid: userId,
    reversible,
  })

  return c.json({ action, attestation })
})

// GET /agent/history — recent actions for a user
app.get('/history', async (c) => {
  const userId = c.req.header('x-user-id')
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  const dbUserId = await getOrCreateUser(userId)
  const rows = await sql`
    SELECT a.id, a.type, a.triggered_by, a.executed_at, a.reversible,
           a.signature, a.agent_address, a.metadata,
           s.merchant, s.amount, s.currency
    FROM actions a
    JOIN subscriptions s ON s.id = a.subscription_id
    WHERE s.user_id = ${dbUserId}
    ORDER BY a.executed_at DESC
    LIMIT 50
  `
  return c.json({ actions: rows })
})

// POST /agent/grant-policy — user explicitly grants SAM policy execution
app.post('/grant-policy', async (c) => {
  const userId = c.req.header('x-user-id')
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  const dbUserId = await getOrCreateUser(userId)
  await sql`
    UPDATE users
    SET policy_granted = true, policy_granted_at = NOW()
    WHERE id = ${dbUserId}
  `
  return c.json({ granted: true })
})

// POST /agent/revoke-policy — user revokes SAM policy execution
app.post('/revoke-policy', async (c) => {
  const userId = c.req.header('x-user-id')
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  const dbUserId = await getOrCreateUser(userId)
  await sql`UPDATE users SET policy_granted = false WHERE id = ${dbUserId}`
  return c.json({ revoked: true })
})

export default app
