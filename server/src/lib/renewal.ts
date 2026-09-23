import { sql } from './db.js'
import { redis } from './cache.js'
import { nextRenewal } from './calendar.js'
import { currencySymbol } from './currency.js'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? ''
const API = `https://api.telegram.org/bot${TOKEN}`

// Notices go out at these hours before renewal. Silence escalates; the last
// window belongs to the agent.
export const NOTICE_HOURS = [120, 72, 48]
export const AUTO_CANCEL_HOURS = 36

export type NoticeState = {
  subscription_id: string
  merchant: string
  renewal_at: string
  notices_sent: number
  last_notice_at: string | null
  decision: 'cancel' | 'renew' | null
  decided_at: string | null
  auto_cancelled: boolean
}

const key = (id: string) => `renewal:${id}`

export async function getNotice(subId: string): Promise<NoticeState | null> {
  return redis.get<NoticeState>(key(subId))
}

async function putNotice(s: NoticeState): Promise<void> {
  await redis.set(key(s.subscription_id), s, { ex: 60 * 60 * 24 * 60 })
}

function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 3_600_000
}

function noticeText(s: NoticeState, price: string, hoursLeft: number): string {
  const when = new Date(s.renewal_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
  const nth = s.notices_sent + 1
  const urgency =
    nth === 1
      ? `renews on the ${when}.`
      : `still renews on the ${when}. This is reminder ${nth} of ${NOTICE_HOURS.length}.`

  return [
    `*${s.merchant.toUpperCase()}* ${urgency}`,
    ``,
    `${price}`,
    ``,
    nth >= NOTICE_HOURS.length
      ? `No reply yet. If you say nothing, SHAMAR cancels this ${AUTO_CANCEL_HOURS} hours before renewal.`
      : `Reply below. Silence means SHAMAR cancels it ${AUTO_CANCEL_HOURS} hours before renewal.`,
    ``,
    `_${Math.round(hoursLeft)}h remaining._`,
  ].join('\n')
}

async function sendNotice(s: NoticeState, price: string, hoursLeft: number): Promise<boolean> {
  if (!TOKEN || !CHAT_ID) return false
  try {
    const res = await fetch(`${API}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: noticeText(s, price, hoursLeft),
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✕  Cancel it', callback_data: `cancel:${s.subscription_id}` },
              { text: '✓  Keep it', callback_data: `renew:${s.subscription_id}` },
            ],
          ],
        },
      }),
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}

async function ack(callbackId: string, text: string): Promise<void> {
  try {
    await fetch(`${API}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackId, text, show_alert: false }),
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    /* the decision is already recorded; a failed ack only affects the spinner */
  }
}

