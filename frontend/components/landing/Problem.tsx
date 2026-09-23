'use client'

import { motion, useInView, useReducedMotion } from 'framer-motion'
import { useRef } from 'react'
import BrandLogo, { type BrandName } from '@/components/ui/BrandLogo'
import { Card } from '@/components/landing/primitives'

const LINES: Array<{ brand: BrandName; text: string; price: string }> = [
  { brand: 'netflix', text: 'The Netflix you haven’t opened since the finale.', price: '$15.49/mo' },
  { brand: 'figma', text: 'Figma Professional, from that one project in March.', price: '$15/mo' },
  { brand: 'duolingo', text: 'Duolingo Super. The streak ended in week two.', price: '$12.99/mo' },
  { brand: 'chatgpt', text: 'ChatGPT Plus, still billing next to Claude Pro.', price: '$20/mo' },
]

function StrikeLine({ brand, text, price, delay }: { brand: BrandName; text: string; price: string; delay: number }) {
  const ref = useRef(null)
  const reduce = useReducedMotion()
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const show = reduce || inView
  return (
    <motion.li
      ref={ref}
      initial={reduce ? false : { opacity: 0, x: -24 }}
      animate={show ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex items-center gap-5 border-b border-separator py-5 last:border-0"
    >
      <BrandLogo name={brand} size={48} />
      <span className="type-callout flex-1 text-label md:text-[1.25rem] md:tracking-[-0.01em]">{text}</span>
      <span className="relative shrink-0">
        <span className="type-callout tabular text-label-2 md:text-[1.0625rem]">{price}</span>
        <motion.span
          initial={reduce ? false : { scaleX: 0 }}
          animate={show ? { scaleX: 1 } : {}}
          transition={{ duration: 0.4, delay: delay + 0.35, ease: 'easeOut' }}
          className="absolute inset-x-0 top-1/2 h-[2px] origin-left -translate-y-1/2 bg-accent"
        />
      </span>
    </motion.li>
  )
}

export default function Problem() {
  return (
    <Card as="section" className="grid gap-8 rounded-[var(--radius-section)] px-6 py-12 md:grid-cols-[1fr_1.3fr] md:items-center md:gap-16 md:px-14 md:py-20">
      <div className="flex flex-col gap-5">
        <p className="type-eyebrow inline-flex items-center gap-2 text-label-2">
          <span aria-hidden className="size-1.5 rounded-full bg-accent" /> Sound familiar?
        </p>
        <h2 className="type-display max-w-[14ch]">
          Signing up takes a tap. <span className="em-claim">Cancelling takes a Saturday.</span>
        </h2>
        <p className="type-callout max-w-[36ch] text-label-2 md:text-[1.0625rem]">
          Logins you&rsquo;ve forgotten, retention offers, &ldquo;are you sure?&rdquo; screens. So the charges quietly
          keep coming. SHAMAR is the friend who actually gets round to it.
        </p>
      </div>
      <ul className="flex flex-col">
        {LINES.map((l, i) => (
          <StrikeLine key={l.brand} {...l} delay={i * 0.12} />
        ))}
      </ul>
    </Card>
  )
}
