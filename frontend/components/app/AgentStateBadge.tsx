'use client'

import { useState } from 'react'

export type AgentStateKind =
  | 'authorized'
  | 'halted'
  | 'blocked'
  | 'checking'
  | 'unauthorized'

export interface AgentStateProps {
  state: AgentStateKind
  reason?: string
  scope?: string
  source?: 'onchain' | 'local' | 'none'
  compact?: boolean
}

export default function AgentStateBadge({
  state,
  reason,
  scope = 'shamar.cancel',
  source = 'onchain',
  compact = false,
}: AgentStateProps) {
  const [open, setOpen] = useState(false)

  const config = {
    authorized: {
      label: 'Authorized',
      dotClass: 'bg-success',
      badgeClass: 'bg-success/10 border-success/30 text-success',
      defaultReason: `Active grant for ${scope} verified on Base mainnet.`,
    },
    halted: {
      label: 'Halted',
      dotClass: 'bg-accent',
      badgeClass: 'bg-accent/10 border-accent/30 text-accent',
      defaultReason:
        'Emergency halt triggered via Telegram /stop. Dispatches refused until /resume.',
    },
    blocked: {
      label: 'Blocked',
      dotClass: 'bg-warning',
      badgeClass: 'bg-warning/10 border-warning/30 text-warning',
      defaultReason: 'Missing on-chain policy grant or halted by guardrails.',
    },
    unauthorized: {
      label: 'Not granted',
      dotClass: 'bg-label-3',
      badgeClass: 'bg-surface-2 border-separator text-label-2',
      defaultReason:
        'Policy not granted on Base. Authorize in your wallet to enable.',
    },
    checking: {
      label: 'Verifying',
      dotClass: 'bg-label-3',
      badgeClass: 'bg-surface-2 border-separator text-label-2',
      defaultReason: 'Checking authorization and control channel...',
    },
  }[state]

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`min-h-[36px] inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono tracking-wider transition-all cursor-pointer border shadow-2xs hover:opacity-90 ${config.badgeClass}`}
        aria-expanded={open}
        aria-label={`Agent status: ${config.label}`}
      >
        <span
          className={`size-2 rounded-full shrink-0 animate-pulse ${config.dotClass}`}
        />
        <span className="font-semibold uppercase tracking-wider text-[11px]">
          {config.label}
        </span>
        {!compact && (
          <span className="text-[10px] text-label-3 font-sans">
            {source === 'onchain' ? 'Base' : source === 'local' ? 'Local' : ''}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 p-3.5 rounded-[var(--radius-card)] bg-surface border border-separator shadow-lg z-50 text-xs text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="type-eyebrow text-[10px] text-label-3">
              Agent authority (R23)
            </span>
            <span
              className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${config.badgeClass}`}
            >
              {config.label}
            </span>
          </div>
          <p className="type-caption leading-relaxed text-label mb-2">
            {reason || config.defaultReason}
          </p>
          <div className="pt-2 border-t border-separator text-[11px] text-label-3 space-y-1 font-mono">
            <div>Scope: {scope}</div>
            <div>Source: {source}</div>
            <div>Control: Telegram /stop</div>
          </div>
        </div>
      )}
    </div>
  )
}
