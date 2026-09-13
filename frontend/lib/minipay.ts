// Pure, SSR-safe MiniPay detection. Zero React dependencies.
// Single source of truth — every isMiniPay check in this app goes through here.
export function detectMiniPay(): boolean {
  if (typeof window === 'undefined') return false
  return window.ethereum?.isMiniPay === true
}
