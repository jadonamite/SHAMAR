import type { Metadata } from 'next'
import { Syne, DM_Mono } from 'next/font/google'
import { GeistSans } from 'geist/font/sans'
import PrivyProvider from '@/components/providers/PrivyProvider'
import MiniPayProvider from '@/components/providers/MiniPayProvider'
import ToastProvider from '@/components/providers/ToastProvider'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['400', '600', '700', '800'],
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-dm-mono',
  weight: ['300', '400', '500'],
})

export const metadata: Metadata = {
  title: 'SAM — Subscription Agentic Manager',
  description:
    'An autonomous AI system that understands and manages your recurring financial commitments across Web2 and Web3.',
  openGraph: {
    title: 'SAM — Subscription Agentic Manager',
    description: 'Your subscriptions are bleeding you.',
    siteName: 'SAM by Ciphergon',
  },
 other: {
    "talentapp:project_verification":
  "3f57bed226531808843f4c9458e0e03c0ca059a04690041d4011d56cbdb56c79b0edcbac725b4838e9c763ae4e4fbfda474a516ccaebe42395f9ff1aa6de8eec",
  },

}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${dmMono.variable} ${GeistSans.variable}`}
    >
      <body className="bg-void text-white antialiased">
        <PrivyProvider>
          <MiniPayProvider>
            <ToastProvider>{children}</ToastProvider>
          </MiniPayProvider>
        </PrivyProvider>
      </body>
    </html>
  )
}
