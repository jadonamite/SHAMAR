'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_LINKS } from '@/lib/nav'
import Logo from '@/components/ui/Logo'

interface MobileMenuProps {
  walletAddress?: string
  email?: string
  gmailConnected?: boolean
  scanning?: boolean
  walletScanning?: boolean
  onScanGmail?: () => void
  onScanWallet?: () => void
}

export default function MobileMenu({
  walletAddress,
  email,
  gmailConnected,
  scanning,
  walletScanning,
  onScanGmail,
  onScanWallet,
}: MobileMenuProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="touch-target flex flex-col items-center justify-center gap-1.5 p-2 rounded-full hover:bg-surface-2 transition-colors cursor-pointer"
      >
        <span className="w-5 h-[2px] bg-label rounded-full block" />
        <span className="w-5 h-[2px] bg-label rounded-full block" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs"
            />

            {/* Drawer */}
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-0 right-0 bottom-0 z-50 flex flex-col bg-surface border-l border-separator shadow-2xl w-[min(340px,85vw)]"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-separator/60">
                <Logo variant="lockup" size={22} />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="touch-target flex size-9 items-center justify-center rounded-full hover:bg-surface-2 text-label transition-colors"
                >
                  <svg
                    className="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* User Identity Chip */}
              {(email || walletAddress) && (
                <div className="p-4 mx-4 mt-3 rounded-[var(--radius-tile)] bg-surface-2 border border-separator/60 flex flex-col gap-1">
                  <span className="type-caption uppercase tracking-wider text-label-3 font-semibold">
                    Signed in as
                  </span>
                  <span className="type-caption font-mono text-label truncate font-medium">
                    {email ??
                      `${walletAddress?.slice(0, 6)}…${walletAddress?.slice(-4)}`}
                  </span>
                </div>
              )}

              {/* Navigation links */}
              <nav className="flex flex-col py-3 px-3 flex-1 overflow-y-auto">
                {NAV_LINKS.map((link) => {
                  const active =
                    pathname === link.href ||
                    (link.href !== '/dashboard' &&
                      pathname?.startsWith(link.href + '/'))
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-[44px] items-center justify-between px-4 py-2.5 rounded-xl type-footnote font-semibold transition-colors ${
                        active
                          ? 'bg-surface-2 text-label font-bold'
                          : 'text-label-2 hover:text-label hover:bg-surface-2/60'
                      }`}
                    >
                      <span>{link.label}</span>
                      {active && (
                        <span className="size-2 rounded-full bg-accent" />
                      )}
                    </Link>
                  )
                })}
              </nav>

              {/* Action buttons */}
              <div className="p-4 border-t border-separator/60 flex flex-col gap-2.5 bg-surface-2/40">
                {gmailConnected && onScanGmail && (
                  <button
                    type="button"
                    onClick={() => {
                      onScanGmail()
                      setOpen(false)
                    }}
                    disabled={scanning}
                    className="flex min-h-[44px] w-full items-center justify-center rounded-full bg-accent text-on-accent type-footnote font-semibold shadow-xs hover:bg-accent-hover transition-colors disabled:opacity-50"
                  >
                    {scanning ? 'Scanning Receipts…' : 'Scan Gmail Receipts'}
                  </button>
                )}

                {walletAddress && onScanWallet && (
                  <button
                    type="button"
                    onClick={() => {
                      onScanWallet()
                      setOpen(false)
                    }}
                    disabled={walletScanning}
                    className="flex min-h-[44px] w-full items-center justify-center rounded-full border border-separator bg-surface text-label type-footnote font-semibold hover:bg-surface-2 transition-colors disabled:opacity-50"
                  >
                    {walletScanning ? 'Scanning…' : 'Scan Base Wallet'}
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
