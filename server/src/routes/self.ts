import { Hono } from 'hono'
import { sql, getOrCreateUser } from '../lib/db.js'
import { redis } from '../lib/cache.js'

/**
 * SELF Protocol verification callback
 *
 * Flow:
 *   1. Frontend builds a SELF deep-link with userId + callbackUrl
 *   2. User scans QR code in SELF app → generates ZK proof
 *   3. SELF app POSTs proof to POST /self/verify
 *   4. This route verifies the proof and marks user as verified
 *
 * Install @selfxyz/core for full ZK proof verification:
 *   cd server && npm install @selfxyz/core
 * Then uncomment the verification block below.
 */

const app = new Hono()

const SELF_APP_ID  = process.env.SELF_APP_ID  ?? ''
const SELF_APP_SECRET = process.env.SELF_APP_SECRET ?? ''

// GET /self/status?user_id=<privy_did>
app.get('/status', async (c) => {
  const userId = c.req.query('user_id') ?? c.req.header('x-user-id')
  if (!userId) return c.json({ error: 'user_id required' }, 400)

  const cached = await redis.get<string>(`self_verified:${userId}`)
  if (cached) return c.json({ verified: true, source: 'cache' })

  const dbUserId = await getOrCreateUser(userId)
  const [row] = await sql`SELECT self_verified FROM users WHERE id = ${dbUserId}`
  return c.json({ verified: row?.self_verified ?? false })
})

// POST /self/verify — SELF Protocol callback (called by SELF app after proof generation)
app.post('/verify', async (c) => {
  const body = await c.req.json<{
    userId: string
    proof?: unknown
    nullifier?: string
    scope?: string
  }>()

  const { userId, proof, nullifier } = body
  if (!userId) return c.json({ error: 'userId required' }, 400)

  // --- ZK Proof verification ---
  // When @selfxyz/core is installed, verify the proof here:
  //
  // import { SelfVerifier } from '@selfxyz/core'
  // const verifier = new SelfVerifier({ appId: SELF_APP_ID, scope: 'sam-ciphergon' })
  // const result = await verifier.verify(proof)
  // if (!result.valid) return c.json({ error: 'Invalid proof' }, 400)
  //
  // For now: accept the callback and mark as verified (development mode).
  // In production, NEVER skip proof verification.
  //
  if (!proof && process.env.NODE_ENV === 'production') {
    return c.json({ error: 'Proof required in production' }, 400)
  }

  // Mark verified in DB
  const dbUserId = await getOrCreateUser(userId)
  await sql`
    UPDATE users SET self_verified = true, self_verified_at = NOW() WHERE id = ${dbUserId}
  `
  // Cache verification for 1 year
  await redis.set(`self_verified:${userId}`, '1', { ex: 60 * 60 * 24 * 365 })

  return c.json({ verified: true, userId })
})

export { SELF_APP_ID }
export default app
