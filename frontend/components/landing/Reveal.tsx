'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

// Each landing section arrives as its own scene. Never wrap a pinned section in this:
// a transformed ancestor breaks ScrollTrigger's pin.
export default function Reveal({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion()
  if (reduce) return <>{children}</>
  return (
    <motion.div
      initial={{ opacity: 0, y: 48 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}
