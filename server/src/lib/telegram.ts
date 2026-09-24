import { redis } from './cache.js'
import { sql } from './db.js'
import { randomBytes } from 'node:crypto'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? ''
const API = `https://api.telegram.org/bot${TOKEN}`

const GLOBAL_HALT_KEY = 'shamar:halted'
const OFFSET_KEY = 'shamar:tg_offset'

export type HaltState = {
  halted: boolean
  source: 'telegram' | 'none' | 'unavailable'
  reason: string
}

export function isTelegramConfigured(): boolean {
  return Boolean(TOKEN)
}

export async function getUserTelegramChat(dbUserId: string): Promise<string | null> {
  if (!dbUserId) return DEFAULT_CHAT_ID || null
  try {
    const [user] = await sql`SELECT telegram_chat_id FROM users WHERE id = ${dbUserId}`
    return (user?.telegram_chat_id as string | null) || DEFAULT_CHAT_ID || null
  } catch {
    return DEFAULT_CHAT_ID || null
  }
}

export async function sendTelegram(
  text: string,
  explicitChatId?: string | null,
  options?: { replyToMessageId?: number }
): Promise<boolean> {
  if (!isTelegramConfigured()) return false
  const targetChatId = explicitChatId || DEFAULT_CHAT_ID
  if (!targetChatId) return false

  try {
    const payload: Record<string, any> = {
      chat_id: targetChatId,
      text,
      parse_mode: 'Markdown',
    }
    if (options?.replyToMessageId) {
      payload.reply_to_message_id = options.replyToMessageId
    }

    const res = await fetch(`${API}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function createTelegramLinkCode(dbUserId: string): Promise<string> {
  const code = randomBytes(4).toString('hex').toUpperCase()
  await redis.set(`telegram:link:${code}`, dbUserId, { ex: 60 * 15 }) // 15 min expiry
  return code
}

import { handleCallbackQuery, sendNotice, type NoticeState } from './renewal.js'

// Drains pending messages, handles account linking (/start link_<code>),
// interactive button clicks, and honours per-user commands (/status, /stop, /resume, /help).
export async function pollControl(dbUserId?: string, opts: { timeoutSeconds?: number } = {}): Promise<HaltState> {
  if (!isTelegramConfigured()) {
    return { halted: false, source: 'unavailable', reason: 'Telegram not configured' }
  }

  const timeoutSec = opts.timeoutSeconds ?? 0
  try {
    const offset = (await redis.get<number>(OFFSET_KEY)) ?? 0
    const res = await fetch(`${API}/getUpdates?offset=${offset}&timeout=${timeoutSec}`, {
      signal: AbortSignal.timeout((timeoutSec + 6) * 1000),
    })
    if (!res.ok) return await getHaltState(dbUserId)

    const body = (await res.json()) as { ok: boolean; result?: Array<Record<string, any>> }
    const updates = body.result ?? []

    let highest = offset
    for (const u of updates) {
      highest = Math.max(highest, Number(u.update_id) + 1)

      // Handle interactive renewal action buttons
      if (u.callback_query) {
        try {
          await handleCallbackQuery(u.callback_query)
        } catch (cbErr) {
          console.warn('[Telegram Bot] Callback handling error:', (cbErr as Error).message)
        }
        continue
      }

      const message = u.message
      if (!message?.text) continue

      const chatId = String(message.chat?.id ?? '')
      const text = String(message.text).trim()
      const lower = text.toLowerCase()

      // 1. Account linking: /start link_<code> or /start <code>
      if (lower.startsWith('/start')) {
        const parts = text.split(/\s+/)
        const arg = parts[1] || ''
        const code = arg.replace(/^link_/i, '').trim().toUpperCase()

        if (code) {
          const targetUserId = await redis.get<string>(`telegram:link:${code}`)
          if (targetUserId) {
            await sql`UPDATE users SET telegram_chat_id = ${chatId} WHERE id = ${targetUserId}`
            await redis.del(`telegram:link:${code}`)
            await sendTelegram(
              [
                `*SHAMAR Connected.*`,
                ``,
                `Your Telegram is linked to your account. You will receive renewal alerts before each charge with one-tap Keep or Cancel buttons.`,
                ``,
                `• Send status anytime to view your subscriptions.`,
                `• Send stop anytime to pause cancellations.`,
              ].join('\n'),
              chatId
            )
            continue
          } else {
            await sendTelegram(
              'Link code expired or invalid. Please open SHAMAR in your browser to generate a new connection link.',
              chatId
            )
            continue
          }
        } else {
          await sendTelegram(
            [
              `*SHAMAR Bot*`,
              ``,
              `Connect your account from your dashboard to receive interactive subscription renewal alerts.`,
              ``,
              `Send help to view available commands.`,
            ].join('\n'),
            chatId
          )
          continue
        }
      }

      // 2. Stop command: stop, /stop, halt, /halt, pause, /pause
      const isStop =
        lower === 'stop' ||
        lower === '/stop' ||
        lower.startsWith('/stop') ||
        lower.startsWith('stop') ||
        lower === 'halt' ||
        lower === '/halt' ||
        lower.startsWith('/halt') ||
        lower === 'pause' ||
        lower === '/pause' ||
        lower.startsWith('/pause')

      if (isStop) {
        const [linkedUser] = await sql`SELECT id FROM users WHERE telegram_chat_id = ${chatId} LIMIT 1`
        if (linkedUser?.id) {
          await redis.set(`shamar:halted:${linkedUser.id}`, '1')
          await sendTelegram(
            [
              `*SHAMAR paused.*`,
              ``,
              `All automated cancellations are now paused for your account.`,
              `No further actions will be taken.`,
              ``,
              `Reply resume anytime to re-enable.`,
            ].join('\n'),
            chatId
          )
        } else {
          await redis.set(GLOBAL_HALT_KEY, '1')
          await sendTelegram(
            [
              `*SHAMAR paused.*`,
              ``,
              `All automated cancellations are now paused.`,
              `No further actions will be taken.`,
              ``,
              `Reply resume anytime to re-enable.`,
            ].join('\n'),
            chatId
          )
        }
        continue
      }

      // 3. Resume command: resume, /resume, unpause, /unpause
      const isResume =
        lower === 'resume' ||
        lower === '/resume' ||
        lower.startsWith('/resume') ||
        lower.startsWith('resume') ||
        lower === 'unpause' ||
        lower === '/unpause' ||
        lower.startsWith('/unpause')

      if (isResume) {
        const [linkedUser] = await sql`SELECT id FROM users WHERE telegram_chat_id = ${chatId} LIMIT 1`
        if (linkedUser?.id) {
          await redis.del(`shamar:halted:${linkedUser.id}`)
          await sendTelegram(
            [
              `*SHAMAR resumed.*`,
              ``,
              `Automated renewal monitoring and cancellation dispatch are active again.`,
              ``,
              `Reply stop anytime to pause.`,
            ].join('\n'),
            chatId
          )
        } else {
          await redis.del(GLOBAL_HALT_KEY)
          await sendTelegram(
            [
              `*SHAMAR resumed.*`,
              ``,
              `Automated renewal monitoring and cancellation dispatch are active again.`,
              ``,
              `Reply stop anytime to pause.`,
            ].join('\n'),
            chatId
          )
        }
        continue
      }

      // 4. Status command: status, /status
      const isStatus =
        lower === 'status' ||
        lower === '/status' ||
        lower.startsWith('/status') ||
        lower.startsWith('status')

      if (isStatus) {
        const [linkedUser] = await sql`SELECT id FROM users WHERE telegram_chat_id = ${chatId} LIMIT 1`
        if (linkedUser?.id) {
          const subs = await sql`
            SELECT merchant, amount, currency, cadence, last_charged
            FROM subscriptions
            WHERE user_id = ${linkedUser.id} AND status = 'active'
            ORDER BY amount DESC
          `
          const halt = await getHaltState(linkedUser.id)
          const lines = [
            `*SHAMAR Status: ${halt.halted ? 'Paused' : 'Active'}*`,
            ``,
            `*Tracked Subscriptions (${subs.length}):*`,
          ]
          if (subs.length === 0) {
            lines.push(`_No active subscriptions found. Scan your receipts on the dashboard._`)
          } else {
            for (const s of subs.slice(0, 8)) {
              const sym = s.currency === 'USD' ? '$' : `${s.currency} `
              lines.push(`• *${s.merchant}* — ${sym}${s.amount} / ${s.cadence || 'mo'}`)
            }
            if (subs.length > 8) lines.push(`_...and ${subs.length - 8} more_`)
          }
          lines.push(``)
          lines.push(halt.halted ? `Reply resume to unpause.` : `Reply stop to pause cancellations anytime.`)
          await sendTelegram(lines.join('\n'), chatId)
        } else {
          await sendTelegram(
            `This Telegram account is not yet linked to SHAMAR.\nOpen your dashboard to connect your account.`,
            chatId
          )
        }
        continue
      }

      // 5. Help command: help, /help, info, menu
      const isHelp =
        lower === 'help' ||
        lower === '/help' ||
        lower.startsWith('/help') ||
        lower.startsWith('help') ||
        lower === 'info' ||
        lower === 'menu'

      if (isHelp) {
        const helpText = [
          `*SHAMAR Bot*`,
          ``,
          `Monitors your subscriptions, alerts you before renewals, and handles cancellations on your behalf.`,
          ``,
          `*Commands:*`,
          `• status — View active subscriptions and agent state`,
          `• stop — Immediately halt all automated cancellations`,
          `• resume — Re-enable cancellation dispatches`,
          `• help — Show this help message`,
        ].join('\n')
        await sendTelegram(helpText, chatId)
        continue
      }

      // 6. Fallback response for unrecognised text
      await sendTelegram(
        [
          `*SHAMAR Bot*`,
          ``,
          `Commands:`,
          `• status — View active subscriptions and state`,
          `• stop — Pause all automated cancellations`,
          `• resume — Re-enable cancellations`,
          `• help — View help guide`,
        ].join('\n'),
        chatId
      )
    }

    if (highest !== offset) await redis.set(OFFSET_KEY, highest)

    return await getHaltState(dbUserId)
  } catch (err) {
    return await getHaltState(dbUserId)
  }
}

let pollerActive = false

/**
 * Starts real-time Telegram polling loop in long-running processes
 */
export function startTelegramPoller() {
  if (pollerActive || !isTelegramConfigured()) return
  pollerActive = true

  console.log('[Telegram Bot] Starting real-time long-poller...')
  const loop = async () => {
    while (pollerActive) {
      try {
        await pollControl(undefined, { timeoutSeconds: 5 })
      } catch (err) {
        await new Promise((r) => setTimeout(r, 3000))
      }
    }
  }
  loop().catch((err) => console.error('[Telegram Bot] Poller error:', err))
}

/**
 * Dispatches an interactive test renewal notice to the user's linked Telegram chat
 */
export async function sendTestRenewalNotice(dbUserId: string): Promise<{ ok: boolean; error?: string }> {
  const chatId = await getUserTelegramChat(dbUserId)
  if (!chatId) {
    return { ok: false, error: 'Telegram is not linked to your account yet.' }
  }

  // Find user's active sub, or default to Claude Pro
  const [sub] = await sql`
    SELECT id, merchant, amount, currency, cadence
    FROM subscriptions
    WHERE user_id = ${dbUserId} AND status = 'active'
    LIMIT 1
  `

  const merchant = (sub?.merchant as string) || 'Claude Pro'
  const subId = (sub?.id as string) || 'demo-test-sub'
  const amount = Number(sub?.amount ?? 20)
  const currency = (sub?.currency as string) || 'USD'
  const cadence = (sub?.cadence as string) || 'monthly'

  const renewalDate = new Date(Date.now() + 48 * 3_600_000).toISOString()
  const price = `${currency === 'USD' ? '$' : currency + ' '}${amount} / ${cadence}`

  const noticeState: NoticeState = {
    subscription_id: subId,
    merchant,
    renewal_at: renewalDate,
    notices_sent: 1,
    last_notice_at: new Date().toISOString(),
    decision: null,
    decided_at: null,
    auto_cancelled: false,
  }

  // Store in KV so when user presses Keep/Cancel, it responds
  await redis.set(`renewal:${subId}`, noticeState, { ex: 60 * 60 * 24 * 7 })

  const ok = await sendNotice(noticeState, price, 48, chatId)
  return ok ? { ok: true } : { ok: false, error: 'Failed to deliver message via Telegram API' }
}

export async function getHaltState(dbUserId?: string): Promise<HaltState> {
  if (!isTelegramConfigured()) {
    return { halted: false, source: 'unavailable', reason: 'Telegram not configured' }
  }

  // Check per-user halt first
  if (dbUserId) {
    const userHalted = Boolean(await redis.get(`shamar:halted:${dbUserId}`))
    if (userHalted) {
      return {
        halted: true,
        source: 'telegram',
        reason: 'Halted by account owner via Telegram (stop)',
      }
    }
  }

  // Check global halt
  const globalHalted = Boolean(await redis.get(GLOBAL_HALT_KEY))
  if (globalHalted) {
    return {
      halted: true,
      source: 'telegram',
      reason: 'Halted globally via Telegram (stop)',
    }
  }

  return { halted: false, source: 'none', reason: 'Active' }
}

export async function setHalt(halted: boolean, dbUserId?: string): Promise<void> {
  const targetKey = dbUserId ? `shamar:halted:${dbUserId}` : GLOBAL_HALT_KEY
  if (halted) await redis.set(targetKey, '1')
  else await redis.del(targetKey)
}

export function dispatchReport(opts: {
  merchant: string
  recipient: string
  amount: string
  rationale: string
  attested: boolean
}): string {
  return [
    `*Cancellation dispatched*`,
    ``,
    `*${opts.merchant}* — ${opts.amount}`,
    `Sent to \`${opts.recipient}\``,
    ``,
    `_${opts.rationale}_`,
    ``,
    opts.attested ? `Signed and recorded.` : `Recorded without signature.`,
    `Reply stop to halt further action.`,
  ].join('\n')
}
