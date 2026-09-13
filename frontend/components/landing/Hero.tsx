'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Button from '@/components/ui/Button'
import NotificationCascade from '@/components/landing/NotificationCascade'
import { useMiniPay } from '@/components/providers/MiniPayProvider'

export default function Hero() {
  const { ready, authenticated, login } = usePrivy()
  const { isMiniPay, isAutoConnecting } = useMiniPay()
  const router = useRouter()
  const [entering, setEntering] = useState(false)

  useEffect(() => {
    if ((entering || isMiniPay) && authenticated) router.push('/dashboard')
  }, [entering, isMiniPay, authenticated, router])

  function handleCTA() {
    if (!ready || isMiniPay) return
    if (authenticated) router.push('/dashboard')
    else {
      setEntering(true)
      login()
    }
  }

  return (
    <section
      className="relative min-h-screen flex items-center overflow-hidden"
      style={{ backgroundColor: '#0D0D0D' }}
    >
      {/* Particle field — subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Red ambient glow top-right */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-20%',
          right: '-10%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(229,9,20,0.08) 0%, transparent 60%)',
          filter: 'blur(40px)',
        }}
      />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 lg:px-16 py-16 sm:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          className="mb-12 flex justify-center"
        >
          <Image
            src="/SAM.png"
            alt="SAM logo"
            width={140}
            height={140}
            priority
            className="rounded-lg"
          />
        </motion.div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-10 lg:gap-16">
          {/* Left — 60% */}
          <div className="flex-1">
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="uppercase text-muted mb-6"
              style={{
                fontFamily: 'var(--font-dm-mono)',
                fontSize: '11px',
                letterSpacing: '0.16em',
              }}
            >
              Ciphergon / SAM
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="text-white font-extrabold leading-none mb-6"
              style={{
                fontFamily: 'var(--font-syne)',
                fontSize: 'clamp(32px, 5.8vw, 90px)',
                letterSpacing: '-0.03em',
              }}
            >
              Your subscriptions
              <br />
              <span style={{ color: '#E50914' }}>are bleeding you.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-secondary mb-10"
              style={{
                fontFamily: 'var(--font-dm-mono)',
                fontSize: '14px',
                letterSpacing: '0.01em',
              }}
            >
              $2,847 lost to forgotten subscriptions last year. On average.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.55 }}
            >
              {isMiniPay ? (
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-[#E50914] border-t-transparent rounded-full animate-spin" />
                  <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
                    {isAutoConnecting ? 'Connecting MiniPay...' : 'Connected'}
                  </span>
                </div>
              ) : (
                <Button size="lg" onClick={handleCTA}>Connect &amp; Find Out</Button>
              )}
            </motion.div>
          </div>

          {/* Right — 40% */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
            className="w-full lg:w-auto lg:min-w-[400px]"
          >
            <NotificationCascade />
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <motion.div
          animate={{ scaleY: [0, 1, 0], y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: '1px',
            height: '32px',
            backgroundColor: '#E50914',
            transformOrigin: 'top',
          }}
        />
      </div>
    </section>
  )
}
