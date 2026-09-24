'use client'

import {
  PrivyProvider as Privy,
  type PrivyClientConfig,
} from '@privy-io/react-auth'
import { base, mainnet } from 'viem/chains'

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? ''

// Privy throws on an absent or placeholder app id, and because it wraps the
// whole tree that takes down pages which never needed login. Routes that read
// their user from the URL keep working without it.
const configured =
  /^[a-z0-9]{20,}$/i.test(PRIVY_APP_ID) && !PRIVY_APP_ID.startsWith('cm000')

const getPrivyConfig = (): PrivyClientConfig => ({
  appearance: {
    theme: 'light',
    accentColor: '#E50914',
    logo: undefined,
    walletList: ['metamask', 'coinbase_wallet', 'rainbow', 'wallet_connect'],
  },
  defaultChain: base,
  supportedChains: [base, mainnet],
  loginMethods: ['wallet', 'email', 'google'],
  embeddedWallets: {
    createOnLogin: 'users-without-wallets',
  },
})

export default function PrivyProvider({
  children,
}: {
  children: React.ReactNode
}) {
  if (!configured) return <>{children}</>
  return (
    <Privy appId={PRIVY_APP_ID} config={getPrivyConfig()}>
      {children}
    </Privy>
  )
}
