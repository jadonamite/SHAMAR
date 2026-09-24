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
import { getHaltState, getUserTelegramChat } from '../lib/telegram.js'
import { hasGmailConnected } from '../lib/cache.js'

const app = new Hono()

// GET /agent/status — agent identity + user's policy grant status
app.get('/status', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const agentReady = isAgentConfigured()

  const [row] = await sql`
    SELECT wallet_address, telegram_chat_id
    FROM users WHERE id = ${auth.dbUserId}
  `

  const haltState = await getHaltState(auth.dbUserId)
  const halted = haltState.halted

  const gmailConnected =
    (await hasGmailConnected(auth.dbUserId)) ||
    (await hasGmailConnected(auth.privyDid))

  const userChatId = await getUserTelegramChat(auth.dbUserId)
  const telegramLinked = Boolean(row?.telegram_chat_id || userChatId)

  let onchainAuthorized = false
  if (row?.wallet_address) {
    try {
      onchainAuthorized = await checkOnchainAuthorization(row.wallet_address, SCOPES.CANCEL)
    } catch {
      onchainAuthorized = false
    }
  }

  let state: 'authorized' | 'halted' | 'blocked' | 'unauthorized' = 'unauthorized'
  let reason = 'Policy not granted on Base mainnet. Grant permissions in your wallet to enable automated actions.'

  if (!agentReady) {
    state = 'blocked'
    reason = 'Agent service or policy contract is not configured.'
  } else if (halted) {
    state = 'halted'
    reason = 'Agent is paused via Telegram /stop. Send /resume in Telegram to re-enable.'
  } else if (!gmailConnected && !telegramLinked) {
    state = 'blocked'
    reason = 'Agent channels blocked: connect Gmail or link Telegram to activate autonomous monitoring.'
  } else if (onchainAuthorized) {
    state = 'authorized'
    reason = 'Authorized on Base mainnet. SHAMAR will act on your subscriptions within policy.'
  } else if (!row?.wallet_address) {
    state = 'unauthorized'
    reason = 'Wallet not connected. Connect a wallet to grant on-chain policy.'
  } else {
    state = 'unauthorized'
    reason = 'Policy not granted on Base mainnet. Grant permissions in your wallet to enable automated actions.'
  }

  return c.json({
    state,
    reason,
    gmail_connected: gmailConnected,
    telegram_linked: telegramLinked,
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
    user: row ?? null,
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

export default app
