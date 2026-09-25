import type { Subscription } from '@/components/app/SubscriptionRow'

export interface UserDashboardData {
  subs: Subscription[]
  gmailConnected: boolean
  telegramLinked: boolean
  hasPolicies: boolean
  lastScan: string | null
}

const memoryCache = new Map<string, UserDashboardData>()

const STORAGE_PREFIX = 'shamar_dashboard_cache_'
const INITIAL_SCAN_PREFIX = 'shamar_initial_scan_'

export function getCachedDashboardData(userId: string): UserDashboardData | null {
  if (!userId) return null
  if (memoryCache.has(userId)) {
    return memoryCache.get(userId)!
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(`${STORAGE_PREFIX}${userId}`)
      if (stored) {
        const parsed = JSON.parse(stored) as UserDashboardData
        memoryCache.set(userId, parsed)
        return parsed
      }
    } catch {
      // Storage access or JSON parse failure
    }
  }
  return null
}

export function setCachedDashboardData(
  userId: string,
  data: Partial<UserDashboardData>
): void {
  if (!userId) return
  const current = getCachedDashboardData(userId) || {
    subs: [],
    gmailConnected: false,
    telegramLinked: false,
    hasPolicies: false,
    lastScan: null,
  }
  const updated: UserDashboardData = {
    ...current,
    ...data,
  }
  memoryCache.set(userId, updated)
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(updated))
    } catch {
      // Quota exceeded or private browsing restriction
    }
  }
}

export function hasInitialScanCompleted(userId: string): boolean {
  if (!userId || typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(`${INITIAL_SCAN_PREFIX}${userId}`) === 'true'
  } catch {
    return false
  }
}

export function markInitialScanCompleted(userId: string): void {
  if (!userId || typeof window === 'undefined') return
  try {
    sessionStorage.setItem(`${INITIAL_SCAN_PREFIX}${userId}`, 'true')
  } catch {
    // Quota exceeded or private browsing restriction
  }
}

export function clearUserCache(userId?: string): void {
  if (userId) {
    memoryCache.delete(userId)
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(`${STORAGE_PREFIX}${userId}`)
        sessionStorage.removeItem(`${INITIAL_SCAN_PREFIX}${userId}`)
      } catch {
        // Ignore storage removal errors
      }
    }
  } else {
    memoryCache.clear()
    if (typeof window !== 'undefined') {
      try {
        const keysToRemove: string[] = []
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i)
          if (
            key &&
            (key.startsWith(STORAGE_PREFIX) || key.startsWith(INITIAL_SCAN_PREFIX))
          ) {
            keysToRemove.push(key)
          }
        }
        for (const key of keysToRemove) {
          sessionStorage.removeItem(key)
        }
      } catch {
        // Ignore storage removal errors
      }
    }
  }
}
