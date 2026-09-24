// Classifies Google API errors and retries Gmail calls that were rate limited,
// without ever waiting past the caller's deadline.

type HeaderBag = { get?: (name: string) => string | null } & Record<string, unknown>

type GoogleError = {
  status?: number
  code?: number | string
  message?: string
  response?: {
    status?: number
    headers?: HeaderBag
    data?: { error?: string | { errors?: { reason?: string }[] } }
  }
}

const RATE_LIMIT_REASONS = new Set(['rateLimitExceeded', 'userRateLimitExceeded'])

export function gmailErrorStatus(err: unknown): number | undefined {
  const e = err as GoogleError
  const status = e?.response?.status ?? e?.status ?? (typeof e?.code === 'number' ? e.code : undefined)
  return typeof status === 'number' ? status : undefined
}

export function gmailErrorReason(err: unknown): string | undefined {
  const data = (err as GoogleError)?.response?.data
  if (typeof data?.error === 'string') return data.error
  return data?.error?.errors?.[0]?.reason
}

export function isRateLimited(err: unknown): boolean {
  const status = gmailErrorStatus(err)
  if (status === 429) return true
  const reason = gmailErrorReason(err)
  return status === 403 && reason !== undefined && RATE_LIMIT_REASONS.has(reason)
}

// Refresh token revoked or expired (Google Testing mode expires them after 7 days).
export function isAuthExpired(err: unknown): boolean {
  if (gmailErrorReason(err) === 'invalid_grant') return true
  return ((err as GoogleError)?.message ?? '').includes('invalid_grant')
}

export function retryAfterMs(err: unknown, now = Date.now()): number | undefined {
  const headers = (err as GoogleError)?.response?.headers
  if (!headers) return undefined
  const raw =
    typeof headers.get === 'function'
      ? headers.get('retry-after')
      : (headers['retry-after'] as string | undefined)
  if (!raw) return undefined
  const seconds = Number(raw)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const at = Date.parse(raw)
  return Number.isNaN(at) ? undefined : Math.max(0, at - now)
}

export type RetryOptions = {
  deadline: number // epoch ms; no wait may end after this
  attempts?: number // total tries, including the first
  baseMs?: number
  sleep?: (ms: number) => Promise<void>
  random?: () => number
  now?: () => number
}

export async function withGmailRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const {
    deadline,
    attempts = 3,
    baseMs = 1000,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    random = Math.random,
    now = Date.now,
  } = opts

  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (!isRateLimited(err) || attempt >= attempts) throw err
      // Exponential backoff with full jitter, or Google's Retry-After if longer.
      const backoff = random() * baseMs * 2 ** (attempt - 1)
      const wait = Math.max(backoff, retryAfterMs(err, now()) ?? 0)
      if (now() + wait > deadline) throw err
      await sleep(wait)
    }
  }
}
