'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { formatMoney } from '@/lib/format'

export type Subscription = {
  id: string
  name: string
  merchant: string
  amount: number
  currency?: string
  cadence: 'daily' | 'weekly' | 'monthly' | 'yearly'
  source: 'gmail' | 'wallet'
  status: 'active' | 'paused' | 'cancelled'
  confidence?: number
  action?: 'cancel' | 'pause' | 'remind' | 'keep'
  last_charged?: string | null
  detected_at?: string | null
}

interface SubscriptionRowProps {
  sub: Subscription
  onStatusChange?: (id: string, status: 'active' | 'paused' | 'cancelled') => void
  href?: string
}

const ACTION_COLORS: Record<string, string> = {
  cancel: '#E50914',
  pause: '#D97706',
  remind: '#3B82F6',
  keep: '#16A34A',
}

const CADENCE_LABELS: Record<string, string> = {
  daily: '/day',
  weekly: '/wk',
  monthly: '/mo',
  yearly: '/yr',
}

function MerchantAvatar({ name }: { name: string }) {
  return (
    <div
      className="w-9 h-9 flex items-center justify-center flex-shrink-0"
      style={{
        background: 'rgba(229,9,20,0.12)',
        border: '1px solid rgba(229,9,20,0.2)',
        borderRadius: '2px',
      }}
    >
      <span
        style={{ fontFamily: 'var(--font-syne)', color: '#E50914', fontSize: '14px', fontWeight: 700 }}
      >
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  )
}

export default function SubscriptionRow({ sub, onStatusChange, href }: SubscriptionRowProps) {
  const [hovered, setHovered] = useState(false)
  const router = useRouter()
  const actionColor = sub.action ? ACTION_COLORS[sub.action] : undefined

  const monthlyEquiv =
    sub.cadence === 'yearly'
      ? sub.amount / 12
      : sub.cadence === 'weekly'
      ? sub.amount * 4.33
      : sub.cadence === 'daily'
      ? sub.amount * 30
      : sub.amount

  return (
    <motion.div
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={() => href && router.push(href)}
      animate={{
        y: hovered ? -2 : 0,
        borderColor: hovered ? 'rgba(229,9,20,0.25)' : 'rgba(255,255,255,0.06)',
      }}
      transition={{ duration: 0.18 }}
      className="relative flex items-center gap-4 px-4 py-3.5"
      style={{
        background: '#141414',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '2px',
        cursor: href ? 'pointer' : 'default',
      }}
    >
      {/* Red left border on hover */}
      <motion.div
        animate={{ opacity: hovered ? 1 : 0, scaleY: hovered ? 1 : 0.4 }}
        transition={{ duration: 0.18 }}
        className="absolute left-0 top-0 bottom-0 w-0.5"
        style={{ background: '#E50914', transformOrigin: 'center' }}
      />

      {/* Merchant avatar */}
      <MerchantAvatar name={sub.merchant} />

      {/* Name + cadence */}
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <span
          className="text-sm font-medium text-white truncate"
          style={{ fontFamily: 'var(--font-geist-sans)' }}
        >
          {sub.merchant}
        </span>
        <div className="flex items-center gap-2">
          <span
            style={{ fontFamily: 'var(--font-dm-mono)', color: '#525252', fontSize: '11px' }}
          >
            {sub.cadence}
          </span>
          <span style={{ color: '#525252', fontSize: '10px' }}>·</span>
          <span
            style={{ fontFamily: 'var(--font-dm-mono)', color: '#525252', fontSize: '11px' }}
          >
            {sub.source}
          </span>
        </div>
      </div>

      {/* Confidence badge */}
      {(sub.confidence != null || sub.action) && (
        <div className="flex flex-col items-end gap-0.5">
          <span
            style={{
              fontFamily: 'var(--font-dm-mono)',
              color: actionColor ?? '#A3A3A3',
              fontSize: '11px',
              letterSpacing: '0.04em',
            }}
          >
            {sub.confidence != null ? `${sub.confidence}% risk` : '— risk'}
          </span>
          {sub.action && (
            <span
              style={{
                fontFamily: 'var(--font-geist-sans)',
                color: actionColor,
                fontSize: '9px',
                letterSpacing: '0.1em',
                fontWeight: 700,
              }}
            >
              {sub.action.toUpperCase()}
            </span>
          )}
        </div>
      )}

      {/* Amount */}
      <div className="flex flex-col items-end gap-0.5 ml-4">
        <span
          style={{ fontFamily: 'var(--font-dm-mono)', color: '#fff', fontSize: '15px', letterSpacing: '-0.01em' }}
        >
          {formatMoney(sub.amount, sub.currency)}
        </span>
        <span
          style={{ fontFamily: 'var(--font-dm-mono)', color: '#525252', fontSize: '11px' }}
        >
          {CADENCE_LABELS[sub.cadence]}
        </span>
      </div>

      {/* Quick actions (hover only) */}
      <AnimatePresence>
        {hovered && onStatusChange && (
          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2 ml-2"
          >
            {sub.status === 'active' && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); onStatusChange(sub.id, 'paused') }}
                  className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest cursor-pointer"
                  style={{
                    fontFamily: 'var(--font-geist-sans)',
                    color: '#D97706',
                    border: '1px solid rgba(217,119,6,0.4)',
                    borderRadius: '2px',
                    background: 'transparent',
                  }}
                >
                  Pause
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onStatusChange(sub.id, 'cancelled') }}
                  className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest cursor-pointer"
                  style={{
                    fontFamily: 'var(--font-geist-sans)',
                    color: '#E50914',
                    border: '1px solid rgba(229,9,20,0.4)',
                    borderRadius: '2px',
                    background: 'transparent',
                  }}
                >
                  Cancel
                </button>
              </>
            )}
            {sub.status === 'paused' && (
              <button
                onClick={(e) => { e.stopPropagation(); onStatusChange(sub.id, 'active') }}
                className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest cursor-pointer"
                style={{
                  fontFamily: 'var(--font-geist-sans)',
                  color: '#16A34A',
                  border: '1px solid rgba(22,163,74,0.4)',
                  borderRadius: '2px',
                  background: 'transparent',
                }}
              >
                Resume
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
