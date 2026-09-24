'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  motion,
  AnimatePresence,
  useScroll,
  useSpring,
  useTransform,
  useReducedMotion,
} from 'framer-motion'
import BrandLogo from '@/components/ui/BrandLogo'

function Row({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-[12px] bg-surface px-3.5 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.05] ${className}`}
    >
      {children}
    </div>
  )
}

/* =========================================================================
   STEP 01: CONNECT ART (Interactive Connection & Receipt Stream Simulator)
   ========================================================================= */
function ConnectArt() {
  const [syncedCount, setSyncedCount] = useState(142)
  const [isScanning, setIsScanning] = useState(false)

  const triggerScan = () => {
    if (isScanning) return
    setIsScanning(true)
    let added = 0
    const interval = setInterval(() => {
      added += 1
      setSyncedCount((prev) => prev + 1)
      if (added >= 5) {
        clearInterval(interval)
        setIsScanning(false)
      }
    }, 120)
  }

  return (
    <div className="relative flex flex-col gap-3 overflow-hidden rounded-[16px] bg-surface-2/60 p-1">
      {/* Ambient scanning radar wave */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-x-10 top-0 h-24 bg-gradient-to-b from-accent/[0.08] via-accent/[0.03] to-transparent"
        animate={{ y: [-30, 200, -30], opacity: [0, 0.9, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Gmail Tile */}
      <motion.div
        whileHover={{ scale: 1.015, y: -2 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      >
        <Row className="relative overflow-hidden">
          <BrandLogo name="gmail" size={38} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="type-footnote font-semibold text-label">Gmail</p>
              <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                <span className="size-1.5 rounded-full bg-success animate-pulse" />{' '}
                Live
              </span>
            </div>
            <p className="type-caption text-label-3 truncate">
              Read-only token · Scoped strictly to billing & invoices
            </p>
          </div>
          <span className="type-caption shrink-0 rounded-full bg-accent-soft px-2.5 py-1 font-semibold text-accent-text">
            Connected
          </span>
        </Row>
      </motion.div>

      {/* Connecting animated data line */}
      <div className="relative mx-8 flex items-center justify-between py-0.5">
        <div className="h-4 w-[2px] bg-gradient-to-b from-separator to-accent/40 mx-auto" />
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 size-2 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]"
          animate={{ y: [-8, 8, -8], opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Telegram Tile */}
      <motion.div
        whileHover={{ scale: 1.015, y: -2 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      >
        <Row className="relative overflow-hidden">
          <BrandLogo name="telegram" size={38} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="type-footnote font-semibold text-label">Telegram</p>
              <span className="flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-text">
                <span className="size-1.5 rounded-full bg-accent animate-pulse" />{' '}
                Ready
              </span>
            </div>
            <p className="type-caption text-label-3 truncate">
              @ShamarAgentBot · Where it asks you before renewing
            </p>
          </div>
          <span className="type-caption shrink-0 rounded-full bg-accent-soft px-2.5 py-1 font-semibold text-accent-text">
            Linked
          </span>
        </Row>
      </motion.div>

      {/* Dynamic Sync Status Chip with Interactive Pulse */}
      <div className="flex items-center justify-between rounded-[12px] bg-surface p-2.5 ring-1 ring-black/[0.04]">
        <div className="flex items-center gap-2 min-w-0">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className="size-4 shrink-0 text-success"
            aria-hidden
          >
            <path
              d="M8 1.5l5 2.2v4.2c0 3.2-2.1 6.1-5 6.9-2.9-.8-5-3.7-5-6.9V3.7L8 1.5z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M5.5 7.8l1.7 1.7 3.3-3.3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="truncate">
            <p className="type-caption font-semibold text-label">
              Receipts Indexed
            </p>
            <p className="type-caption text-[11px] text-label-3">
              Past 12 months verified
            </p>
          </div>
        </div>

        <motion.button
          type="button"
          onClick={triggerScan}
          whileTap={{ scale: 0.94 }}
          whileHover={{ scale: 1.04 }}
          className="type-caption flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 font-semibold text-label hover:bg-surface ring-1 ring-separator"
        >
          <motion.span
            animate={isScanning ? { rotate: 360 } : {}}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            className="inline-block"
          >
            ↻
          </motion.span>
          <span className="tabular">{syncedCount} receipts</span>
        </motion.button>
      </div>
    </div>
  )
}

/* =========================================================================
   STEP 02: FIND ART (Dynamic Radar & Live Scanning Cascade)
   ========================================================================= */
function FindArt() {
  const [activeItem, setActiveItem] = useState<number | null>(null)

  const rows = [
    {
      brand: 'netflix' as const,
      name: 'Netflix',
      price: '$15.49',
      status: 'Renews in 3 days',
      tag: 'No views in 38d',
    },
    {
      brand: 'claude' as const,
      name: 'Claude Pro',
      price: '$20.00',
      status: 'Renews in 7 days',
      tag: 'Active daily',
    },
    {
      brand: 'duolingo' as const,
      name: 'Duolingo Super',
      price: '$12.99',
      status: 'Renews in 2 days',
      tag: 'Streak lost 42d',
    },
    {
      brand: 'chatgpt' as const,
      name: 'ChatGPT Plus',
      price: '$20.00',
      status: 'Renews in 14 days',
      tag: 'Overlaps Claude',
    },
  ]

  return (
    <div className="relative flex flex-col gap-2 overflow-hidden rounded-[16px] bg-surface-2/60 p-1">
      {/* Animated laser radar line */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent z-20 shadow-[0_0_12px_var(--color-accent)]"
        animate={{ y: [0, 200, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Subscription Detection Rows */}
      {rows.map((r, i) => (
        <motion.div
          key={r.name}
          onHoverStart={() => setActiveItem(i)}
          onHoverEnd={() => setActiveItem(null)}
          whileHover={{ x: 4, scale: 1.01 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        >
          <Row className="relative transition-colors hover:bg-surface">
            <BrandLogo name={r.brand} size={34} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="type-footnote font-semibold text-label truncate">
                  {r.name}
                </p>
                <span className="type-caption text-[11px] rounded-md bg-surface-2 px-1.5 py-0.5 text-label-3">
                  {r.tag}
                </span>
              </div>
              <p className="type-caption text-label-3">{r.status}</p>
            </div>

            <div className="text-right">
              <span className="type-footnote tabular font-semibold text-label">
                {r.price}
              </span>
              <p className="type-caption text-[11px] text-label-3">/mo</p>
            </div>
          </Row>
        </motion.div>
      ))}

      {/* Live Spending Summary Chip */}
      <motion.div
        animate={{ scale: [1, 1.01, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="mt-1 flex items-center justify-between rounded-[12px] bg-accent-soft/80 px-3.5 py-2 text-accent-text ring-1 ring-accent/20"
      >
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-accent animate-pulse" />
          <span className="type-caption font-semibold">
            4 recurring charges identified
          </span>
        </div>
        <span className="type-caption tabular font-bold">
          $68.48 / mo ($821/yr)
        </span>
      </motion.div>
    </div>
  )
}

/* =========================================================================
   STEP 03: THINK ART (Interactive Blast Radius & AI Safeguard Engine)
   ========================================================================= */
function WeighArt() {
  const [testingBlocked, setTestingBlocked] = useState(false)

  const simulateForceCancel = () => {
    setTestingBlocked(true)
    setTimeout(() => setTestingBlocked(false), 2200)
  }

  return (
    <div className="relative flex flex-col gap-3 rounded-[16px] bg-surface p-4 shadow-[0_2px_6px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.05] overflow-hidden">
      {/* Central Figma item with impact radar */}
      <div className="flex items-center justify-between border-b border-separator/60 pb-3">
        <div className="relative flex items-center gap-3">
          <div className="relative">
            <BrandLogo name="figma" size={40} />
            {/* Concentric warning ripple rings */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -inset-2 rounded-[14px] border border-accent/40"
              animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2.4, repeat: Infinity }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="type-footnote font-semibold text-label">
                Figma Professional
              </p>
              <span className="type-caption rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent-text">
                High Impact
              </span>
            </div>
            <p className="type-caption text-label-3">Blast Radius Evaluation</p>
          </div>
        </div>

        <span className="type-caption rounded-full bg-surface-2 px-3 py-1 font-semibold text-label-2 tabular">
          $15 / mo
        </span>
      </div>

      {/* Dynamic Threat Meter Bar */}
      <div className="flex flex-col gap-1.5 pt-1">
        <div className="flex items-center justify-between type-caption">
          <span className="font-semibold text-label-2">Blast Radius Risk</span>
          <span className="font-bold text-accent-text">
            92% · Irreversible loss
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2 ring-1 ring-black/[0.04]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-warning to-accent"
            initial={{ width: '0%' }}
            animate={{ width: '92%' }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      {/* Blast Radius Impact Breakdown */}
      <div className="flex flex-col gap-2 pt-1">
        <motion.div
          whileHover={{ x: 3 }}
          className="flex items-start gap-2.5 rounded-lg bg-surface-2/60 p-2"
        >
          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" />
          <div className="flex-1 min-w-0">
            <p className="type-footnote font-semibold text-label">
              18 team projects archived
            </p>
            <p className="type-caption text-label-3">
              Design version history deleted immediately
            </p>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ x: 3 }}
          className="flex items-start gap-2.5 rounded-lg bg-surface-2/60 p-2"
        >
          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" />
          <div className="flex-1 min-w-0">
            <p className="type-footnote font-semibold text-label">
              3 active editors will lose access
            </p>
            <p className="type-caption text-label-3">
              Teammates actively working on files this week
            </p>
          </div>
        </motion.div>
      </div>

      {/* Animated Shield Safeguard Banner */}
      <motion.div
        animate={testingBlocked ? { x: [-6, 6, -4, 4, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between rounded-[12px] bg-accent-soft px-3 py-2 text-accent-text"
      >
        <div className="flex items-center gap-2">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className="size-4 shrink-0 text-accent"
            aria-hidden
          >
            <rect
              x="3"
              y="6"
              width="10"
              height="8"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M5 6V4a3 3 0 016 0v2"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          <p className="type-caption font-semibold leading-tight">
            {testingBlocked
              ? 'Blocked by SHAMAR SafePolicy! Too much to lose.'
              : 'SHAMAR SafePolicy: Auto-cancel suppressed. Reminds you instead.'}
          </p>
        </div>

        <button
          type="button"
          onClick={simulateForceCancel}
          className="type-caption shrink-0 rounded-md bg-surface px-2 py-0.5 font-bold text-accent-text shadow-2xs hover:bg-white/90"
        >
          {testingBlocked ? 'Blocked' : 'Test policy'}
        </button>
      </motion.div>
    </div>
  )
}

/* =========================================================================
   STEP 04: ACT ART (Interactive Telegram Autonomous Cancellation Demo)
   ========================================================================= */
function AskArt() {
  const [actionState, setActionState] = useState<'idle' | 'cancelled' | 'kept'>(
    'idle'
  )

  const resetDemo = () => setActionState('idle')

  return (
    <div className="relative flex flex-col gap-3 rounded-[16px] bg-inverse p-4 text-on-inverse shadow-xl ring-1 ring-white/10 overflow-hidden">
      {/* Telegram Chat Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <BrandLogo name="telegram" size={24} />
          <div className="flex items-center gap-1.5">
            <span className="type-caption font-semibold text-white">
              SHAMAR Agent
            </span>
            <span className="flex size-3.5 items-center justify-center rounded-full bg-accent text-white">
              <svg
                className="size-2.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-white/50 type-caption">
          <span className="size-1.5 rounded-full bg-success animate-pulse" />
          <span>online</span>
        </div>
      </div>

      {/* Message Area */}
      <AnimatePresence mode="wait">
        {actionState === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col gap-3"
          >
            {/* Telegram Message Bubble */}
            <div className="rounded-2xl rounded-tl-sm bg-white/10 p-3.5 text-white/95 backdrop-blur-sm border border-white/5">
              <p className="type-footnote leading-relaxed">
                <strong className="text-white font-semibold">
                  Duolingo Super
                </strong>{' '}
                renews in 2 days for{' '}
                <span className="tabular font-semibold text-white">$12.99</span>
                . Zero practice in 42 days. Keep it or cancel?
              </p>
            </div>

            {/* Interactive Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <motion.button
                type="button"
                onClick={() => setActionState('cancelled')}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 2.5, repeat: Infinity }}
                className="type-footnote flex min-h-[44px] items-center justify-center rounded-full bg-accent px-4 font-semibold text-white shadow-md shadow-accent/25 hover:bg-accent-hover transition-colors"
              >
                Cancel it for me
              </motion.button>
              <motion.button
                type="button"
                onClick={() => setActionState('kept')}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                className="type-footnote flex min-h-[44px] items-center justify-center rounded-full bg-white/15 px-4 font-semibold text-white/90 hover:bg-white/20 transition-colors"
              >
                Keep subscription
              </motion.button>
            </div>

            {/* Countdown Silence Window Ticker */}
            <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-white/70">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-warning animate-pulse" />
                <span className="type-caption text-[11px] font-medium">
                  Silence rule: cancels at T-36h
                </span>
              </div>
              <span className="type-caption tabular font-bold text-white/90">
                35h 59m left
              </span>
            </div>
          </motion.div>
        )}

        {actionState === 'cancelled' && (
          <motion.div
            key="cancelled"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center gap-3 py-3 text-center"
          >
            {/* Confetti simulation particles */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              className="flex size-12 items-center justify-center rounded-full bg-success/20 text-success"
            >
              <svg
                className="size-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </motion.div>

            <div>
              <p className="type-footnote font-bold text-white">
                Cancellation Stamped
              </p>
              <p className="type-caption text-white/70 mt-0.5">
                Duolingo Super cancelled safely. Saved $12.99/mo!
              </p>
            </div>

            <button
              type="button"
              onClick={resetDemo}
              className="type-caption mt-1 rounded-full bg-white/15 px-3 py-1 font-semibold text-white hover:bg-white/25"
            >
              Reset demo
            </button>
          </motion.div>
        )}

        {actionState === 'kept' && (
          <motion.div
            key="kept"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center gap-3 py-3 text-center"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-white/20 text-white">
              <svg
                className="size-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div>
              <p className="type-footnote font-bold text-white">
                Subscription Kept
              </p>
              <p className="type-caption text-white/70 mt-0.5">
                Next renewal logged to Google Calendar. We’ll ask again next
                month.
              </p>
            </div>
            <button
              type="button"
              onClick={resetDemo}
              className="type-caption mt-1 rounded-full bg-white/15 px-3 py-1 font-semibold text-white hover:bg-white/25"
            >
              Reset demo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const STEPS = [
  {
    n: '01',
    label: 'Connect',
    title: 'Link your Gmail and Telegram.',
    body: 'About thirty seconds. SHAMAR only reads receipts, and it talks to you where you already are.',
    art: <ConnectArt />,
  },
  {
    n: '02',
    label: 'Find',
    title: 'It finds every subscription.',
    body: 'A year of receipts, read for you. Each subscription comes back with its price and next renewal date.',
    art: <FindArt />,
  },
  {
    n: '03',
    label: 'Think',
    title: 'It checks what you’d lose.',
    body: 'Files that disappear, a plan your family shares, a price you’d never get back. If it would hurt, it won’t cancel.',
    art: <WeighArt />,
  },
  {
    n: '04',
    label: 'Act',
    title: 'It asks, then handles it.',
    body: 'A message before each renewal. Tap Cancel or Keep. Ignore it, and SHAMAR cancels for you.',
    art: <AskArt />,
  },
]

export default function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [scrollDistance, setScrollDistance] = useState(0)
  const [activeStep, setActiveStep] = useState(0)
  const reduceMotion = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  })

  // Spring physics for luxurious momentum
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 24,
    mass: 0.2,
    restDelta: 0.0005,
  })

  const x = useTransform(smoothProgress, [0, 1], [0, -scrollDistance])

  // Parallax offsets for background elements
  const watermarkX = useTransform(smoothProgress, [0, 1], [30, -50])
  const orbX = useTransform(smoothProgress, [0, 1], [0, -120])

  // Track scroll travel distance based on track contents vs viewport
  useEffect(() => {
    if (reduceMotion) return

    const updateDistance = () => {
      const track = trackRef.current
      if (!track || !track.parentElement) return
      const totalWidth = track.scrollWidth
      const containerWidth = track.parentElement.clientWidth
      setScrollDistance(Math.max(0, totalWidth - containerWidth + 48))
    }

    updateDistance()
    window.addEventListener('resize', updateDistance)
    const ro = new ResizeObserver(updateDistance)
    if (trackRef.current) ro.observe(trackRef.current)

    return () => {
      window.removeEventListener('resize', updateDistance)
      ro.disconnect()
    }
  }, [reduceMotion])

  // Active step synchronization
  useEffect(() => {
    if (reduceMotion) return

    return smoothProgress.on('change', (latest) => {
      if (latest < 0.22) setActiveStep(0)
      else if (latest < 0.48) setActiveStep(1)
      else if (latest < 0.74) setActiveStep(2)
      else setActiveStep(3)
    })
  }, [smoothProgress, reduceMotion])

  const scrollToStep = (index: number) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const scrollTop = window.scrollY + rect.top
    const scrollableHeight = container.offsetHeight - window.innerHeight
    const stepOffsets = [0.02, 0.3, 0.58, 0.92]
    window.scrollTo({
      top: scrollTop + scrollableHeight * stepOffsets[index],
      behavior: 'smooth',
    })
  }

  const handlePrev = () => {
    if (activeStep > 0) scrollToStep(activeStep - 1)
  }

  const handleNext = () => {
    if (activeStep < STEPS.length - 1) scrollToStep(activeStep + 1)
  }

  if (reduceMotion) {
    return (
      <section
        id="how"
        className="flex flex-col gap-8 rounded-[var(--radius-section)] bg-surface p-6 md:p-12"
      >
        <div className="flex flex-col gap-4">
          <p className="type-eyebrow inline-flex items-center gap-2 text-label-2">
            <span aria-hidden className="size-1.5 rounded-full bg-accent" /> How
            it works
          </p>
          <h2 className="type-display">
            Four steps. <span className="em-claim">Zero effort</span> after the
            first.
          </h2>
          <p className="type-callout max-w-[36ch] text-label-2">
            You do step one. SHAMAR does the rest, every month, for as long as
            you want it to.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {STEPS.map((s) => (
            <article
              key={s.n}
              className="flex flex-col justify-between gap-6 rounded-[var(--radius-card)] bg-surface-2 p-6 md:p-8"
            >
              <div className="flex flex-col gap-3">
                <p className="type-eyebrow text-accent-text">
                  {s.n} · {s.label}
                </p>
                <h3 className="type-title-2">{s.title}</h3>
                <p className="type-callout text-label-2">{s.body}</p>
              </div>
              <div>{s.art}</div>
            </article>
          ))}
        </div>
      </section>
    )
  }

  return (
    <>
      {/* DESKTOP: Native CSS Sticky + Framer Motion Spring Container */}
      <div
        ref={containerRef}
        id="how"
        className="relative hidden md:block h-[340vh]"
      >
        <div className="sticky top-4 flex h-[calc(100vh-32px)] flex-col justify-between overflow-hidden rounded-[var(--radius-section)] bg-surface border border-separator/40 p-6 md:p-8 shadow-[var(--shadow-card)]">
          {/* Ambient drifting decorative glow orbs */}
          <motion.div
            aria-hidden
            style={{ x: orbX }}
            className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-accent/[0.04] blur-3xl"
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -left-24 -bottom-24 size-96 rounded-full bg-black/[0.02] blur-3xl"
          />

          {/* Top Control Bar: Eyebrow, Step Navigation Tabs, Progress, and Arrows */}
          <div className="relative z-10 flex items-center justify-between border-b border-separator/50 pb-5">
            <div className="flex items-center gap-6">
              <p className="type-eyebrow inline-flex items-center gap-2 text-label font-semibold">
                <span
                  aria-hidden
                  className="size-2 rounded-full bg-accent animate-pulse"
                />
                How it works
              </p>

              {/* Step indicator tabs: Clickable with smooth spring pill */}
              <div className="flex items-center gap-1.5 rounded-full bg-surface-2 p-1 ring-1 ring-black/[0.04]">
                {STEPS.map((s, idx) => {
                  const isActive = activeStep === idx
                  return (
                    <motion.button
                      key={s.n}
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => scrollToStep(idx)}
                      className={`relative min-h-[38px] px-3.5 py-1.5 rounded-full type-footnote font-semibold transition-all duration-300 ${
                        isActive
                          ? 'text-white'
                          : 'text-label-2 hover:text-label hover:bg-black/[0.02]'
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="activeStepIndicator"
                          className="absolute inset-0 rounded-full bg-accent shadow-sm"
                          transition={{
                            type: 'spring',
                            stiffness: 350,
                            damping: 30,
                          }}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-1.5">
                        <span
                          className={isActive ? 'opacity-80' : 'opacity-50'}
                        >
                          {s.n}
                        </span>
                        <span>{s.label}</span>
                      </span>
                    </motion.button>
                  )
                })}
              </div>
            </div>

            {/* Right: Step arrows and scroll indicator */}
            <div className="flex items-center gap-3">
              <span className="type-caption text-label-3">
                Scroll or click to advance
              </span>
              <div className="flex items-center gap-1">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={handlePrev}
                  disabled={activeStep === 0}
                  aria-label="Previous step"
                  className="touch-target flex size-9 items-center justify-center rounded-full border border-separator bg-surface text-label transition-colors hover:bg-surface-2 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    className="size-4"
                    aria-hidden
                  >
                    <path
                      d="M10 12L6 8L10 4"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </motion.button>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={handleNext}
                  disabled={activeStep === STEPS.length - 1}
                  aria-label="Next step"
                  className="touch-target flex size-9 items-center justify-center rounded-full border border-separator bg-surface text-label transition-colors hover:bg-surface-2 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    className="size-4"
                    aria-hidden
                  >
                    <path
                      d="M6 12L10 8L6 4"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </motion.button>
              </div>
            </div>
          </div>

          {/* Center Horizontal Stage Track */}
          <div className="relative my-auto w-full overflow-visible py-4">
            <motion.div
              ref={trackRef}
              style={{ x }}
              className="flex w-max items-center gap-8 pl-2 pr-12 will-change-transform"
            >
              {/* Lead Headline Column */}
              <div className="flex w-[26rem] shrink-0 flex-col justify-between gap-6 pr-4">
                <div className="flex flex-col gap-4">
                  <h2 className="type-display text-[2.75rem] font-[600] leading-[1.05] tracking-[-0.035em]">
                    Four steps.{' '}
                    <span className="em-claim text-accent-text">
                      Zero effort
                    </span>{' '}
                    after the first.
                  </h2>
                  <p className="type-callout text-label-2 text-[1.0625rem] leading-[1.5]">
                    You do step one. SHAMAR does the rest, every month, for as
                    long as you want it to.
                  </p>
                </div>

                <div className="flex items-center gap-3 text-label-3">
                  <div className="size-2 rounded-full bg-accent animate-ping" />
                  <p className="type-caption font-medium">
                    Fully autonomous · Revoke permission any time
                  </p>
                </div>
              </div>

              {/* Step Cards with 3D Depth, Scaling & Focus Elevation */}
              {STEPS.map((s, idx) => {
                const isFocus = activeStep === idx
                return (
                  <motion.article
                    key={s.n}
                    whileHover={{ y: -6, scale: isFocus ? 1.015 : 0.98 }}
                    animate={{
                      scale: isFocus ? 1 : 0.95,
                      opacity: isFocus ? 1 : 0.72,
                    }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className={`relative flex h-[31.5rem] w-[28.5rem] shrink-0 flex-col justify-between overflow-hidden rounded-[var(--radius-card)] bg-surface-2 p-7 transition-all duration-300 ${
                      isFocus
                        ? 'shadow-[0_16px_40px_-12px_rgba(217,0,18,0.12)] ring-2 ring-accent/30 bg-surface'
                        : 'shadow-sm ring-1 ring-black/[0.04]'
                    }`}
                  >
                    {/* Watermark Step Number with Parallax */}
                    <motion.span
                      aria-hidden
                      style={{ x: watermarkX }}
                      className="pointer-events-none absolute -right-2 -top-5 select-none text-[8.5rem] font-[700] leading-none tracking-[-0.06em] text-label/[0.04]"
                    >
                      {s.n}
                    </motion.span>

                    <div className="relative z-10 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <p className="type-eyebrow font-semibold text-accent-text">
                          {s.n} · {s.label}
                        </p>
                        {isFocus && (
                          <motion.span
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="type-caption flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 font-semibold text-accent-text"
                          >
                            <span className="size-1.5 rounded-full bg-accent animate-pulse" />{' '}
                            Active stage
                          </motion.span>
                        )}
                      </div>
                      <h3 className="type-title-2 font-[600] text-label tracking-[-0.02em]">
                        {s.title}
                      </h3>
                      <p className="type-callout text-label-2 leading-relaxed">
                        {s.body}
                      </p>
                    </div>

                    <div className="relative z-10 mt-3">{s.art}</div>
                  </motion.article>
                )
              })}
            </motion.div>
          </div>

          {/* Bottom Progress Bar: Continuous Feedback */}
          <div className="relative z-10 flex items-center justify-between pt-4 border-t border-separator/40">
            <div className="flex items-center gap-3">
              <span className="type-caption font-semibold tabular text-label">
                Step {activeStep + 1} of {STEPS.length}
              </span>
              <span className="type-caption text-label-3">·</span>
              <span className="type-caption text-label-2 font-medium">
                {STEPS[activeStep].title}
              </span>
            </div>

            {/* Smooth Progress Track */}
            <div className="h-2 w-48 overflow-hidden rounded-full bg-surface-2 ring-1 ring-black/[0.06]">
              <motion.div
                className="h-full bg-accent rounded-full shadow-[0_0_8px_var(--color-accent)]"
                style={{ scaleX: smoothProgress, transformOrigin: '0%' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE: Clean Interactive Swipeable Carousel with Snap & Step Switcher */}
      <section className="block md:hidden rounded-[var(--radius-section)] bg-surface border border-separator/40 p-5 shadow-sm">
        <div className="flex flex-col gap-3 pb-5 border-b border-separator/50">
          <p className="type-eyebrow inline-flex items-center gap-2 text-label font-semibold">
            <span aria-hidden className="size-1.5 rounded-full bg-accent" /> How
            it works
          </p>
          <h2 className="type-display text-[2rem] font-[600] leading-tight">
            Four steps.{' '}
            <span className="em-claim text-accent-text">Zero effort</span> after
            the first.
          </h2>
          <p className="type-callout text-label-2">
            You do step one. SHAMAR does the rest, every month, for as long as
            you want it to.
          </p>

          {/* Step Pill Selectors */}
          <div className="grid grid-cols-4 gap-1 pt-2">
            {STEPS.map((s, idx) => (
              <button
                key={s.n}
                type="button"
                onClick={() => setActiveStep(idx)}
                className={`flex min-h-[44px] flex-col items-center justify-center rounded-xl p-2 transition-all ${
                  activeStep === idx
                    ? 'bg-accent text-white shadow-xs font-semibold'
                    : 'bg-surface-2 text-label-2 hover:text-label'
                }`}
              >
                <span className="type-caption font-bold">{s.n}</span>
                <span className="type-caption text-[11px] truncate max-w-full">
                  {s.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Step Card on Mobile */}
        <div className="pt-5">
          <article className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-[var(--radius-card)] bg-surface-2 p-5 shadow-sm ring-1 ring-black/[0.04]">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-2 -top-4 select-none text-[6.5rem] font-[700] leading-none tracking-[-0.06em] text-label/[0.04]"
            >
              {STEPS[activeStep].n}
            </span>

            <div className="relative flex flex-col gap-2">
              <p className="type-eyebrow font-semibold text-accent-text">
                {STEPS[activeStep].n} · {STEPS[activeStep].label}
              </p>
              <h3 className="type-title-2 font-[600] text-label">
                {STEPS[activeStep].title}
              </h3>
              <p className="type-callout text-label-2">
                {STEPS[activeStep].body}
              </p>
            </div>

            <div className="relative pt-2">{STEPS[activeStep].art}</div>

            {/* Mobile Next / Prev buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-separator/40">
              <button
                type="button"
                onClick={handlePrev}
                disabled={activeStep === 0}
                className="type-footnote flex min-h-[44px] items-center gap-1 font-semibold text-label-2 hover:text-label disabled:opacity-30 disabled:pointer-events-none"
              >
                ← Previous
              </button>
              <span className="type-caption text-label-3">
                {activeStep + 1} of {STEPS.length}
              </span>
              <button
                type="button"
                onClick={handleNext}
                disabled={activeStep === STEPS.length - 1}
                className="type-footnote flex min-h-[44px] items-center gap-1 font-semibold text-accent-text hover:underline disabled:opacity-30 disabled:pointer-events-none"
              >
                Next →
              </button>
            </div>
          </article>
        </div>
      </section>
    </>
  )
}
