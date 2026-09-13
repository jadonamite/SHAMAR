import { Hono } from 'hono'
import { sql, getOrCreateUser, setUserWallet } from '../lib/db.js'
import { detectWalletSubscriptions } from '../lib/wallet.js'
import { getWalletScanLock } from '../lib/cache.js'

const app = new Hono()

// GET /wallet/status — how many wallet-sourced subs exist for this user
app.get('/status', async (c) => {
  const userId = c.req.query('user_id') ?? c.req.header('x-user-id')
  if (!userId) return c.json({ error: 'user_id required' }, 400)

  const dbUserId = await getOrCreateUser(userId)
  const rows = await sql`
    SELECT COUNT(*) AS count FROM subscriptions
    WHERE user_id = ${dbUserId} AND source = 'wallet'
  `
  const count = Number(rows[0]?.count ?? 0)
  return c.json({ walletScanned: count > 0, count })
})

// POST /wallet/scan
// Headers: x-user-id: <privy_did>
// Body:    { address: string }
app.post('/scan', async (c) => {
  const userId = c.req.header('x-user-id')
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json<{ address: string }>()
  const { address } = body ?? {}

  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return c.json({ error: 'Invalid wallet address' }, 400)
  }

  const acquired = await getWalletScanLock(userId)
  if (!acquired) {
    return c.json({ error: 'Wallet scan in progress. Try again in 5 minutes.' }, 429)
  }

  const dbUserId = await getOrCreateUser(userId)
  await setUserWallet(dbUserId, address)

  try {
    const patterns = await detectWalletSubscriptions(address)

    let created = 0
    let updated = 0

    for (const pattern of patterns) {
      const existing = await sql`
        SELECT id FROM subscriptions
        WHERE user_id = ${dbUserId}
          AND source = 'wallet'
          AND merchant = ${pattern.merchantName}
          AND status = 'active'
        LIMIT 1
      `

      if (existing.length > 0) {
        await sql`
          UPDATE subscriptions
          SET amount = ${pattern.avgAmount}, last_charged = ${pattern.lastCharged}
          WHERE id = ${existing[0].id}
        `
        updated++
      } else {
        await sql`
          INSERT INTO subscriptions
            (user_id, name, merchant, amount, currency, cadence, source, detected_at, last_charged)
          VALUES
            (${dbUserId}, ${pattern.merchantName}, ${pattern.merchantName},
             ${pattern.avgAmount}, ${pattern.currency}, ${pattern.cadence},
             'wallet', NOW(), ${pattern.lastCharged})
        `
        created++
      }
    }

    return c.json({
      scanned: patterns.length,
      detected: patterns.length,
      created,
      updated,
    })
  } catch (err) {
    console.error('[Wallet] Scan error:', err)
    return c.json({ error: 'Scan failed', detail: (err as Error).message }, 500)
  }
})

export default app
