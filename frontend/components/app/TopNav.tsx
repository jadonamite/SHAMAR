'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { NAV_LINKS } from '@/lib/nav'
import MobileMenu from './MobileMenu'
import { useMiniPay } from '@/components/providers/MiniPayProvider'
import Logo from '@/components/ui/Logo'

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
    <header className="sticky top-0 z-40 w-full glass border-b border-separator transition-colors">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-2.5 sm:px-8">
        {/* Left: Brand + Breadcrumb */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link
            href="/dashboard"
            className="touch-target inline-flex items-center text-label transition-colors hover:text-accent-text shrink-0"
            aria-label="SHAMAR Dashboard"
          >
            <Logo variant="lockup" size={24} priority />
          </Link>

          {title && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-label-3">/</span>
              <span className="truncate type-headline text-label font-medium">
                {title}
              </span>
            </div>
          )}
        </div>

        {/* Desktop Navigation Links */}
        <nav
          aria-label="In-app navigation"
          className="hidden lg:flex items-center gap-1.5"
        >
          {NAV_LINKS.filter((l) => l.href !== '/dashboard').map((link) => {
            const active =
              pathname === link.href || pathname?.startsWith(link.href + '/')
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`type-footnote touch-target px-3 rounded-full transition-colors ${
                  active
                    ? 'bg-surface-2 text-label font-medium shadow-sm'
                    : 'text-label-2 hover:text-label hover:bg-surface-2/60'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Right: Actions + User Identity */}
        <div className="hidden md:flex items-center gap-2.5">
          {actions}
          {rightMeta}

          {/* User Session Pill */}
          {user?.email?.address || user?.wallet?.address ? (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-separator bg-surface-2/80 text-label-2 type-caption font-mono"
            >
              {isMiniPay && (
                <span className="rounded-full bg-success/15 border border-success/30 px-1.5 py-0.5 text-[9px] font-bold text-success uppercase">
                  MiniPay
                </span>
              )}
              <span>
                {user?.email?.address ??
                  `${user?.wallet?.address?.slice(0, 6)}…${user?.wallet?.address?.slice(-4)}`}
              </span>
            </div>
          ) : null}
        </div>

        {/* Mobile Actions & Menu */}
        <div className="flex lg:hidden items-center gap-2">
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
        </div>
      </div>
    </header>
  )
}
