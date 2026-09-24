import { Hono } from 'hono'
import { sql } from '../lib/db.js'
import {
  isAgentConfigured,
  getAgentAddress,
  getPolicyContract,
  checkOnchainAuthorization,
  SCOPES,
} from '../lib/agent.js'
import { logAction } from '../lib/actions.js'
import { authenticateCaller } from '../lib/auth.js'
import { getHaltState } from '../lib/telegram.js'

const app = new Hono()

// GET /agent/status — agent identity + user's policy grant status
app.get('/status', async (c) => {
  const auth = await authenticateCaller(c)
  const agentReady = isAgentConfigured()

  let userStatus = null
  let onchainAuthorized = false
  let halted = false

  if (auth) {
    const [row] = await sql`
      SELECT self_verified, self_verified_at, policy_granted, policy_granted_at, wallet_address, telegram_chat_id
      FROM users WHERE id = ${auth.dbUserId}
    `
    userStatus = row ?? null

    const haltState = await getHaltState(auth.dbUserId)
    halted = haltState.halted

    if (row?.wallet_address) {
      try {
        onchainAuthorized = await checkOnchainAuthorization(row.wallet_address, SCOPES.CANCEL)
      } catch {
        onchainAuthorized = false
      }
    }
  }

  let state: 'authorized' | 'halted' | 'blocked' | 'unauthorized' = 'unauthorized'
  let reason = 'Wallet not connected or policy session key not yet granted on Base.'

  if (halted) {
    state = 'halted'
    reason = 'Agent is paused via Telegram /stop. Send /resume in Telegram to re-enable.'
  } else if (onchainAuthorized) {
    state = 'authorized'
    reason = 'Authorized on Base mainnet. SHAMAR will act on your subscriptions within policy.'
  } else if (userStatus?.wallet_address) {
    state = 'unauthorized'
    reason = 'Policy not granted on Base mainnet. Grant permissions in your wallet to enable automated actions.'
  }

  return c.json({
    state,
    reason,
    contract: getPolicyContract() || null,
    agent: getAgentAddress(),
    scopes: [SCOPES.CANCEL, SCOPES.PAUSE, SCOPES.REMIND, SCOPES.ANALYZE, SCOPES.PAY],
    halted,
    onchainAuthorized,
    agentDetails: {
      address: getAgentAddress(),
      configured: agentReady,
      policyContract: getPolicyContract() || null,
      erc8004Registry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
      scan8004Url: `https://8004scan.me/agent/${getAgentAddress()}`,
    },
    user: userStatus,
  })
})

// POST /agent/attest — log a signed attestation for an action
app.post('/attest', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)

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

  // Confirm subscription belongs to this user
  const [sub] = await sql`
    SELECT id FROM subscriptions WHERE id = ${subscription_id} AND user_id = ${auth.dbUserId}
  `
  if (!sub) return c.json({ error: 'Not found' }, 404)

  const { action, attestation } = await logAction({
    subscriptionId: subscription_id,
    actionType: action_type,
    triggeredBy: triggered_by,
    userPrivyDid: auth.privyDid,
    reversible,
  })

  return c.json({ action, attestation })
})

// GET /agent/history — recent actions for a user
app.get('/history', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)

  const rows = await sql`
    SELECT a.id, a.type, a.triggered_by, a.executed_at, a.reversible,
           a.signature, a.agent_address, a.metadata,
           s.merchant, s.amount, s.currency
    FROM actions a
    JOIN subscriptions s ON s.id = a.subscription_id
    WHERE s.user_id = ${auth.dbUserId}
    ORDER BY a.executed_at DESC
    LIMIT 50
  `
  return c.json({ actions: rows })
})

// POST /agent/grant-policy — user explicitly records local Shamar policy grant flag
app.post('/grant-policy', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)

  await sql`
    UPDATE users
    SET policy_granted = true, policy_granted_at = NOW()
    WHERE id = ${auth.dbUserId}
  `
  return c.json({ granted: true })
})

// POST /agent/revoke-policy — user revokes local policy grant flag
app.post('/revoke-policy', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)

  await sql`UPDATE users SET policy_granted = false WHERE id = ${auth.dbUserId}`
  return c.json({ revoked: true })
})

export default app
