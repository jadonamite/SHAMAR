import type { Context, Next } from 'hono'
import { PrivyClient } from '@privy-io/server-auth'
import { verifyMessage } from 'viem'
import { sql, getOrCreateUser, setUserWallet } from './db.js'

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || process.env.PRIVY_APP_ID || ''
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET || ''

let privyClient: PrivyClient | null = null
if (PRIVY_APP_ID && PRIVY_APP_SECRET) {
  try {
    privyClient = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET)
  } catch (err) {
    console.warn('[auth] Failed to initialize PrivyClient:', (err as Error).message)
  }
}

export type AuthContext = {
  privyDid: string
  dbUserId: string
  walletAddress: string | null
  authMethod: 'privy_jwt' | 'wallet_signature'
}

/**
 * Verifies caller identity strictly via:
 * 1. Privy Bearer token in Authorization header
 * 2. MiniPay / EVM wallet signed message via headers (x-wallet-address, x-wallet-signature, x-wallet-timestamp)
 *
 * Unverified user IDs in headers or query parameters are strictly rejected.
 */
export async function authenticateCaller(c: Context): Promise<AuthContext | null> {
  const authHeader = c.req.header('authorization') || c.req.header('Authorization')
  
  // 1. Privy Bearer Token
  if (authHeader && authHeader.startsWith('Bearer ') && privyClient) {
    const token = authHeader.slice(7).trim()
    try {
      const verifiedClaims = await privyClient.verifyAuthToken(token)
      if (verifiedClaims?.userId) {
        const privyDid = verifiedClaims.userId
        const dbUserId = await getOrCreateUser(privyDid)
        
        // Fetch known wallet if stored
        const [user] = await sql`SELECT wallet_address FROM users WHERE id = ${dbUserId}`
        return {
          privyDid,
          dbUserId,
          walletAddress: (user?.wallet_address as string | null) ?? null,
          authMethod: 'privy_jwt',
        }
      }
    } catch (err) {
      console.warn('[auth] Privy token verification failed:', (err as Error).message)
    }
  }

  // 2. MiniPay / EVM Wallet Signature
  const walletAddress = c.req.header('x-wallet-address')
  const walletSig = c.req.header('x-wallet-signature')
  const walletTs = c.req.header('x-wallet-timestamp')

  if (walletAddress && walletSig && walletTs) {
    try {
      const tsNum = Number(walletTs)
      const now = Date.now()
      // Signature must be within 10 minutes to prevent replay attacks
      if (!isNaN(tsNum) && Math.abs(now - tsNum) < 10 * 60 * 1000) {
        const expectedMessage = `Sign in to SHAMAR\nAddress: ${walletAddress.toLowerCase()}\nTimestamp: ${walletTs}`
        const isValid = await verifyMessage({
          address: walletAddress as `0x${string}`,
          message: expectedMessage,
          signature: walletSig as `0x${string}`,
        })

        if (isValid) {
          const privyDid = `did:wallet:${walletAddress.toLowerCase()}`
          const dbUserId = await getOrCreateUser(privyDid)
          await setUserWallet(dbUserId, walletAddress)
          return {
            privyDid,
            dbUserId,
            walletAddress: walletAddress.toLowerCase(),
            authMethod: 'wallet_signature',
          }
        }
      }
    } catch (err) {
      console.warn('[auth] Wallet signature verification failed:', (err as Error).message)
    }
  }

  return null
}

/**
 * Hono middleware to enforce authentication
 */
export async function requireAuth(c: Context, next: Next) {
  const auth = await authenticateCaller(c)
  if (!auth) {
    return c.json({ error: 'Unauthorized: valid Privy token or wallet signature required' }, 401)
  }
  c.set('auth', auth)
  return next()
}
