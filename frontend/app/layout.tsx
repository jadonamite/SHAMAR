import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Archivo } from 'next/font/google'
import PrivyProvider from '@/components/providers/PrivyProvider'
import MiniPayProvider from '@/components/providers/MiniPayProvider'
import ToastProvider from '@/components/providers/ToastProvider'
import CookieBanner from '@/components/ui/CookieBanner'
import './globals.css'

// Switzer by Indian Type Foundry, ITF Free Font License (app/fonts/Switzer-LICENSE.txt).
const switzer = localFont({
  src: [
    {
      path: './fonts/Switzer-Variable.woff2',
      weight: '100 900',
      style: 'normal',
    },
    {
      path: './fonts/Switzer-VariableItalic.woff2',
      weight: '100 900',
      style: 'italic',
    },
  ],
  variable: '--font-switzer',
  display: 'swap',
})

// The wordmark face. Downloaded at build time and served from our own domain.
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-wordmark',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://shamar.namite.xyz'),
  title: 'SHAMAR: an agent you can hand a recurring bill to',
  description:
    'SHAMAR reads your receipts, works out what cancelling would cost you, asks before every renewal and acts when you stay silent. It checks a grant you hold on Base before it does anything.',
  openGraph: {
    title: 'SHAMAR: an agent you can hand a recurring bill to',
    description: 'It decides what cancelling costs, not just what it saves.',
    siteName: 'SHAMAR',
    images: [
      {
        url: '/brand/shamar-mark-512.png',
        width: 512,
        height: 349,
        alt: 'The SHAMAR mark',
      },
    ],
  },
  other: {
    'talentapp:project_verification':
      '3f57bed226531808843f4c9458e0e03c0ca059a04690041d4011d56cbdb56c79b0edcbac725b4838e9c763ae4e4fbfda474a516ccaebe42395f9ff1aa6de8eec',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${switzer.variable} ${archivo.variable}`}
    >
      <body className="antialiased">
        <>
          <PrivyProvider>
            <MiniPayProvider>
              <ToastProvider>
                {children}
                <CookieBanner />
              </ToastProvider>
            </MiniPayProvider>
          </PrivyProvider>
        </>
      </body>
    </html>
  )
}
