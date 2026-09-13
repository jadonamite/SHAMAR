'use client'

import { useEffect, useState, useMemo } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { createWalletClient, custom } from 'viem'
import { celo } from 'viem/chains'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import TopNav from '@/components/app/TopNav'
import { SelfAppBuilder, type SelfApp } from '@selfxyz/qrcode'

type SelfQRcodeProps = {
  selfApp: SelfApp
  onSuccess: () => void
  onError: (data: { error_code?: string; reason?: string }) => void
  type?: 'websocket' | 'deeplink'
  size?: number
  darkMode?: boolean
}

// SSR-safe — SelfQRcodeWrapper uses browser WebSocket APIs
const SelfQRcodeWrapper = dynamic<SelfQRcodeProps>(
  () => import('@selfxyz/qrcode').then((m) => ({ default: m.SelfQRcodeWrapper })),
  { ssr: false, loading: () => <div style={{ width: 200, height: 200, background: '#1C1C1C' }} /> }
)

type AgentStatus = {
  agent: {
    address: string
    configured: boolean
    policyContract: string | null
    erc8004Registry?: string
    scan8004Url?: string
  }
  user: {
    self_verified: boolean
    self_verified_at: string | null
    policy_granted: boolean
    policy_granted_at: string | null
  } | null
  onchainAuthorized?: boolean
}

type ActionRecord = {
  id: string
  type: string
  triggered_by: string
  executed_at: string
  reversible: boolean
  signature: string
  agent_address: string
  merchant: string
  amount: number
  currency: string
}

const SCOPE_LABELS: Record<string, string> = {
  cancel: 'Cancel subscriptions',
  pause: 'Pause subscriptions',
  remind: 'Schedule reminders',
  analyze: 'Run analysis',
}

const SAM_POLICY_ADDRESS = '0xae0b9b78419fe19b84152be75b4333bbbfd6f158' as const
const SAM_AGENT_ADDRESS  = '0x3ea23aa1d53eb5209f014f02ca889a6a7b37eed0' as const
const SAM_POLICY_ABI = [
  {
    name: 'grantDefaultScopes',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [],
  },
] as const

function ShortAddress({ address }: { address: string }) {
  if (!address || address === '0x0000000000000000000000000000000000000000') {
    return <span style={{ color: '#525252' }}>Not configured</span>
  }
  return (
    <span style={{ fontFamily: 'var(--font-dm-mono)' }}>
      {address.slice(0, 6)}…{address.slice(-4)}
    </span>
  )
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full"
      style={{ background: ok ? '#16A34A' : '#525252', flexShrink: 0 }}
    />
  )
}

