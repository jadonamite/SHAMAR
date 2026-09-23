/**
 * SHAMAR Design System Tokens
 * Aligned with Apple Human Interface Guidelines:
 * - 44px minimum touch targets
 * - Light and dark color palettes
 * - Explicit typography and spacing scale
 * - Reduced motion support
 */

export const typography = {
  fontFamilies: {
    display: 'var(--font-sans), -apple-system, BlinkMacSystemFont, sans-serif',
    body: 'var(--font-sans), -apple-system, BlinkMacSystemFont, sans-serif',
    mono: 'var(--font-mono), SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  scale: {
    display: {
      fontSize: '2.5rem',
      lineHeight: '1.15',
      letterSpacing: '-0.03em',
      fontWeight: '700',
    },
    title1: {
      fontSize: '2rem',
      lineHeight: '1.2',
      letterSpacing: '-0.025em',
      fontWeight: '700',
    },
    title2: {
      fontSize: '1.5rem',
      lineHeight: '1.25',
      letterSpacing: '-0.02em',
      fontWeight: '600',
    },
    title3: {
      fontSize: '1.25rem',
      lineHeight: '1.3',
      letterSpacing: '-0.015em',
      fontWeight: '600',
    },
    headline: {
      fontSize: '1rem',
      lineHeight: '1.4',
      letterSpacing: '-0.01em',
      fontWeight: '600',
    },
    body: {
      fontSize: '0.875rem',
      lineHeight: '1.5',
      letterSpacing: '0',
      fontWeight: '400',
    },
    callout: {
      fontSize: '0.8125rem',
      lineHeight: '1.45',
      letterSpacing: '0.01em',
      fontWeight: '400',
    },
    subheadline: {
      fontSize: '0.75rem',
      lineHeight: '1.4',
      letterSpacing: '0.02em',
      fontWeight: '500',
    },
    footnote: {
      fontSize: '0.6875rem',
      lineHeight: '1.35',
      letterSpacing: '0.04em',
      fontWeight: '400',
    },
    caption: {
      fontSize: '0.625rem',
      lineHeight: '1.3',
      letterSpacing: '0.08em',
      fontWeight: '500',
    },
    mono: {
      fontSize: '0.8125rem',
      lineHeight: '1.5',
      letterSpacing: '0',
      fontWeight: '400',
    },
  },
} as const

export const spacing = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
} as const

export const touchTarget = {
  minWidth: '44px',
  minHeight: '44px',
} as const

export const radii = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const

export const motion = {
  duration: {
    instant: '50ms',
    fast: '150ms',
    normal: '250ms',
    slow: '400ms',
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0.0, 0, 1)',
    decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',
  },
} as const