// Reads button presses. Separate offset from the /stop poller so neither
// consumes the other's updates.
export async function pollDecisions(): Promise<Array<{ subscription_id: string; decision: string }>> {
  if (!TOKEN) return []
  const applied: Array<{ subscription_id: string; decision: string }> = []

  try {
    const offset = (await redis.get<number>('shamar:cb_offset')) ?? 0
    const res = await fetch(`${API}/getUpdates?offset=${offset}&timeout=0&allowed_updates=["callback_query"]`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const body = (await res.json()) as { result?: Array<Record<string, any>> }
    const updates = body.result ?? []

    let highest = offset
    for (const u of updates) {
      highest = Math.max(highest, Number(u.update_id) + 1)
      const cb = u.callback_query
      if (!cb?.data) continue

      const [verb, subId] = String(cb.data).split(':')
      if (verb !== 'cancel' && verb !== 'renew') continue

      const state = await getNotice(subId)
      if (!state) {
        await ack(cb.id, 'That notice has expired.')
        continue
      }
      if (state.decision) {
        await ack(cb.id, `Already ${state.decision === 'renew' ? 'kept' : 'cancelled'}.`)
        continue
      }

      state.decision = verb as 'cancel' | 'renew'
      state.decided_at = new Date().toISOString()
      await putNotice(state)

      if (verb === 'renew') {
        await ack(cb.id, `Keeping ${state.merchant}.`)
      } else {
        await sql`UPDATE subscriptions SET status = 'cancelled' WHERE id = ${subId}`
        await ack(cb.id, `Cancelling ${state.merchant}.`)
      }
      applied.push({ subscription_id: subId, decision: verb })
    }
    if (highest !== offset) await redis.set('shamar:cb_offset', highest)
  } catch (err) {
    console.warn('[renewal] decision poll failed:', (err as Error).message)
  }

  return applied
}

export type TickResult = {
  checked: number
  notices_sent: number
  decisions_applied: Array<{ subscription_id: string; decision: string }>
  auto_cancelled: string[]
  states: NoticeState[]
}

// One pass of the renewal loop: apply any button presses, send notices that
// have come due, and cancel anything still undecided inside the final window.
export async function tick(dbUserId: string, opts: { apply?: boolean } = {}): Promise<TickResult> {
  const apply = opts.apply ?? false
  const decisions = await pollDecisions()

  const subs = (await sql`
    SELECT id, merchant, amount, currency, cadence, last_charged
    FROM subscriptions
    WHERE user_id = ${dbUserId} AND status = 'active' AND amount > 0
  `) as Array<Record<string, any>>

  const states: NoticeState[] = []
  const autoCancelled: string[] = []
  let sent = 0

  for (const sub of subs) {
    const due = nextRenewal(sub.last_charged, sub.cadence)
    if (!due) continue

    let state = await getNotice(sub.id)
    if (!state) {
      state = {
        subscription_id: sub.id,
        merchant: sub.merchant,
        renewal_at: due.toISOString(),
        notices_sent: 0,
        last_notice_at: null,
        decision: null,
        decided_at: null,
        auto_cancelled: false,
      }
    }

    const left = hoursUntil(state.renewal_at)
    if (state.decision || state.auto_cancelled) {
      states.push(state)
      continue
    }

    if (left <= AUTO_CANCEL_HOURS && left > 0) {
      if (apply) {
        await sql`UPDATE subscriptions SET status = 'cancelled' WHERE id = ${sub.id}`
        state.auto_cancelled = true
        state.decided_at = new Date().toISOString()
        await putNotice(state)
        await fetch(`${API}/sendMessage`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHAT_ID,
            text: `*${sub.merchant}* cancelled.\n\n${NOTICE_HOURS.length} notices went unanswered, so SHAMAR acted ${AUTO_CANCEL_HOURS}h before renewal rather than let it charge.`,
            parse_mode: 'Markdown',
          }),
        }).catch(() => {})
      }
      autoCancelled.push(sub.merchant)
      states.push(state)
      continue
    }

    const threshold = NOTICE_HOURS[state.notices_sent]
    if (threshold !== undefined && left <= threshold) {
      if (apply) {
        const price = `${currencySymbol(sub.currency)}${sub.amount} / ${sub.cadence}`
        if (await sendNotice(state, price, left)) {
          state.notices_sent += 1
          state.last_notice_at = new Date().toISOString()
          await putNotice(state)
          sent++
        }
      } else {
        sent++
      }
    }

    states.push(state)
  }

  return {
    checked: subs.length,
    notices_sent: sent,
    decisions_applied: decisions,
    auto_cancelled: autoCancelled,
    states,
  }
}

// Demo helper: places a subscription at a chosen number of hours before its
// renewal so the escalation can be exercised without waiting days.
export async function stageNotice(subId: string, merchant: string, hoursOut: number, noticesSent = 0): Promise<NoticeState> {
  const state: NoticeState = {
    subscription_id: subId,
    merchant,
    renewal_at: new Date(Date.now() + hoursOut * 3_600_000).toISOString(),
    notices_sent: noticesSent,
    last_notice_at: null,
    decision: null,
    decided_at: null,
    auto_cancelled: false,
  }
  await putNotice(state)
  return state
}