export default function AgentPage() {
  const { ready, authenticated, user, login } = usePrivy()
  const { wallets } = useWallets()
  const router = useRouter()

  const [status, setStatus] = useState<AgentStatus | null>(null)
  const [history, setHistory] = useState<ActionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [granting, setGranting] = useState(false)
  const [selfSuccess, setSelfSuccess] = useState(false)
  const [selfError, setSelfError] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    if (!authenticated) { router.replace('/dashboard'); return }
    if (!user?.id) return
    load()
  }, [ready, authenticated, user?.id])

  async function load() {
    setLoading(true)
    try {
      const [statusRes, historyRes] = await Promise.all([
        fetch('/api/agent/status', { headers: { 'x-user-id': user!.id } }),
        fetch('/api/agent/history', { headers: { 'x-user-id': user!.id } }),
      ])
      if (statusRes.ok) setStatus(await statusRes.json())
      if (historyRes.ok) setHistory((await historyRes.json()).actions ?? [])
    } catch {
      // server offline
    } finally {
      setLoading(false)
    }
  }

  async function grantPolicy() {
    if (granting || !user?.id) return
    setGranting(true)
    try {
      const wallet = wallets[0]
      if (wallet) {
        const provider = await wallet.getEthereumProvider()
        const walletClient = createWalletClient({
          chain: celo,
          transport: custom(provider),
        })
        const [account] = await walletClient.getAddresses()
        await walletClient.writeContract({
          address: SAM_POLICY_ADDRESS,
          abi: SAM_POLICY_ABI,
          functionName: 'grantDefaultScopes',
          args: [SAM_AGENT_ADDRESS],
          account,
        })
      }
      const res = await fetch('/api/agent/grant-policy', {
        method: 'POST',
        headers: { 'x-user-id': user.id },
      })
      if (res.ok) {
        setStatus((prev) =>
          prev
            ? { ...prev, user: { ...prev.user!, policy_granted: true, policy_granted_at: new Date().toISOString() }, onchainAuthorized: true }
            : prev
        )
      }
    } catch {} finally {
      setGranting(false)
    }
  }

  // Build SelfApp config — memoised so it doesn't regenerate on every render
  const selfApp = useMemo(() => {
    if (!user?.id) return null
    return new SelfAppBuilder({
      appName: 'SAM — Subscription Agentic Manager',
      scope: 'sam-ciphergon',
      endpoint: `${process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3001'}/self/verify`,
      endpointType: 'staging_https',
      userId: user.id,
      sessionId: crypto.randomUUID(),
      devMode: process.env.NODE_ENV !== 'production',
      chainID: 42220, // Celo mainnet
    }).build()
  }, [user?.id])

  async function onSelfSuccess() {
    setSelfSuccess(true)
    setSelfError(null)
    // Mark verified in our DB
    try {
      await fetch('/api/self/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user!.id }),
      })
      setStatus((prev) =>
        prev ? { ...prev, user: { ...prev.user!, self_verified: true, self_verified_at: new Date().toISOString() } } : prev
      )
    } catch {}
  }

  async function revokePolicy() {
    if (!user?.id) return
    try {
      await fetch('/api/agent/revoke-policy', { method: 'POST', headers: { 'x-user-id': user.id } })
      setStatus((prev) =>
        prev ? { ...prev, user: { ...prev.user!, policy_granted: false } } : prev
      )
    } catch {}
  }


  if (!ready || loading) {
    return (
      <main className="min-h-screen bg-void flex items-center justify-center">
        <div className="w-1 h-1 bg-sam-red rounded-full animate-pulse" />
      </main>
    )
  }

  if (!authenticated) return null

  const agent = status?.agent
  const userStatus = status?.user
  const isConfigured = agent?.configured ?? false
  const isVerified = userStatus?.self_verified ?? false
  const isPolicyGranted = userStatus?.policy_granted ?? false

  return (
    <main className="min-h-screen bg-void">
      <TopNav
        title="Agent Identity"
        rightMeta={
          <span
            className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
            style={{
              fontFamily: 'var(--font-geist-sans)',
              color: isConfigured ? '#16A34A' : '#525252',
              border: `1px solid ${isConfigured ? 'rgba(22,163,74,0.3)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '2px',
            }}
          >
            {isConfigured ? 'Active' : 'Not configured'}
          </span>
        }
      />

      <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-6">

        {/* Agent wallet card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 p-5"
          style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '2px' }}
        >
          <span style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            SAM Agent
          </span>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Agent Address', value: <ShortAddress address={agent?.address ?? ''} /> },
              { label: 'Policy Contract', value: agent?.policyContract ? <ShortAddress address={agent.policyContract} /> : <span style={{ color: '#525252' }}>Not deployed</span> },
              { label: 'Signing', value: <span style={{ color: isConfigured ? '#16A34A' : '#525252' }}>{isConfigured ? 'EIP-191 personal_sign' : 'No key set'}</span> },
              { label: 'Chain', value: <span style={{ color: '#A3A3A3' }}>Celo Mainnet</span> },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-1">
                <span style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-dm-mono)', color: '#A3A3A3', fontSize: '12px' }}>{value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Trust levels */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="flex flex-col gap-4 p-5"
          style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '2px' }}
        >
          <span style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Trust Level
          </span>
          <div className="flex flex-col gap-3">
            {[
              { label: 'Wallet connected', done: !!user?.wallet?.address },
              { label: 'SELF Protocol verified', done: isVerified },
              { label: 'Policy execution granted', done: isPolicyGranted },
            ].map(({ label, done }) => (
              <div key={label} className="flex items-center gap-3">
                <StatusDot ok={done} />
                <span style={{ fontFamily: 'var(--font-geist-sans)', color: done ? '#A3A3A3' : '#525252', fontSize: '13px' }}>
                  {label}
                </span>
                {done && (
                  <span style={{ fontFamily: 'var(--font-dm-mono)', color: '#3a3a3a', fontSize: '10px' }}>✓</span>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* SELF Protocol verification */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="flex flex-col gap-4 p-5"
          style={{
            background: '#141414',
            border: `1px solid ${isVerified ? 'rgba(22,163,74,0.2)' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: '2px',
          }}
        >
          <div className="flex items-center justify-between">
            <span style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              SELF Protocol
            </span>
            {isVerified && (
              <span style={{ fontFamily: 'var(--font-dm-mono)', color: '#16A34A', fontSize: '11px' }}>Verified</span>
            )}
          </div>

          {isVerified || selfSuccess ? (
            <p style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '13px' }}>
              Identity verified. SAM logs attributable attestations tied to your ZK proof.
            </p>
          ) : selfApp ? (
            <div className="flex flex-col gap-3">
              <p style={{ fontFamily: 'var(--font-geist-sans)', color: '#A3A3A3', fontSize: '13px', lineHeight: 1.6 }}>
                Scan with the SELF app to generate a ZK proof of identity.
              </p>
              <div style={{ background: '#fff', padding: '12px', borderRadius: '2px', width: 'fit-content' }}>
                <SelfQRcodeWrapper
                  selfApp={selfApp}
                  onSuccess={onSelfSuccess}
                  onError={(data: { error_code?: string; reason?: string }) => setSelfError(data.reason ?? data.error_code ?? 'Verification failed')}
                  type="websocket"
                  size={180}
                  darkMode={false}
                />
              </div>
              {selfError && (
                <p style={{ fontFamily: 'var(--font-dm-mono)', color: '#E50914', fontSize: '11px' }}>{selfError}</p>
              )}
            </div>
          ) : (
            <p style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '13px' }}>
              Connect wallet to enable SELF verification.
            </p>
          )}
        </motion.div>

        {/* ERC8004 Policy */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="flex flex-col gap-4 p-5"
          style={{
            background: '#141414',
            border: `1px solid ${isPolicyGranted ? 'rgba(229,9,20,0.2)' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: '2px',
          }}
        >
          <div className="flex items-center justify-between">
            <span style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              ERC8004 Policy
            </span>
            <span style={{ fontFamily: 'var(--font-dm-mono)', color: isPolicyGranted ? '#E50914' : '#525252', fontSize: '11px' }}>
              {isPolicyGranted ? 'Active' : 'Not granted'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {Object.entries(SCOPE_LABELS).map(([scope, label]) => (
              <div key={scope} className="flex items-center gap-2">
                <StatusDot ok={isPolicyGranted} />
                <span style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '12px' }}>{label}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusDot ok={status?.onchainAuthorized ?? false} />
              <span style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '12px' }}>
                {status?.onchainAuthorized ? 'Onchain authorized' : 'Not onchain authorized'}
              </span>
            </div>
            {status?.agent?.scan8004Url && (
              <a
                href={status.agent.scan8004Url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: 'var(--font-dm-mono)', color: '#525252', fontSize: '10px', textDecoration: 'none' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#A3A3A3')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#525252')}
              >
                8004scan ↗
              </a>
            )}
          </div>

          <div className="flex gap-3">
            {!isPolicyGranted ? (
              <motion.button
                onClick={grantPolicy}
                disabled={granting}
                whileHover={{ scale: granting ? 1 : 1.02 }}
                whileTap={{ scale: granting ? 1 : 0.98 }}
                className="px-5 py-2.5 text-xs font-semibold uppercase tracking-widest cursor-pointer"
                style={{
                  fontFamily: 'var(--font-geist-sans)',
                  background: granting ? 'transparent' : '#E50914',
                  color: granting ? '#525252' : '#fff',
                  border: `1px solid ${granting ? 'rgba(255,255,255,0.06)' : '#E50914'}`,
                  borderRadius: '2px',
                }}
              >
                {granting ? 'Granting...' : 'Grant Policy Execution'}
              </motion.button>
            ) : (
              <button
                onClick={revokePolicy}
                className="px-5 py-2.5 text-xs font-semibold uppercase tracking-widest cursor-pointer"
                style={{
                  fontFamily: 'var(--font-geist-sans)',
                  background: 'transparent',
                  color: '#525252',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '2px',
                }}
              >
                Revoke
              </button>
            )}
          </div>
        </motion.div>

        {/* Attestation history */}
        {history.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="flex flex-col gap-3"
          >
            <span style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Attestation Log
            </span>
            <div className="flex flex-col gap-1.5">
              {history.slice(0, 10).map((action) => (
                <div
                  key={action.id}
                  className="flex items-center justify-between px-4 py-3"
                  style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '2px' }}
                >
                  <div className="flex flex-col gap-0.5">
                    <span style={{ fontFamily: 'var(--font-geist-sans)', color: '#A3A3A3', fontSize: '12px' }}>
                      {action.merchant} — {action.type}
                    </span>
                    <span style={{ fontFamily: 'var(--font-dm-mono)', color: '#3a3a3a', fontSize: '10px' }}>
                      {action.signature.slice(0, 24)}…
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span style={{ fontFamily: 'var(--font-dm-mono)', color: '#525252', fontSize: '11px' }}>
                      {new Date(action.executed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span style={{ fontFamily: 'var(--font-geist-sans)', color: '#3a3a3a', fontSize: '9px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {action.triggered_by}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </main>
  )
}
