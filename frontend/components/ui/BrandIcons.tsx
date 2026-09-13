import React from 'react'

export function NetflixIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect width="32" height="32" rx="2" fill="#000000" />
      {/* Left ribbon */}
      <path d="M10 7h3.5v18H10z" fill="#B81D24" />
      {/* Right ribbon */}
      <path d="M18.5 7h3.5v18h-3.5z" fill="#B81D24" />
      {/* Diagonal ribbon */}
      <path d="M10 7h3.5l8.5 18h-3.5z" fill="#E50914" />
    </svg>
  )
}

export function FigmaIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect width="32" height="32" rx="2" fill="#1C1C1C" />
      <g transform="translate(9.25, 6) scale(0.25)">
        {/* Bottom-left green part */}
        <path d="M13.3333 80.0002C20.6933 80.0002 26.6667 74.0268 26.6667 66.6668V53.3335H13.3333C5.97333 53.3335 0 59.3068 0 66.6668C0 74.0268 5.97333 80.0002 13.3333 80.0002Z" fill="#0ACF83" />
        {/* Middle-left purple part */}
        <path d="M0 39.9998C0 32.6398 5.97333 26.6665 13.3333 26.6665H26.6667V53.3332H13.3333C5.97333 53.3332 0 47.3598 0 39.9998Z" fill="#A259FF" />
        {/* Top-left red part */}
        <path d="M0 13.3333C0 5.97333 5.97333 0 13.3333 0H26.6667V26.6667H13.3333C5.97333 26.6667 0 20.6933 0 13.3333Z" fill="#F24E1E" />
        {/* Top-right orange/red part */}
        <path d="M26.6667 0H40.0001C47.3601 0 53.3334 5.97333 53.3334 13.3333C53.3334 20.6933 47.3601 26.6667 40.0001 26.6667H26.6667V0Z" fill="#FF7262" />
        {/* Middle-right blue part */}
        <path d="M53.3334 39.9998C53.3334 47.3598 47.3601 53.3332 40.0001 53.3332C32.6401 53.3332 26.6667 47.3598 26.6667 39.9998C26.6667 32.6398 32.6401 26.6665 40.0001 26.6665C47.3601 26.6665 53.3334 32.6398 53.3334 39.9998Z" fill="#1ABCFE" />
      </g>
    </svg>
  )
}

export function NotionIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect width="32" height="32" rx="2" fill="#FAFAF8" />
      <path
        d="M8.5 7.5c.8.7 1.1.6 2.6.5l14.1-.8c.3 0 .3.4 0 .4l-2.3.3c-.4.1-.8.4-1 .8L9.4 25.2c-.1.3-.6.1-.6-.2V8.8c0-.6.3-1 .7-.7l-.9-.6H8.5zm3 2.1l8.3 12.3V11c0-.4-.2-.5-.5-.6l-2-.4c-.3 0-.3-.4 0-.4h5.6c.3 0 .3.4 0 .4l-1.5.4c-.3.1-.5.3-.5.7v13.5c0 .4-.5.5-.7.2l-9.7-14.4c-.2-.3.1-.7.4-.5l.6.8z"
        fill="#191919"
      />
    </svg>
  )
}

export function GitHubIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect width="32" height="32" rx="2" fill="#161B22" />
      <path
        d="M16 5.2C10.48 5.2 6 9.68 6 15.2c0 4.42 2.87 8.17 6.84 9.5.5.09.68-.22.68-.48 0-.23-.01-.86-.01-1.69-2.78.6-3.37-1.34-3.37-1.34-.45-1.15-1.11-1.46-1.11-1.46-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.64.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.95 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.56 9.56 0 0 1 16 10.84c.85 0 1.7.11 2.5.34 1.91-1.3 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.7-4.57 4.94.36.31.68.92.68 1.85 0 1.34-.01 2.41-.01 2.74 0 .27.18.58.69.48A10.02 10.02 0 0 0 26 15.2C26 9.68 21.52 5.2 16 5.2z"
        fill="white"
      />
    </svg>
  )
}

export function LoomIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect width="32" height="32" rx="2" fill="#5046E4" />
      <circle cx="16" cy="16" r="7" fill="none" stroke="white" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="3" fill="white" />
      <circle cx="16" cy="9" r="1.5" fill="white" />
      <circle cx="22.06" cy="12.5" r="1.5" fill="white" />
      <circle cx="22.06" cy="19.5" r="1.5" fill="white" />
      <circle cx="16" cy="23" r="1.5" fill="white" />
      <circle cx="9.94" cy="19.5" r="1.5" fill="white" />
      <circle cx="9.94" cy="12.5" r="1.5" fill="white" />
    </svg>
  )
}

export function YouTubeIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect width="32" height="32" rx="2" fill="#0D0D0D" />
      <path
        d="M25.4 11.2c-.2-.9-.9-1.6-1.8-1.8C22 9 16 9 16 9s-6 0-7.6.4c-.9.2-1.6.9-1.8 1.8C6.2 12.8 6.2 16 6.2 16s0 3.2.4 4.8c.2.9.9 1.6 1.8 1.8C10 23 16 23 16 23s6 0 7.6-.4c.9-.2 1.6-.9 1.8-1.8.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8z"
        fill="#FF0000"
      />
      <path d="M14.2 19l5-3-5-3v6z" fill="white" />
    </svg>
  )
}

export function SpotifyIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" style={{ width: '100%', height: '100%' }}>
      <rect width="32" height="32" rx="2" fill="#0D0D0D" />
      <circle cx="16" cy="16" r="9" fill="#1DB954" />
      <path
        d="M20.6 19.4c-.2.3-.6.4-.9.2-2.4-1.5-5.5-1.8-9.1-1-.4.1-.7-.1-.8-.5-.1-.4.1-.7.5-.8 4-.9 7.4-.5 10.1 1.1.3.2.4.6.2 1zm1.2-2.7c-.3.4-.7.5-1.1.3-2.8-1.7-7-2.2-10.2-1.2-.4.1-.9-.1-1-.5-.1-.4.1-.9.5-1 3.7-1.1 8.3-.6 11.5 1.4.4.2.5.7.3 1zm.1-2.8c-3.3-2-8.8-2.2-12-1.2-.5.2-1.1-.1-1.2-.6-.2-.5.1-1.1.6-1.2 3.7-1.1 9.7-.9 13.5 1.4.5.3.6.9.4 1.4-.3.4-.9.5-1.3.2z"
        fill="black"
      />
    </svg>
  )
}

export const brandIcons: Record<string, React.ReactNode> = {
  'Netflix': <NetflixIcon />,
  'Figma Pro': <FigmaIcon />,
  'Notion AI': <NotionIcon />,
  'GitHub Copilot': <GitHubIcon />,
  'Loom Pro': <LoomIcon />,
  'YouTube Premium': <YouTubeIcon />,
  'Spotify': <SpotifyIcon />,
}
