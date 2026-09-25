'use client'

import { useEffect, useState, useMemo } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { createWalletClient, custom } from 'viem'
import { base } from 'viem/chains'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import TopNav from '@/components/app/TopNav'
import AppFooter from '@/components/app/AppFooter'
import AgentStateBadge, {
  type AgentStateKind,
} from '@/components/app/AgentStateBadge'
import { apiFetch } from '@/lib/api'

type AgentStatus = {
  state?: AgentStateKind
  reason?: string
  contract?: string | null
  agent?:
    | string
    | {
        address: string
        configured: boolean
        policyContract: string | null
        erc8004Registry?: string
        scan8004Url?: string
      }
  agentDetails?: {
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
    wallet_address: string | null
    telegram_chat_id: string | null
  } | null
  telegram_linked?: boolean
  gmail_connected?: boolean
  onchainAuthorized?: boolean
  halted?: boolean
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

const SHAMAR_POLICY_ABI = [
  {
    name: 'grantDefaultScopes',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [],
  },
  {
    name: 'revokeAll',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [],
  },
  {
    name: 'isAuthorized',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'agent', type: 'address' },
      { name: 'scope', type: 'bytes32' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

function ShortAddress({ address }: { address: string }) {
  if (!address || address === '0x0000000000000000000000000000000000000000') {
    return <span className="text-label-3 font-sans">Not configured</span>
  }
  return (
    <span className="font-mono text-xs text-label font-medium">
      {address.slice(0, 6)}…{address.slice(-4)}
    </span>
  )
}

export default function AgentPage() {
  const { ready, authenticated, user, logout } = usePrivy()
  const { wallets } = useWallets()
  const router = useRouter()

  const [status, setStatus] = useState<AgentStatus | null>(null)
  const [history, setHistory] = useState<ActionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [granting, setGranting] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [txMessage, setTxMessage] = useState<string | null>(null)

  // Telegram Linking State
  const [tgLoading, setTgLoading] = useState(false)
  const [tgLinkData, setTgLinkData] = useState<{
    code: string
    botUsername: string
    url: string
  } | null>(null)
  const isTelegramLinked = Boolean(
    status?.telegram_linked || status?.user?.telegram_chat_id
  )

  // Account Deletion State (R28 / A7)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    if (!authenticated) {
      router.replace('/dashboard')
      return
    }
    if (!user?.id) return
    load()
  }, [ready, authenticated, user?.id])

  async function load() {
    setLoading(true)
    try {
      const [statusRes, historyRes] = await Promise.all([
        apiFetch('/api/agent/status'),
        apiFetch('/api/agent/history'),
      ])
      if (statusRes.ok) setStatus(await statusRes.json())
      if (historyRes.ok) setHistory((await historyRes.json()).actions ?? [])
    } catch {
      // server offline
    } finally {
      setLoading(false)
    }
  }

  const agentAddr =
    typeof status?.agent === 'string'
      ? status.agent
      : (status?.agent?.address ?? status?.agentDetails?.address ?? '')
  const contractAddr =
    status?.contract ??
    (typeof status?.agent === 'object' ? status.agent.policyContract : null) ??
    status?.agentDetails?.policyContract ??
    '0xCcdF06aa225864B775de2bCA38403916375B6933'

  async function grantPolicy() {
    if (granting || !user?.id) return
    setGranting(true)
    setTxMessage('Preparing wallet transaction on Base…')
    try {
      const wallet = wallets[0]
      if (wallet && contractAddr && agentAddr) {
        const provider = await wallet.getEthereumProvider()
        const walletClient = createWalletClient({
          chain: base,
          transport: custom(provider),
        })
        await walletClient.switchChain({ id: base.id })
        const [account] = await walletClient.getAddresses()
        setTxMessage('Confirm grantDefaultScopes in your wallet…')
        await walletClient.writeContract({
          address: contractAddr as `0x${string}`,
          abi: SHAMAR_POLICY_ABI,
          functionName: 'grantDefaultScopes',
          args: [agentAddr as `0x${string}`],
          account,
        })
        setTxMessage('Grant recorded on-chain!')
        await load()
      }
    } catch (err) {
      setTxMessage('Transaction cancelled or failed.')
    } finally {
      setGranting(false)
      setTimeout(() => setTxMessage(null), 4000)
    }
  }

  async function revokePolicy() {
    if (revoking || !user?.id) return
    setRevoking(true)
    setTxMessage('Preparing revokeAll on Base…')
    try {
      const wallet = wallets[0]
      if (wallet && contractAddr && agentAddr) {
        const provider = await wallet.getEthereumProvider()
        const walletClient = createWalletClient({
          chain: base,
          transport: custom(provider),
        })
        await walletClient.switchChain({ id: base.id })
        const [account] = await walletClient.getAddresses()
        setTxMessage('Confirm revokeAll in your wallet…')
        await walletClient.writeContract({
          address: contractAddr as `0x${string}`,
          abi: SHAMAR_POLICY_ABI,
          functionName: 'revokeAll',
          args: [agentAddr as `0x${string}`],
          account,
        })
        setTxMessage('Permissions revoked on Base.')
        await load()
      }
    } catch (err) {
      setTxMessage('Revocation cancelled or failed.')
    } finally {
      setRevoking(false)
      setTimeout(() => setTxMessage(null), 4000)
    }
  }

  async function handleLinkTelegram() {
    if (!user?.id || tgLoading) return
    setTgLoading(true)
    try {
      const res = await apiFetch('/api/telegram/link-code', {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json()
        setTgLinkData(data)
      }
    } catch {
      // offline
    } finally {
      setTgLoading(false)
    }
  }

  // Poll while user is in linking flow
  useEffect(() => {
    if (!tgLinkData || isTelegramLinked) return
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch('/api/telegram/status')
        if (res.ok) {
          const data = await res.json()
          if (data.linked) {
            setTgLinkData(null)
            load()
            clearInterval(interval)
          }
        }
      } catch {}
    }, 2500)

    return () => clearInterval(interval)
  }, [tgLinkData, isTelegramLinked])

  async function handleLogout() {
    await logout()
    router.push('/')
  }

  async function handleDeleteAccount() {
    if (!user?.id || deleting || deleteInput.trim().toUpperCase() !== 'DELETE')
      return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await apiFetch('/api/account', {
        method: 'DELETE',
      })
      if (res.ok) {
        await logout()
        router.push('/?account_deleted=1')
      } else {
        const data = await res.json().catch(() => null)
        setDeleteError(
          data?.error || 'Failed to delete account. Please try again.'
        )
        setDeleting(false)
      }
    } catch {
      setDeleteError('Connection error. Please try again.')
      setDeleting(false)
    }
  }

  if (!ready || loading) {
    return (
      <main className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="size-2 rounded-full bg-accent animate-pulse" />
      </main>
    )
  }

  if (!authenticated) return null

  const isConfigured = Boolean(agentAddr)
  const isPolicyGranted = Boolean(
    status?.onchainAuthorized || status?.user?.policy_granted
  )

  const agentStateKind: AgentStateKind = status?.halted
    ? 'halted'
    : isPolicyGranted
      ? 'authorized'
      : 'unauthorized'

  return (
    <main className="min-h-screen bg-canvas text-label flex flex-col justify-between">
      <TopNav
        title="Agent & Policy"
        rightMeta={
          <AgentStateBadge
            state={agentStateKind}
            reason={status?.reason}
            compact
          />
        }
      />

      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div>
          <h1 className="type-title-1 font-[600] text-label tracking-tight">
            Agent Governance
          </h1>
          <p className="type-callout text-label-2">
            Non-custodial session authorization on Base mainnet. You hold full
            revoke power.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-3">
            <a
              href="#telegram-section"
              className="touch-target px-3.5 py-1.5 rounded-full border border-separator bg-surface text-label-2 hover:text-label hover:bg-surface-2 type-caption font-semibold transition-colors"
            >
              Telegram Connection ↓
            </a>
            <a
              href="#danger-zone"
              className="touch-target px-3.5 py-1.5 rounded-full border border-danger/40 text-danger hover:bg-danger/10 type-caption font-semibold transition-colors"
            >
              Permanently Delete Account & Reset ↓
            </a>
          </div>
        </div>

        {/* Status Line (R23) */}
        <div className="flex items-center justify-between rounded-[var(--radius-card)] bg-surface p-4 border border-separator/80 shadow-xs flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`size-2.5 rounded-full ${
                agentStateKind === 'authorized'
                  ? 'bg-success shadow-[0_0_8px_var(--color-success)]'
                  : agentStateKind === 'halted'
                    ? 'bg-accent shadow-[0_0_8px_var(--color-accent)]'
                    : 'bg-label-3'
              }`}
            />
            <div>
              <p className="type-footnote font-semibold text-label">
                {status?.reason ?? 'Checking agent permissions on Base…'}
              </p>
              <p className="type-caption text-label-3">
                Contract: <ShortAddress address={contractAddr} /> · Scope:
                shamar.*
              </p>
            </div>
          </div>
          <AgentStateBadge state={agentStateKind} reason={status?.reason} />
        </div>

        {/* On-Chain Session Grant / Revoke */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-6 border border-separator/80 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="type-headline font-semibold text-label">
                SHAMARPolicy Session Key
              </h2>
              <p className="type-caption text-label-3">
                Scoped permission recorded on Base mainnet at{' '}
                {contractAddr.slice(0, 10)}…
              </p>
            </div>
            <span
              className={`px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded-full border ${
                isPolicyGranted
                  ? 'text-success bg-success/10 border-success/30'
                  : 'text-label-3 bg-surface-2 border-separator'
              }`}
            >
              {isPolicyGranted ? 'Granted' : 'Not granted'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {Object.entries(SCOPE_LABELS).map(([scope, label]) => (
              <div
                key={scope}
                className="flex items-center gap-2.5 rounded-lg bg-surface-2/60 p-2.5 border border-separator/50"
              >
                <span
                  className={`size-1.5 rounded-full ${
                    isPolicyGranted ? 'bg-success' : 'bg-label-3'
                  }`}
                />
                <span className="type-footnote font-medium text-label-2">
                  {label}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-2 flex-wrap">
            {!isPolicyGranted ? (
              <motion.button
                type="button"
                onClick={grantPolicy}
                disabled={granting}
                whileHover={{ scale: granting ? 1 : 1.02 }}
                whileTap={{ scale: granting ? 1 : 0.98 }}
                className="touch-target inline-flex min-h-[44px] items-center rounded-full bg-accent px-6 type-headline font-semibold text-on-accent shadow-xs hover:bg-accent-hover active:scale-[0.97] disabled:opacity-50 transition-all cursor-pointer"
              >
                {granting ? 'Granting on Base…' : 'Grant Session Permission'}
              </motion.button>
            ) : (
              <button
                type="button"
                onClick={revokePolicy}
                disabled={revoking}
                className="touch-target inline-flex min-h-[44px] items-center rounded-full border border-separator bg-surface px-6 type-headline font-semibold text-accent hover:bg-accent-soft active:scale-[0.97] disabled:opacity-50 transition-all cursor-pointer"
              >
                {revoking
                  ? 'Revoking on Base…'
                  : 'Revoke Permission (Kill Switch)'}
              </button>
            )}

            {txMessage && (
              <span className="type-caption font-mono text-label-2">
                {txMessage}
              </span>
            )}
          </div>
        </motion.div>

        {/* Telegram Emergency Channel */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          id="telegram-section"
          className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-6 border border-separator/80 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="type-headline font-semibold text-label">
                Telegram Renewal Alerts & Stop
              </h2>
              <p className="type-caption text-label-3">
                Receive interactive renewal prompts before each charge. Reply
                stop anytime to halt dispatches.
              </p>
            </div>
            <span
              className={`px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded-full border ${
                isTelegramLinked
                  ? 'text-success bg-success/10 border-success/30'
                  : 'text-label-3 bg-surface-2 border-separator'
              }`}
            >
              {isTelegramLinked ? 'Linked' : 'Not linked'}
            </span>
          </div>

          {!tgLinkData ? (
            <button
              type="button"
              onClick={handleLinkTelegram}
              disabled={tgLoading}
              className="touch-target inline-flex min-h-[44px] items-center self-start rounded-full border border-separator bg-surface px-5 type-footnote font-semibold text-label hover:bg-surface-2 shadow-2xs transition-colors cursor-pointer"
            >
              {tgLoading
                ? 'Generating link…'
                : isTelegramLinked
                  ? 'Re-link Telegram'
                  : 'Connect Telegram'}
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-xl bg-surface-2 p-4 border border-separator">
              <p className="type-caption text-label font-medium">
                Tap the link below or send{' '}
                <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-accent">
                  /start link_{tgLinkData.code}
                </code>{' '}
                to @{tgLinkData.botUsername}:
              </p>
              <a
                href={tgLinkData.url}
                target="_blank"
                rel="noreferrer"
                className="type-footnote inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-accent hover:underline"
              >
                Open in Telegram ↗
              </a>
            </div>
          )}
        </motion.div>

        {/* Attestation Log */}
        {history.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-6 border border-separator/80 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <h2 className="type-headline font-semibold text-label">
                Attestation Log (EIP-191)
              </h2>
              <Link
                href="/audit"
                className="type-footnote text-accent hover:underline font-medium"
              >
                View full audit log →
              </Link>
            </div>

            <div className="flex flex-col divide-y divide-separator/60 pt-1">
              {history.slice(0, 5).map((action) => (
                <div
                  key={action.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="type-footnote font-semibold text-label truncate">
                      {action.merchant} · {action.type}
                    </p>
                    <p className="type-caption font-mono text-label-3 truncate">
                      Sig: {action.signature?.slice(0, 24)}…
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="type-caption font-mono text-label-2">
                      {new Date(action.executed_at).toLocaleDateString(
                        'en-US',
                        {
                          month: 'short',
                          day: 'numeric',
                        }
                      )}
                    </p>
                    <span className="type-caption text-[10px] uppercase tracking-wider font-semibold text-label-3">
                      {action.triggered_by}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Your Data & Account Deletion (PRD R28 / B1 / A7) */}
        <div
          id="danger-zone"
          className="mt-6 rounded-[var(--radius-card)] border-2 border-danger/40 bg-surface p-6 sm:p-8 shadow-xs flex flex-col gap-4"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-danger" />
              <h2 className="type-headline font-semibold text-danger">
                Danger Zone: Permanently Delete Account & Reset Data
              </h2>
            </div>
            <p className="type-callout text-label-2 mt-1">
              Permanently delete all your detected subscriptions, rules, action
              history, unlinks Telegram, and revokes Gmail tokens to start over completely fresh.
            </p>
          </div>

          <div className="rounded-[var(--radius-tile)] bg-surface-2 p-4 text-left flex flex-col gap-1.5">
            <p className="type-footnote text-label font-semibold">
              Before deleting:
            </p>
            <p className="type-caption text-label-2 leading-relaxed">
              Permissions granted on the Base blockchain are permanent and
              public. If you have granted permission, please click{' '}
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="text-accent underline font-medium cursor-pointer"
              >
                Revoke All
              </button>{' '}
              at the top of this page before deleting your server records.
            </p>
          </div>

          {!confirmDelete ? (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleLogout}
                className="touch-target inline-flex min-h-[44px] items-center self-start rounded-full border border-separator bg-surface px-5 type-footnote font-semibold text-label hover:bg-surface-2 transition-colors cursor-pointer"
              >
                Log out
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(true)
                  setDeleteInput('')
                  setDeleteError(null)
                }}
                className="touch-target inline-flex min-h-[44px] items-center self-start rounded-full bg-danger px-6 type-footnote font-semibold text-white hover:bg-danger/90 transition-colors cursor-pointer shadow-xs"
              >
                Permanently Delete Account
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5 rounded-xl bg-danger/5 p-5 border border-danger/30 shadow-xs">
              <div>
                <p className="type-headline font-semibold text-danger">
                  Permanently delete account and all data?
                </p>
                <p className="type-caption text-label-2 mt-1">
                  This revokes Gmail OAuth access, clears all subscription
                  records, and unlinks Telegram immediately. This cannot be
                  undone. To confirm, type{' '}
                  <span className="font-mono font-bold text-label">DELETE</span>{' '}
                  below:
                </p>
              </div>

              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="Type DELETE"
                className="w-full max-w-xs rounded-full border border-separator bg-surface px-4 py-2 type-footnote font-mono text-label outline-none focus:border-danger transition-colors"
              />

              {deleteError && (
                <p className="type-caption text-danger font-medium">
                  {deleteError}
                </p>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={
                    deleting || deleteInput.trim().toUpperCase() !== 'DELETE'
                  }
                  className="touch-target inline-flex min-h-[44px] items-center justify-center rounded-full bg-danger px-5 type-footnote font-semibold text-white hover:bg-danger/90 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  {deleting ? 'Deleting data…' : 'Permanently delete account'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDelete(false)
                    setDeleteInput('')
                    setDeleteError(null)
                  }}
                  disabled={deleting}
                  className="touch-target inline-flex min-h-[44px] items-center justify-center rounded-full border border-separator bg-surface px-5 type-footnote font-semibold text-label hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AppFooter />
    </main>
  )
}
