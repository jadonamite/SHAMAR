import { sql } from './db.js'

// Postgres-backed key/value store. Replaces Upstash so the server has one
// fewer hard dependency at boot — the previous module threw on import when
// Redis credentials were absent, which took the whole process down.

const TTL = {
  insight: 60 * 60 * 6,
  scan: 60 * 2,
  wallet_scan: 60 * 2,
  gmail_token: 60 * 60 * 24 * 30,
  gmail_sync: 60 * 60 * 24 * 180,
}

async function kvGet<T>(key: string): Promise<T | null> {
  const rows = await sql`
    SELECT value FROM kv
    WHERE key = ${key} AND (expires_at IS NULL OR expires_at > now())
  `
  return rows.length > 0 ? (rows[0].value as T) : null
}

async function kvSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const expires = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : null
  await sql`
    INSERT INTO kv (key, value, expires_at, updated_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, ${expires}, now())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at, updated_at = now()
  `
}

// Returns false when the key already exists and is unexpired — the primitive
// the scan lock is built on.
async function kvSetNx(key: string, value: unknown, ttlSeconds: number): Promise<boolean> {
  const expires = new Date(Date.now() + ttlSeconds * 1000).toISOString()
  const rows = await sql`
    INSERT INTO kv (key, value, expires_at, updated_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, ${expires}, now())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at, updated_at = now()
      WHERE kv.expires_at IS NOT NULL AND kv.expires_at <= now()
    RETURNING key
  `
  return rows.length > 0
}

async function kvDel(key: string): Promise<void> {
  await sql`DELETE FROM kv WHERE key = ${key}`
}

// Minimal Redis-shaped surface so callers written against the old client keep
// working unchanged.
export const redis = {
  get: <T>(key: string) => kvGet<T>(key),
  set: (key: string, value: unknown, opts?: { ex?: number; nx?: boolean }) =>
    opts?.nx
      ? kvSetNx(key, value, opts.ex ?? 60).then((ok) => (ok ? 'OK' : null))
      : kvSet(key, value, opts?.ex).then(() => 'OK'),
  del: (key: string) => kvDel(key),
}

export async function getCachedInsight(subId: string): Promise<string | null> {
  return kvGet<string>(`insight:${subId}`)
}

export async function setCachedInsight(subId: string, insight: string): Promise<void> {
  await kvSet(`insight:${subId}`, insight, TTL.insight)
}

export async function invalidateInsight(subId: string): Promise<void> {
  await kvDel(`insight:${subId}`)
}

export async function getScanLock(userId: string): Promise<boolean> {
  return kvSetNx(`scan_lock:${userId}`, 1, TTL.scan)
}

export async function releaseScanLock(userId: string): Promise<void> {
  await kvDel(`scan_lock:${userId}`)
}

export async function getWalletScanLock(userId: string): Promise<boolean> {
  return kvSetNx(`wallet_scan_lock:${userId}`, 1, TTL.wallet_scan)
}

export type GmailTokens = { refresh_token: string; access_token?: string }

export async function storeGmailTokens(userId: string, tokens: GmailTokens): Promise<void> {
  await kvSet(`gmail_tokens:${userId}`, tokens, TTL.gmail_token)
}

export async function getGmailTokens(userId: string): Promise<GmailTokens | null> {
  return kvGet<GmailTokens>(`gmail_tokens:${userId}`)
}

export async function hasGmailConnected(userId: string): Promise<boolean> {
  const tokens = await getGmailTokens(userId)
  return Boolean(tokens?.refresh_token)
}

export type GmailSyncState = {
  lastCompletedAt?: number
  resumeToken?: string
  resumeQuery?: string
}

export async function getGmailSync(userId: string): Promise<GmailSyncState> {
  return (await kvGet<GmailSyncState>(`gmail_sync:${userId}`)) ?? {}
}

export async function setGmailSync(userId: string, state: GmailSyncState): Promise<void> {
  await kvSet(`gmail_sync:${userId}`, state, TTL.gmail_sync)
}
