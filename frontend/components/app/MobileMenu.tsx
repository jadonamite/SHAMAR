'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_LINKS } from '@/lib/nav'

interface MobileMenuProps {
  walletAddress?: string
  email?: string
  gmailConnected?: boolean
  scanning?: boolean
  walletScanning?: boolean
  debugScanning?: boolean
  onScanGmail?: () => void
  onScanWallet?: () => void
  onDebugScan?: () => void
}

export default function MobileMenu({
  walletAddress,
  email,
  gmailConnected,
  scanning,
  walletScanning,
  debugScanning,
  onScanGmail,
  onScanWallet,
  onDebugScan,
}: MobileMenuProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const showDebug = process.env.NODE_ENV !== 'production'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="md:hidden flex flex-col gap-1.5 p-2 cursor-pointer"
        style={{ background: 'none', border: 'none' }}
      >
        <span style={{ width: '20px', height: '1.5px', background: '#A3A3A3', display: 'block' }} />
        <span style={{ width: '20px', height: '1.5px', background: '#A3A3A3', display: 'block' }} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            />

            {/* drawer */}
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
              className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
              style={{
                width: 'min(320px, 85vw)',
                background: '#0a0a0a',
                borderLeft: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {/* drawer header */}
              <div
                className="flex items-center justify-between px-5 py-4 border-b"
                style={{ borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-syne)',
                    color: '#fff',
                    fontSize: '16px',
                    letterSpacing: '-0.02em',
                    fontWeight: 700,
                  }}
                >
                  SAM
                </span>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#A3A3A3',
                    fontSize: '22px',
                    lineHeight: 1,
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                >
                  ×
                </button>
              </div>

              {/* user identity */}
              <div
                className="px-5 py-4 border-b flex flex-col gap-1"
                style={{ borderColor: 'rgba(255,255,255,0.04)' }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-geist-sans)',
                    color: '#525252',
                    fontSize: '10px',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                  }}
                >
                  Signed in as
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-dm-mono)',
                    color: '#fff',
                    fontSize: '12px',
                    wordBreak: 'break-all',
                  }}
                >
                  {email ?? (walletAddress?.slice(0, 6) + '...' + walletAddress?.slice(-4))}
                </span>
              </div>

              {/* nav links */}
              <nav className="flex flex-col py-2 flex-1">
                {NAV_LINKS.map((link) => {
                  const active = pathname === link.href || pathname?.startsWith(link.href + '/')
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className="px-5 py-3"
                      style={{
                        fontFamily: 'var(--font-geist-sans)',
                        color: active ? '#fff' : '#A3A3A3',
                        fontSize: '14px',
                        letterSpacing: '-0.01em',
                        borderLeft: active ? '2px solid #E50914' : '2px solid transparent',
                      }}
                    >
                      {link.label}
                    </Link>
                  )
                })}
              </nav>

              {/* action buttons */}
              <div
                className="px-5 py-4 flex flex-col gap-2 border-t"
                style={{ borderColor: 'rgba(255,255,255,0.04)' }}
              >
                {walletAddress && onScanWallet && (
                  <button
                    onClick={() => {
                      onScanWallet()
                      setOpen(false)
                    }}
                    disabled={walletScanning}
                    className="w-full py-3 cursor-pointer"
                    style={{
                      fontFamily: 'var(--font-geist-sans)',
                      background: 'transparent',
                      color: walletScanning ? '#525252' : '#fff',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '2px',
                      fontSize: '12px',
                      letterSpacing: '0.08em',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    {walletScanning ? 'Scanning…' : 'Scan Wallet'}
                  </button>
                )}
                {gmailConnected && onScanGmail && (
                  <button
                    onClick={() => {
                      onScanGmail()
                      setOpen(false)
                    }}
                    disabled={scanning}
                    className="w-full py-3 cursor-pointer"
                    style={{
                      fontFamily: 'var(--font-geist-sans)',
                      background: scanning ? '#2a2a2a' : '#E50914',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '2px',
                      fontSize: '12px',
                      letterSpacing: '0.08em',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    {scanning ? 'Scanning…' : 'Scan Gmail'}
                  </button>
                )}
                {onDebugScan && showDebug && (
                  <button
                    onClick={() => {
                      onDebugScan()
                      setOpen(false)
                    }}
                    disabled={debugScanning}
                    className="w-full py-3 cursor-pointer"
                    style={{
                      fontFamily: 'var(--font-geist-sans)',
                      background: 'transparent',
                      color: debugScanning ? '#525252' : '#FACC15',
                      border: `1px solid ${debugScanning ? 'rgba(255,255,255,0.08)' : 'rgba(250,204,21,0.4)'}`,
                      borderRadius: '2px',
                      fontSize: '12px',
                      letterSpacing: '0.08em',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    {debugScanning ? 'Debugging…' : 'Debug Scan'}
                  </button>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
