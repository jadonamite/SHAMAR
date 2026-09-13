'use client'

import { useEffect, useRef } from 'react'

const steps = [
  {
    number: '01',
    label: 'CONNECT',
    desc: 'Gmail + wallet. 30 seconds. No manual entry.',
    detail: 'Read-only Gmail access. Your Privy wallet. Nothing more.',
  },
  {
    number: '02',
    label: 'DETECT',
    desc: 'SAM scans. Every subscription surfaced.',
    detail: 'Invoices, receipts, renewal notices, onchain recurring payments.',
  },
  {
    number: '03',
    label: 'ANALYZE',
    desc: 'Confidence scoring. Usage signals. Pattern recognition.',
    detail: '80% deterministic rules + AI for edge cases. No guessing.',
  },
  {
    number: '04',
    label: 'ACT',
    desc: 'Remind, pause, or cancel. You approve. SAM executes.',
    detail: 'Every action is logged, auditable, and reversible.',
  },
]

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let ctx: { revert: () => void } | null = null

    const init = async () => {
      const gsap = (await import('gsap')).default
      const { ScrollTrigger } = await import('gsap/ScrollTrigger')
      gsap.registerPlugin(ScrollTrigger)

      const section = sectionRef.current
      const track = trackRef.current
      if (!section || !track) return

      ctx = gsap.context(() => {
        const totalScroll = track.scrollWidth - window.innerWidth

        gsap.to(track, {
          x: -totalScroll,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: `+=${totalScroll}`,
            scrub: 1,
            pin: true,
            anticipatePin: 1,
          },
        })
      }, section)
    }

    init()
    return () => ctx?.revert()
  }, [])

  return (
    <section
      ref={sectionRef}
      className="overflow-hidden"
      style={{ backgroundColor: '#0D0D0D' }}
    >
      <div
        ref={trackRef}
        className="flex items-center"
        style={{
          width: 'max-content',
          height: '100vh',
          paddingLeft: 'clamp(20px, 8vw, 120px)',
          gap: 'clamp(24px, 5vw, 60px)',
        }}
      >
        {/* Intro label */}
        <div className="shrink-0" style={{ width: 'min(75vw, 360px)' }}>
          <p
            className="text-muted uppercase mb-4"
            style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '10px', letterSpacing: '0.16em' }}
          >
            The process
          </p>
          <h2
            className="text-white font-extrabold leading-tight"
            style={{
              fontFamily: 'var(--font-syne)',
              fontSize: 'clamp(32px, 4vw, 56px)',
              letterSpacing: '-0.03em',
            }}
          >
            Four steps.
            <br />
            <span style={{ color: '#E50914' }}>Zero friction.</span>
          </h2>
          <p
            className="text-secondary mt-4"
            style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '14px', maxWidth: '280px' }}
          >
            Scroll to walk through how SAM takes you from chaos to clarity.
          </p>
        </div>

        {/* Step cards */}
        {steps.map((step) => (
          <div
            key={step.number}
            className="shrink-0 relative"
            style={{
              width: 'min(75vw, 380px)',
              borderLeft: '2px solid #E50914',
              paddingLeft: '28px',
              paddingTop: '8px',
              paddingBottom: '8px',
            }}
          >
            <p
              className="font-bold select-none pointer-events-none"
              style={{
                fontFamily: 'var(--font-dm-mono)',
                fontSize: 'clamp(48px, 10vw, 120px)',
                color: 'rgba(255,255,255,0.04)',
                lineHeight: 1,
                letterSpacing: '-0.04em',
                position: 'absolute',
                top: '-20px',
                right: '-10px',
              }}
            >
              {step.number}
            </p>

            <p
              className="font-bold mb-3 relative z-10"
              style={{
                fontFamily: 'var(--font-dm-mono)',
                fontSize: '11px',
                letterSpacing: '0.18em',
                color: '#E50914',
              }}
            >
              {step.label}
            </p>

            <h3
              className="text-white font-bold mb-3 relative z-10 leading-tight"
              style={{
                fontFamily: 'var(--font-syne)',
                fontSize: 'clamp(18px, 2.2vw, 28px)',
                letterSpacing: '-0.02em',
              }}
            >
              {step.desc}
            </h3>

            <p
              className="text-secondary relative z-10"
              style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '13px', lineHeight: '1.6' }}
            >
              {step.detail}
            </p>
          </div>
        ))}

        {/* Trailing space */}
        <div className="shrink-0" style={{ width: 'clamp(20px, 8vw, 120px)' }} />
      </div>
    </section>
  )
}
