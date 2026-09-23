'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import BrandLogo from '@/components/ui/BrandLogo'

function Row({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-3 rounded-[12px] bg-surface px-3 py-2.5">{children}</div>
}

function ConnectArt() {
  return (
    <div className="flex flex-col gap-2">
      <Row>
        <BrandLogo name="gmail" size={36} />
        <div className="flex-1">
          <p className="type-footnote font-semibold">Gmail</p>
          <p className="type-caption text-label-3">Read-only. Receipts only.</p>
        </div>
        <span className="type-caption rounded-full bg-accent px-2.5 py-1 text-on-accent">Connected</span>
      </Row>
      <Row>
        <BrandLogo name="telegram" size={36} />
        <div className="flex-1">
          <p className="type-footnote font-semibold">Telegram</p>
          <p className="type-caption text-label-3">Where it asks you</p>
        </div>
        <span className="type-caption rounded-full bg-accent px-2.5 py-1 text-on-accent">Connected</span>
      </Row>
    </div>
  )
}

function FindArt() {
  const rows = [
    { brand: 'netflix' as const, name: 'Netflix', price: '$15.49', when: 'Renews 4 Oct' },
    { brand: 'claude' as const, name: 'Claude Pro', price: '$20.00', when: 'Renews 9 Oct' },
    { brand: 'duolingo' as const, name: 'Duolingo Super', price: '$12.99', when: 'Renews 11 Oct' },
  ]
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <Row key={r.name}>
          <BrandLogo name={r.brand} size={36} />
          <div className="flex-1">
            <p className="type-footnote font-semibold">{r.name}</p>
            <p className="type-caption text-label-3">{r.when}</p>
          </div>
          <span className="type-footnote tabular font-semibold">{r.price}</span>
        </Row>
      ))}
    </div>
  )
}

function WeighArt() {
  return (
    <div className="flex flex-col gap-3 rounded-[12px] bg-surface p-4">
      <div className="flex items-center gap-3">
        <BrandLogo name="figma" size={36} />
        <p className="type-footnote flex-1 font-semibold">Figma Professional</p>
        <span className="type-caption rounded-full bg-surface-2 px-2.5 py-1 text-label-2">$15 / mo</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        <li className="type-footnote flex items-center gap-2">
          <span aria-hidden className="size-1.5 rounded-full bg-accent" />
          Your design files would be deleted
        </li>
        <li className="type-footnote flex items-center gap-2">
          <span aria-hidden className="size-1.5 rounded-full bg-accent" />
          Other people use this plan with you
        </li>
      </ul>
      <p className="type-footnote rounded-[10px] bg-accent-soft px-3 py-2 font-semibold text-accent-text">
        Too much to lose. SHAMAR reminds you instead.
      </p>
    </div>
  )
}

function AskArt() {
  return (
    <div className="flex flex-col gap-3 rounded-[12px] bg-inverse p-4 text-on-inverse">
      <div className="flex items-center gap-2">
        <BrandLogo name="telegram" size={24} />
        <span className="type-caption text-on-inverse/60">SHAMAR · now</span>
      </div>
      <p className="type-footnote">
        <strong>Duolingo Super</strong> renews in 2 days for $12.99. Keep it?
      </p>
      <div className="grid grid-cols-2 gap-2">
        <span className="type-footnote flex min-h-[40px] items-center justify-center rounded-full bg-accent font-semibold">
          Cancel it
        </span>
        <span className="type-footnote flex min-h-[40px] items-center justify-center rounded-full bg-white/10 font-semibold">
          Keep it
        </span>
      </div>
      <p className="type-caption text-on-inverse/60">No answer? It cancels 36 hours before you&rsquo;re charged.</p>
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

// The pinned row layout is pure CSS (md:motion-safe:), never React state: ScrollTrigger
// measures the section when it pins, so the layout must already be final by then.
export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    let revert: (() => void) | undefined
    ;(async () => {
      const gsap = (await import('gsap')).default
      const { ScrollTrigger } = await import('gsap/ScrollTrigger')
      if (cancelled) return
      gsap.registerPlugin(ScrollTrigger)
      const mm = gsap.matchMedia()
      mm.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () => {
        const section = sectionRef.current
        const track = trackRef.current
        if (!section || !track) return
        const distance = () => Math.max(0, track.scrollWidth - section.clientWidth)
        gsap.to(track, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top 16px',
            end: () => `+=${distance()}`,
            scrub: 0.6,
            pin: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        })
      })
      revert = () => mm.revert()
    })()
    return () => {
      cancelled = true
      revert?.()
    }
  }, [])

  return (
    <section
      id="how"
      ref={sectionRef}
      className={`relative z-10 overflow-hidden rounded-[var(--radius-section)] bg-surface md:motion-safe:h-[calc(100svh-32px)]`}
    >
      <div
        ref={trackRef}
        className={`flex flex-col gap-4 p-6 md:grid md:grid-cols-2 md:p-10 md:motion-safe:flex md:motion-safe:h-full md:motion-safe:w-max md:motion-safe:flex-row md:motion-safe:items-center`}
      >
        <div className={`flex flex-col justify-between gap-6 md:col-span-2 md:motion-safe:w-[26rem] md:motion-safe:shrink-0 md:motion-safe:self-stretch md:motion-safe:pr-8`}>
          <div className="flex flex-col gap-5">
            <p className="type-eyebrow inline-flex items-center gap-2 text-label-2">
              <span aria-hidden className="size-1.5 rounded-full bg-accent" /> How it works
            </p>
            <h2 className="type-display">
              Four steps. <span className="em-claim">Zero effort</span> after the first.
            </h2>
            <p className="type-callout max-w-[32ch] text-label-2">
              You do step one. SHAMAR does the rest, every month, for as long as you want it to.
            </p>
          </div>
          <p className={`type-footnote hidden text-label-3 md:motion-safe:block`}>Keep scrolling</p>
        </div>

        {STEPS.map((s) => (
          <article
            key={s.n}
            className={`relative flex flex-col gap-10 overflow-hidden rounded-[var(--radius-card)] bg-surface-2 p-6 md:p-8 md:motion-safe:h-[28rem] md:motion-safe:w-[27rem] md:motion-safe:shrink-0 md:motion-safe:justify-between`}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -right-2 -top-6 select-none text-[8rem] font-[650] leading-none tracking-[-0.06em] text-label/[0.05]"
            >
              {s.n}
            </span>
            <div className="relative flex flex-col gap-3">
              <p className="type-eyebrow text-accent-text">
                {s.n} · {s.label}
              </p>
              <h3 className="type-title-2">{s.title}</h3>
              <p className="type-callout text-label-2">{s.body}</p>
            </div>
            <div className="relative">{s.art}</div>
          </article>
        ))}
      </div>
    </section>
  )
}
