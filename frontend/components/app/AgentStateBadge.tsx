'use client'

import { useState } from 'react'

export type AgentStateKind = 'authorized' | 'halted' | 'blocked' | 'checking'

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
      dotColor: '#16A34A',
      badgeBg: 'rgba(22, 163, 74, 0.12)',
      badgeBorder: 'rgba(22, 163, 74, 0.3)',
      defaultReason: `Active grant for ${scope} verified ${source === 'onchain' ? 'on-chain (Base)' : 'locally'}.`,
    },
    halted: {
      label: 'Halted',
      dotColor: '#E50914',
      badgeBg: 'rgba(229, 9, 20, 0.15)',
      badgeBorder: 'rgba(229, 9, 20, 0.4)',
      defaultReason:
        'Emergency halt triggered via Telegram /stop. Dispatches refused until /resume.',
    },
    blocked: {
      label: 'Blocked',
      dotColor: '#D97706',
      badgeBg: 'rgba(217, 119, 6, 0.12)',
      badgeBorder: 'rgba(217, 119, 6, 0.35)',
      defaultReason: 'Missing on-chain policy grant or halted by guardrails.',
    },
    checking: {
      label: 'Verifying',
      dotColor: '#A3A3A3',
      badgeBg: 'rgba(255, 255, 255, 0.05)',
      badgeBorder: 'rgba(255, 255, 255, 0.1)',
      defaultReason: 'Checking authorization and control channel...',
    },
  }[state]

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="min-h-[44px] inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono tracking-wider transition-colors cursor-pointer"
        style={{
          backgroundColor: config.badgeBg,
          borderColor: config.badgeBorder,
          borderWidth: '1px',
          color: 'var(--text-primary)',
        }}
        aria-expanded={open}
        aria-label={`Agent status: ${config.label}`}
      >
        <span
          className="w-2 h-2 rounded-full shrink-0 animate-pulse"
          style={{ backgroundColor: config.dotColor }}
        />
        <span className="font-semibold uppercase tracking-wider text-[11px]">
          {config.label}
        </span>
        {!compact && (
          <span className="text-[10px] text-muted">
            {source === 'onchain' ? 'Base' : source === 'local' ? 'Local' : ''}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-72 p-3.5 rounded border shadow-xl z-50 text-xs text-left"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-strong)',
            color: 'var(--text-primary)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-muted">
              Agent authority (R23)
            </span>
            <span
              className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: config.badgeBg,
                color: config.dotColor,
                border: `1px solid ${config.badgeBorder}`,
              }}
            >
              {config.label}
            </span>
          </div>
          <p className="text-secondary leading-relaxed mb-2">
            {reason || config.defaultReason}
          </p>
          <div
            className="pt-2 border-t text-[11px] text-muted space-y-1 font-mono"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div>Scope: {scope}</div>
            <div>Source: {source}</div>
            <div>Control: Telegram /stop</div>
          </div>
        </div>
      )}
    </div>
  )
}
