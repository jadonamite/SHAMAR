'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

const pillars = [
  'Read-only Gmail access. SAM cannot send or delete.',
  'Every action requires your approval in Phase 1.',
  'All execution is logged, auditable, and reversible.',
]

function CheckLine({ text, delay }: { text: string; delay: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      animate={inView ? { opacity: 1 } : {}}
      transition={{ duration: 0.4, delay }}
      className="flex items-start gap-4 py-4"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
    >
      {/* Line-draw check */}
      <div className="shrink-0 mt-0.5">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <motion.path
            d="M3 9l4 4 8-8"
            stroke="#E50914"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={inView ? { pathLength: 1 } : {}}
            transition={{ duration: 0.5, delay: delay + 0.2, ease: 'easeOut' }}
          />
        </svg>
      </div>
      <motion.p
        initial={{ x: -12 }}
        animate={inView ? { x: 0 } : {}}
        transition={{ duration: 0.4, delay: delay + 0.1 }}
        className="text-secondary"
        style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '15px', lineHeight: '1.6' }}
      >
        {text}
      </motion.p>
    </motion.div>
  )
}

export default function TrustSection() {
  const sectionRef = useRef(null)
  const inView = useInView(sectionRef, { once: true, margin: '-80px' })

  return (
    <section
      ref={sectionRef}
      className="py-20 sm:py-32"
      style={{ backgroundColor: '#141414' }}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-16">
        <div className="flex flex-col lg:flex-row gap-10 sm:gap-16 lg:gap-24 items-start">
          {/* Left headline */}
          <div className="lg:w-1/2">
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4 }}
              className="text-muted uppercase mb-4"
              style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '10px', letterSpacing: '0.16em' }}
            >
              Trust model
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-white font-extrabold leading-tight"
              style={{
                fontFamily: 'var(--font-syne)',
                fontSize: 'clamp(32px, 4vw, 52px)',
                letterSpacing: '-0.03em',
              }}
            >
              "SAM acts
              <br />
              <span style={{ color: '#E50914' }}>when you say so."</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-secondary mt-6"
              style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '14px', maxWidth: '340px', lineHeight: '1.7' }}
            >
              Progressive trust. SAM starts with visibility and earns execution rights
              through performance — never the other way around.
            </motion.p>
          </div>

          {/* Right pillars */}
          <div className="flex-1">
            {pillars.map((text, i) => (
              <CheckLine key={text} text={text} delay={0.3 + i * 0.12} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
