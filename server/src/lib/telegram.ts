import { redis } from './cache.js'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? ''
const API = `https://api.telegram.org/bot${TOKEN}`

const HALT_KEY = 'shamar:halted'
const OFFSET_KEY = 'shamar:tg_offset'

export type HaltState = {
  halted: boolean
  source: 'telegram' | 'none' | 'unavailable'
  reason: string
}

export function isTelegramConfigured(): boolean {
  return Boolean(TOKEN && CHAT_ID)
}

export async function sendTelegram(text: string): Promise<boolean> {
  if (!isTelegramConfigured()) return false
  try {
    const res = await fetch(`${API}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'Markdown' }),
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}

// Drains pending messages and honours /stop and /resume. Called before every
// dispatch, so a stop sent from a phone takes effect on the next action rather
// than the next deploy.
export async function pollControl(): Promise<HaltState> {
  if (!isTelegramConfigured()) {
    return { halted: false, source: 'unavailable', reason: 'Telegram not configured' }
  }

  try {
    const offset = (await redis.get<number>(OFFSET_KEY)) ?? 0
    const res = await fetch(`${API}/getUpdates?offset=${offset}&timeout=0`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return await currentHalt('Telegram unreachable, using last known state')

    const body = (await res.json()) as { ok: boolean; result?: Array<Record<string, any>> }
    const updates = body.result ?? []

    let highest = offset
    for (const u of updates) {
      highest = Math.max(highest, Number(u.update_id) + 1)
      const text = String(u.message?.text ?? '').trim().toLowerCase()
      if (text.startsWith('/stop')) {
        await redis.set(HALT_KEY, '1')
        await sendTelegram('*SHAMAR halted.* No further cancellations will be dispatched until /resume.')
      } else if (text.startsWith('/resume')) {
        await redis.del(HALT_KEY)
        await sendTelegram('*SHAMAR resumed.* Dispatch is authorized again.')
      }
    }
    if (highest !== offset) await redis.set(OFFSET_KEY, highest)

    return await currentHalt('Control channel read')
  } catch (err) {
    return await currentHalt(`Telegram poll failed: ${(err as Error).message}`)
  }
}

// A control channel that cannot be read must not silently grant permission, so
// the last known halt state stands.
async function currentHalt(reason: string): Promise<HaltState> {
  const halted = Boolean(await redis.get(HALT_KEY))
  return { halted, source: halted ? 'telegram' : 'none', reason }
}

export async function getHaltState(): Promise<HaltState> {
  if (!isTelegramConfigured()) {
    return { halted: false, source: 'unavailable', reason: 'Telegram not configured' }
  }
  return currentHalt('Cached state')
}

export async function setHalt(halted: boolean): Promise<void> {
  if (halted) await redis.set(HALT_KEY, '1')
  else await redis.del(HALT_KEY)
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
    `Reply /stop to halt further action.`,
  ].join('\n')
}
