'use client'

import { motion } from 'framer-motion'

interface ConfidenceScoreProps {
  score: number
  signals?: string[]
  action?: 'cancel' | 'pause' | 'remind' | 'keep'
}

const ACTION_COLORS = {
  cancel: '#E50914',
  pause: '#D97706',
  remind: '#3B82F6',
  keep: '#16A34A',
}

const ACTION_LABELS = {
  cancel: 'CANCEL',
  pause: 'PAUSE',
  remind: 'REMIND',
  keep: 'KEEP',
}

export default function ConfidenceScore({ score, signals = [], action }: ConfidenceScoreProps) {
  const color = action ? ACTION_COLORS[action] : score >= 70 ? '#E50914' : score >= 40 ? '#D97706' : '#16A34A'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-2">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ fontFamily: 'var(--font-dm-mono)', color, lineHeight: 1 }}
          className="text-6xl font-bold"
        >
          {score}
        </motion.span>
        <span style={{ fontFamily: 'var(--font-dm-mono)', color: '#525252' }} className="text-lg mb-1">
          %
        </span>
        {action && (
          <span
            className="mb-1 px-2 py-0.5 text-[10px] font-bold tracking-widest"
            style={{
              fontFamily: 'var(--font-geist-sans)',
              color,
              border: `1px solid ${color}`,
              borderRadius: '2px',
            }}
          >
            {ACTION_LABELS[action]}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-px w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          className="h-full"
          style={{ background: color }}
        />
      </div>

      {/* Signal list */}
      {signals.length > 0 && (
        <ul className="flex flex-col gap-1">
          {signals.slice(0, 3).map((sig, i) => (
            <li
              key={i}
              style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252' }}
              className="text-xs flex items-center gap-2"
            >
              <span style={{ color, fontSize: '6px' }}>●</span>
              {sig}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
