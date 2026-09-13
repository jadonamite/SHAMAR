'use client'

import { motion } from 'framer-motion'
import type { HTMLAttributes } from 'react'

interface ButtonProps extends HTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  ...props
}: ButtonProps) {
  const sizeClasses = {
    sm: 'px-5 py-2 text-sm',
    md: 'px-7 py-3 text-sm',
    lg: 'px-10 py-4 text-base',
  }

  const variantStyles =
    variant === 'primary'
      ? { backgroundColor: '#E50914', color: '#fff', border: 'none' }
      : {
          backgroundColor: 'transparent',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.15)',
        }

  return (
    <motion.button
      whileHover={{ scale: 1.02, filter: variant === 'primary' ? 'brightness(1.1)' : 'none' }}
      whileTap={{ scale: 0.98 }}
      className={`font-semibold uppercase tracking-wider cursor-pointer ${sizeClasses[size]} ${className}`}
      style={{
        ...variantStyles,
        fontFamily: 'var(--font-geist-sans)',
        letterSpacing: '0.08em',
        fontSize: size === 'sm' ? '11px' : size === 'lg' ? '13px' : '12px',
        borderRadius: '2px',
        transition: 'border-color 0.2s',
      }}
      {...(props as any)}
    >
      {children}
    </motion.button>
  )
}
