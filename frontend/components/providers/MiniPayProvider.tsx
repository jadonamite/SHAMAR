'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { detectMiniPay } from '@/lib/minipay'

interface MiniPayContextType {
  isMiniPay: boolean
  isAutoConnecting: boolean
  miniPayAddress: string | null
}

const MiniPayContext = createContext<MiniPayContextType>({
  isMiniPay: false,
  isAutoConnecting: false,
  miniPayAddress: null,
})

export const useMiniPay = () => useContext(MiniPayContext)

// MiniPay injects window.ethereum directly — Privy login() is redundant and
// always flashes a modal. We bypass Privy entirely: call eth_requestAccounts
// on the injected provider. The resolved address is surfaced via miniPayAddress.
// Components should check isMiniPay and use miniPayAddress instead of Privy user
// when inside the MiniPay environment.
export default function MiniPayProvider({ children }: { children: React.ReactNode }) {
  const [isMiniPay, setIsMiniPay] = useState(false)
  const [isAutoConnecting, setIsAutoConnecting] = useState(false)
  const [miniPayAddress, setMiniPayAddress] = useState<string | null>(null)
  const triggered = useRef(false)

  const connectMiniPay = useCallback(async () => {
    if (triggered.current) return
    triggered.current = true
    setIsAutoConnecting(true)
    try {
      const accounts = (await window.ethereum?.request({
        method: 'eth_requestAccounts',
      })) as string[] | undefined
      setMiniPayAddress(accounts?.[0] ?? null)
    } catch {
      // User denied or provider unavailable — stay disconnected silently
    } finally {
      setIsAutoConnecting(false)
    }
  }, [])

  // Detect on mount — SSR always false, real value in browser
  useEffect(() => {
    const detected = detectMiniPay()
    setIsMiniPay(detected)
    if (detected) connectMiniPay()
  }, [connectMiniPay])

  // Keep address in sync if MiniPay rotates accounts (rare but possible)
  useEffect(() => {
    if (!isMiniPay || !window.ethereum) return
    const handleAccountsChanged = (accounts: unknown) => {
      const list = accounts as string[]
      setMiniPayAddress(list[0] ?? null)
    }
    window.ethereum.on('accountsChanged', handleAccountsChanged)
    return () => window.ethereum?.removeListener('accountsChanged', handleAccountsChanged)
  }, [isMiniPay])

  return (
    <MiniPayContext.Provider value={{ isMiniPay, isAutoConnecting, miniPayAddress }}>
      {children}
    </MiniPayContext.Provider>
  )
}
