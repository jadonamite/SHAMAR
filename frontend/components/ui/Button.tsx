'use client'

import { motion } from 'framer-motion'
import type { ButtonHTMLAttributes } from 'react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  // Apple HIG: All interactive targets have a minimum height of 44px
  const sizeClasses = {
    sm: 'min-h-[44px] px-4 py-2 text-xs',
    md: 'min-h-[44px] px-6 py-2.5 text-xs',
    lg: 'min-h-[48px] px-8 py-3 text-sm',
  }

  const variantClasses = {
    primary:
      'bg-accent text-on-accent hover:bg-accent-hover border-transparent shadow-xs',
    secondary:
      'bg-surface text-label hover:bg-surface-2 border-separator shadow-2xs',
    destructive:
      'bg-accent-soft text-accent hover:bg-accent/20 border-accent/30',
    ghost:
      'bg-transparent text-label-2 hover:text-label border-transparent hover:bg-surface-2',
  }

  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.01 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      disabled={disabled}
      className={`inline-flex items-center justify-center font-semibold uppercase tracking-wider cursor-pointer border rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      style={{
        fontFamily: 'var(--font-sans)',
        letterSpacing: '0.08em',
      }}
      {...(props as any)}
    >
      {children}
    </motion.button>
  )
}
