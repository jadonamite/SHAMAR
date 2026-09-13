import { google } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'
import { getGmailTokens } from './cache.js'
import { currencySymbol } from './currency.js'

export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

export type RenewalEvent = {
  subscription_id: string
  merchant: string
  date: string
  event_id: string
  status: 'created' | 'updated' | 'skipped' | 'failed'
  reason?: string
}

const CADENCE_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  yearly: 365,
}

// Google Calendar ids must be base32hex ([a-v0-9], 5-1024 chars). A UUID's hex
// digits are already a subset, so stripping dashes gives a stable legal id and
// makes every write idempotent.
export function eventIdFor(subscriptionId: string, kind: 'renewal' | 'cancelled'): string {
  const base = subscriptionId.replace(/-/g, '').toLowerCase()
  return kind === 'renewal' ? `shamar${base}` : `shamarc${base}`
}

// Next charge after today, stepping forward from the last observed charge.
export function nextRenewal(lastCharged: Date | string | null, cadence: string): Date | null {
  if (!lastCharged) return null
  const step = CADENCE_DAYS[cadence] ?? 30
  const date = new Date(lastCharged)
  if (isNaN(date.getTime())) return null

  const now = Date.now()
  let guard = 0
  while (date.getTime() <= now && guard < 500) {
    date.setDate(date.getDate() + step)
    guard++
  }
  return date.getTime() > now ? date : null
}

function dayString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function calendarClientFor(userId: string): Promise<OAuth2Client | null> {
  const tokens = await getGmailTokens(userId)
  if (!tokens?.refresh_token) return null

  const client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI ?? 'http://localhost:3001/gmail/callback'
  )
  client.setCredentials(tokens)
  return client
}

export async function writeRenewalEvent(
  auth: OAuth2Client,
  sub: {
    id: string
    merchant: string
    amount: number
    currency: string
    cadence: string
    last_charged: Date | string | null
  }
): Promise<RenewalEvent> {
  const due = nextRenewal(sub.last_charged, sub.cadence)
  const base = { subscription_id: sub.id, merchant: sub.merchant, event_id: eventIdFor(sub.id, 'renewal') }

  if (!due) {
    return { ...base, date: '', status: 'skipped', reason: 'No renewal date could be derived' }
  }

  const calendar = google.calendar({ version: 'v3', auth })
  const price = `${currencySymbol(sub.currency)}${sub.amount}`
  const day = dayString(due)

  const body = {
    id: base.event_id,
    summary: `${sub.merchant} renews — ${price}`,
    description:
      `SHAMAR detected this recurring charge.\n\n` +
      `Merchant: ${sub.merchant}\nAmount: ${price} / ${sub.cadence}\n\n` +
      `Cancel before this date to avoid the next charge.`,
    start: { date: day },
    end: { date: day },
    transparency: 'transparent',
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 24 * 60 * 2 }] },
  }

  try {
    await calendar.events.insert({ calendarId: 'primary', requestBody: body })
    return { ...base, date: day, status: 'created' }
  } catch (err) {
    const e = err as { code?: number; message?: string }
    if (e.code === 409) {
      try {
        await calendar.events.update({ calendarId: 'primary', eventId: base.event_id, requestBody: body })
        return { ...base, date: day, status: 'updated' }
      } catch (err2) {
        return { ...base, date: day, status: 'failed', reason: (err2 as Error).message }
      }
    }
    return { ...base, date: day, status: 'failed', reason: e.message ?? 'Calendar insert failed' }
  }
}

export async function writeCancellationEvent(
  auth: OAuth2Client,
  sub: { id: string; merchant: string },
  recipient: string
): Promise<RenewalEvent> {
  const calendar = google.calendar({ version: 'v3', auth })
  const day = dayString(new Date())
  const eventId = eventIdFor(sub.id, 'cancelled')
  const base = { subscription_id: sub.id, merchant: sub.merchant, event_id: eventId, date: day }

  const body = {
    id: eventId,
    summary: `${sub.merchant} — cancellation requested`,
    description:
      `SHAMAR dispatched a cancellation request to ${recipient}.\n\n` +
      `Watch for written confirmation from ${sub.merchant}. If none arrives within ` +
      `a billing cycle, the subscription may still be active.`,
    start: { date: day },
    end: { date: day },
    transparency: 'transparent',
  }

  try {
    await calendar.events.insert({ calendarId: 'primary', requestBody: body })
    return { ...base, status: 'created' }
  } catch (err) {
    const e = err as { code?: number; message?: string }
    if (e.code === 409) return { ...base, status: 'skipped', reason: 'Already recorded' }
    return { ...base, status: 'failed', reason: e.message ?? 'Calendar insert failed' }
  }
}
