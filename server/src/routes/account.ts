import { Hono } from 'hono'
import { google } from 'googleapis'
import { sql } from '../lib/db.js'
import { redis, getGmailTokens } from '../lib/cache.js'
import { authenticateCaller } from '../lib/auth.js'

const app = new Hono()

// DELETE /account — permanently removes user, revokes Google OAuth, and cleans up all data
app.delete('/', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const { dbUserId, privyDid } = auth

  try {
    // 1. Revoke Google OAuth token with Google's API if present
    const tokens =
      (await getGmailTokens(dbUserId)) || (await getGmailTokens(privyDid))
    if (
      tokens?.refresh_token &&
      process.env.GMAIL_CLIENT_ID &&
      process.env.GMAIL_CLIENT_SECRET
    ) {
      try {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GMAIL_CLIENT_ID,
          process.env.GMAIL_CLIENT_SECRET
        )
        await oauth2Client.revokeToken(tokens.refresh_token)
      } catch (err) {
        console.warn(
          '[account] Google token revocation warning:',
          (err as Error).message
        )
      }
    }

    // 2. Clear subscription-level cached states before deleting rows
    const subs = (await sql`
      SELECT id FROM subscriptions WHERE user_id = ${dbUserId}
    `) as unknown as { id: string }[]
    for (const sub of subs) {
      await Promise.all([
        redis.del(`renewal:${sub.id}`),
        redis.del(`insight:${sub.id}`),
      ])
    }

    // 3. Clear all user-level KV items
    await Promise.all([
      redis.del(`gmail_tokens:${dbUserId}`),
      redis.del(`gmail_tokens:${privyDid}`),
      redis.del(`gmail_sync:${dbUserId}`),
      redis.del(`gmail_sync:${privyDid}`),
      redis.del(`scan_lock:${dbUserId}`),
      redis.del(`scan_lock:${privyDid}`),
      redis.del(`wallet_scan_lock:${dbUserId}`),
      redis.del(`wallet_scan_lock:${privyDid}`),
      redis.del(`shamar:halted:${dbUserId}`),
      redis.del(`shamar:halted:${privyDid}`),
      redis.del(`self_verified:${dbUserId}`),
      redis.del(`self_verified:${privyDid}`),
    ])

    // Clean up any pending Telegram linking codes
    try {
      await sql`
        DELETE FROM kv
        WHERE key LIKE 'telegram:link:%'
          AND (value = ${JSON.stringify(dbUserId)}::jsonb OR value = ${JSON.stringify(privyDid)}::jsonb)
      `
    } catch {}

    // 4. Delete user record (foreign keys cascade to subscriptions, recommendations,
    //    signals, actions, reminders, policies, and policy_events)
    await sql`DELETE FROM users WHERE id = ${dbUserId}`

    return c.json({ deleted: true })
  } catch (err) {
    console.error('[account] Failed to delete user account:', err)
    return c.json({ error: 'Failed to delete account' }, 500)
  }
})

export default app
