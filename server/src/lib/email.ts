// Resend email sender — no SDK needed, just fetch
// Free tier: 100 emails/day. Register at resend.com
// Add RESEND_API_KEY + RESEND_FROM to server/.env

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const FROM = process.env.RESEND_FROM ?? 'SAM <sam@ciphergon.xyz>'

export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
}): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not set — email skipped')
    return false
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html }),
    })
    if (!res.ok) {
      console.error('[Email] Send failed:', await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error('[Email] Fetch error:', (err as Error).message)
    return false
  }
}

export function reminderEmail(merchant: string, amount: number, currency: string, cadence: string, message?: string): string {
  const amountStr = currency === 'USD' ? `$${amount.toFixed(2)}` : `${amount} ${currency}`
  return `<div style="font-family:monospace;background:#0D0D0D;color:#A3A3A3;padding:32px;max-width:480px">
  <h1 style="color:#E50914;font-size:16px;font-weight:bold;margin:0 0 20px;letter-spacing:0.08em">SAM REMINDER</h1>
  <p style="margin:0 0 8px">Your <strong style="color:#fff">${merchant}</strong> subscription is coming up.</p>
  <p style="font-size:22px;color:#fff;margin:0 0 8px;letter-spacing:-0.02em">${amountStr}<span style="color:#525252;font-size:14px">/${cadence}</span></p>
  ${message ? `<p style="margin:16px 0;color:#A3A3A3;font-size:13px">${message}</p>` : ''}
  <a href="https://sam.ciphergon.xyz/subscriptions" style="display:inline-block;margin-top:20px;background:#E50914;color:#fff;padding:10px 20px;text-decoration:none;font-weight:bold;font-size:11px;letter-spacing:0.1em">REVIEW →</a>
  <p style="margin:24px 0 0;color:#3a3a3a;font-size:10px">SAM — Subscription Intelligence by Ciphergon</p>
</div>`
}
