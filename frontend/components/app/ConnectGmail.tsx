'use client'

import { motion } from 'framer-motion'
import { usePrivy } from '@privy-io/react-auth'

interface ConnectGmailProps {
  onConnected?: () => void
  compact?: boolean
}

export default function ConnectGmail({ compact = false }: ConnectGmailProps) {
  const { user } = usePrivy()

  function handleConnect() {
    if (!user?.id) return
    window.location.href = `/api/gmail/auth?user_id=${user.id}`
  }

  if (compact) {
    return (
      <motion.button
        onClick={handleConnect}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-widest cursor-pointer"
        style={{
          fontFamily: 'var(--font-geist-sans)',
          background: '#E50914',
          color: '#fff',
          borderRadius: '2px',
          letterSpacing: '0.08em',
        }}
      >
        Connect Gmail
      </motion.button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center gap-6 py-16 px-8"
      style={{
        background: '#141414',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '4px',
        maxWidth: '480px',
        margin: '0 auto',
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{ width: '300px', height: '300px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}
      >
        <svg viewBox="0 0 512 512" fill="none" width="150" height="150">
          <path d="M158 391v-142l-82-63V361q0 30 30 30" fill="#4285f4"/>
          <path d="M154 248l102 77l102-77v-98l-102 77l-102-77" fill="#ea4335"/>
          <path d="M354 391v-142l82-63V361q0 30-30 30" fill="#34a853"/>
          <path d="M76 188l82 63v-98l-30-23c-27-21-52 0-52 26" fill="#c5221f"/>
          <path d="M436 188l-82 63v-98l30-23c27-21 52 0 52 26" fill="#fbbc04"/>
        </svg>
      </div>

      <div className="text-center flex flex-col gap-2">
        <h3
          className="text-xl font-bold text-white"
          style={{ fontFamily: 'var(--font-syne)', letterSpacing: '-0.02em' }}
        >
          Connect Gmail
        </h3>
        <p style={{ fontFamily: 'var(--font-geist-sans)', color: '#A3A3A3' }} className="text-sm leading-relaxed">
          SAM reads your inbox to detect recurring subscriptions.
          <br />
          Read-only access. SAM cannot send or delete emails.
        </p>
      </div>

      <div className="flex flex-col gap-2 w-full">
        {['Read-only Gmail access', 'Detected in under 30 seconds', 'No manual entry required'].map((item) => (
          <div key={item} className="flex items-center gap-3">
            <div className="w-1 h-1 rounded-full" style={{ background: '#E50914', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-geist-sans)', color: '#525252' }} className="text-xs">
              {item}
            </span>
          </div>
        ))}
      </div>

      <motion.button
        onClick={handleConnect}
        whileHover={{ scale: 1.02, filter: 'brightness(1.1)' }}
        whileTap={{ scale: 0.98 }}
        className="w-full py-3 text-sm font-semibold uppercase tracking-widest cursor-pointer"
        style={{
          fontFamily: 'var(--font-geist-sans)',
          background: '#E50914',
          color: '#fff',
          borderRadius: '2px',
          letterSpacing: '0.08em',
        }}
      >
        Connect & Scan Gmail
      </motion.button>

      <p style={{ fontFamily: 'var(--font-dm-mono)', color: '#525252' }} className="text-[10px] text-center">
        You will be redirected to Google's secure sign-in page
      </p>
    </motion.div>
  )
}
