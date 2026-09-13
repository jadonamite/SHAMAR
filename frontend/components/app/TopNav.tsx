'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { NAV_LINKS } from '@/lib/nav'
import MobileMenu from './MobileMenu'
import { useMiniPay } from '@/components/providers/MiniPayProvider'

interface TopNavProps {
  title?: string
  actions?: React.ReactNode
  rightMeta?: React.ReactNode
  scanning?: boolean
  walletScanning?: boolean
  debugScanning?: boolean
  gmailConnected?: boolean
  onScanGmail?: () => void
  onScanWallet?: () => void
  onDebugScan?: () => void
}

export default function TopNav({
  title,
  actions,
  rightMeta,
  scanning,
  walletScanning,
  debugScanning,
  gmailConnected,
  onScanGmail,
  onScanWallet,
  onDebugScan,
}: TopNavProps) {
  const pathname = usePathname()
  const { user } = usePrivy()
  const { isMiniPay } = useMiniPay()

  return (
    <header
      className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b"
      style={{ borderColor: 'rgba(255,255,255,0.06)' }}
    >
      {/* Left: logo + optional section title */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0" aria-label="SAM home">
          <Image
            src="/SAM.png"
            alt="SAM"
            width={24}
            height={24}
            priority
            className="rounded-sm"
          />
          <span
            className="text-white font-bold tracking-tight hidden sm:inline"
            style={{ fontFamily: 'var(--font-syne)', fontSize: '16px', letterSpacing: '-0.02em' }}
          >
            SAM
          </span>
        </Link>
        {title && (
          <>
            <span style={{ color: 'rgba(255,255,255,0.12)' }}>/</span>
            <span
              className="truncate"
              style={{ fontFamily: 'var(--font-syne)', color: '#fff', fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em' }}
            >
              {title}
            </span>
          </>
        )}
      </div>

      {/* Desktop: nav links + actions + identity */}
      <div className="hidden md:flex items-center gap-3">
        <nav className="flex items-center gap-3">
          {NAV_LINKS.filter((l) => l.href !== '/dashboard').map((link) => {
            const active = pathname === link.href || pathname?.startsWith(link.href + '/')
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                style={{
                  fontFamily: 'var(--font-dm-mono)',
                  color: active ? '#fff' : '#525252',
                  fontSize: '11px',
                  borderBottom: active ? '1px solid #E50914' : '1px solid transparent',
                  paddingBottom: '2px',
                  transition: 'color 0.15s',
                }}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
        {actions}
        {rightMeta}
        {user?.email?.address || user?.wallet?.address ? (
          <div className="flex items-center gap-2">
            {isMiniPay && (
              <span style={{
                fontFamily: 'var(--font-dm-mono)',
                color: '#22c55e',
                fontSize: '9px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                border: '1px solid rgba(34,197,94,0.3)',
                padding: '2px 6px',
              }}>
                MiniPay
              </span>
            )}
            <span style={{ fontFamily: 'var(--font-dm-mono)', color: '#525252', fontSize: '11px' }}>
              {user?.email?.address ?? user?.wallet?.address?.slice(0, 6) + '...' + user?.wallet?.address?.slice(-4)}
            </span>
          </div>
        ) : null}
      </div>

      {/* Mobile */}
      <MobileMenu
        walletAddress={user?.wallet?.address}
        email={user?.email?.address}
        gmailConnected={gmailConnected}
        scanning={scanning}
        walletScanning={walletScanning}
        debugScanning={debugScanning}
        onScanGmail={onScanGmail}
        onScanWallet={onScanWallet}
        onDebugScan={onDebugScan}
      />
    </header>
  )
}
