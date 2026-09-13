'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import CountUp from 'react-countup'

const lines = [
  { text: "Netflix you haven't opened in 4 months.", price: '$15.99/mo' },
  { text: 'Figma Pro, even though you use the free tier.', price: '$15/mo' },
  { text: 'That productivity app from 2023.', price: '$8/mo' },
]

function StrikeoutLine({
  text,
  price,
  delay,
}: {
  text: string
  price: string
  delay: number
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -24 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex items-baseline gap-3 py-4"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
    >
      <span
        className="text-secondary"
        style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '15px' }}
      >
        {text}
      </span>
      <span className="relative inline-flex items-center shrink-0">
        <span
          className="text-secondary"
          style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '14px' }}
        >
          {price}
        </span>
        <motion.span
          initial={{ scaleX: 0 }}
          animate={inView ? { scaleX: 1 } : {}}
          transition={{ duration: 0.4, delay: delay + 0.3, ease: 'easeOut' }}
          className="absolute inset-x-0 top-1/2 -translate-y-1/2"
          style={{
            height: '1.5px',
            backgroundColor: '#E50914',
            transformOrigin: 'left',
          }}
        />
      </span>
    </motion.div>
  )
}

export default function Problem() {
  const sectionRef = useRef(null)
  const inView = useInView(sectionRef, { once: true, margin: '-80px' })

  return (
    <section
      ref={sectionRef}
      className="relative py-20 sm:py-32 overflow-hidden"
      style={{ backgroundColor: '#0D0D0D' }}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-16">
        <div className="flex flex-col lg:flex-row gap-10 sm:gap-16 lg:gap-24 items-start">
          {/* Large number */}
          <div className="shrink-0">
            <div
              className="font-extrabold leading-none select-none"
              style={{
                fontFamily: 'var(--font-dm-mono)',
                fontSize: 'clamp(80px, 16vw, 220px)',
                color: '#E50914',
                letterSpacing: '-0.04em',
                lineHeight: 1,
              }}
            >
              {inView ? (
                <CountUp start={0} end={273} duration={2} delay={0.2} prefix="$" />
              ) : (
                '$0'
              )}
            </div>
          </div>

          {/* Text side */}
          <div className="flex-1 pt-4 lg:pt-8">
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-white font-bold mb-8 leading-tight"
              style={{
                fontFamily: 'var(--font-syne)',
                fontSize: 'clamp(22px, 3vw, 34px)',
                letterSpacing: '-0.02em',
              }}
            >
              The average person pays for{' '}
              <span style={{ color: '#E50914' }}>12 subscriptions.</span>
              <br />
              Remembers 8.
            </motion.p>

            <div>
              {lines.map((line, i) => (
                <StrikeoutLine
                  key={line.price}
                  text={line.text}
                  price={line.price}
                  delay={0.4 + i * 0.15}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
