import { Hono } from 'hono'
import { authenticateCaller } from '../lib/auth.js'
import {
  createTelegramLinkCode,
  getUserTelegramChat,
  getHaltState,
  setHalt,
  isTelegramConfigured,
  pollControl,
  sendTestRenewalNotice,
} from '../lib/telegram.js'
import { sql } from '../lib/db.js'

const app = new Hono()
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'shamar_agent_bot'

// POST /telegram/link-code — generate a 15-minute one-time code to link Telegram chat to this account
app.post('/link-code', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)

  if (!isTelegramConfigured()) {
    return c.json({ error: 'Telegram bot not configured on server' }, 503)
  }

  const code = await createTelegramLinkCode(auth.dbUserId)
  const linkUrl = `https://t.me/${BOT_USERNAME}?start=link_${code}`

  return c.json({
    code,
    link_url: linkUrl,
    url: linkUrl,
    botUsername: BOT_USERNAME,
    expires_in_seconds: 900,
  })
})

// GET /telegram/status — check if authenticated user has linked Telegram and their halt state
app.get('/status', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)

  // Poll pending telegram updates to sync any recent /start or /stop commands
  await pollControl(auth.dbUserId)

  const chatId = await getUserTelegramChat(auth.dbUserId)
  const halt = await getHaltState(auth.dbUserId)

  return c.json({
    configured: isTelegramConfigured(),
    linked: Boolean(chatId),
    chat_id: chatId ? `***${chatId.slice(-4)}` : null,
    halted: halt.halted,
    halt_reason: halt.reason,
    bot_username: BOT_USERNAME,
  })
})

// POST /telegram/test-notice — send an interactive test renewal notice to user's Telegram
app.post('/test-notice', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)

  const result = await sendTestRenewalNotice(auth.dbUserId)
  if (!result.ok) {
    return c.json({ error: result.error || 'Failed to send test notice' }, 400)
  }

  return c.json({ success: true, message: 'Test renewal notice sent to your Telegram' })
})

// POST /telegram/unlink — unlink Telegram chat from this account
app.post('/unlink', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)

  await sql`UPDATE users SET telegram_chat_id = NULL WHERE id = ${auth.dbUserId}`
  return c.json({ success: true, message: 'Telegram unlinked' })
})

// POST /telegram/halt — toggle halt state directly from app UI
app.post('/halt', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)

  await setHalt(true, auth.dbUserId)
  return c.json({ halted: true, reason: 'Halted by account owner' })
})

// POST /telegram/resume — resume agent dispatch directly from app UI
app.post('/resume', async (c) => {
  const auth = await authenticateCaller(c)
  if (!auth) return c.json({ error: 'Unauthorized' }, 401)

  await setHalt(false, auth.dbUserId)
  return c.json({ halted: false, reason: 'Active' })
})

export default app
