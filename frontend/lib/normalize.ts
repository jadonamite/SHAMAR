function num(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function normalizeSubscription<T extends Record<string, unknown>>(raw: T): T {
  return {
    ...raw,
    amount: num(raw.amount),
    confidence: numOrNull(raw.confidence),
  } as T
}

export function normalizeRec<T extends Record<string, unknown>>(raw: T): T {
  return {
    ...raw,
    amount: num(raw.amount),
    confidence: num(raw.confidence),
  } as T
}

export function normalizeAction<T extends Record<string, unknown>>(raw: T): T {
  return {
    ...raw,
    amount: num(raw.amount),
  } as T
}
