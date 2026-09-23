// Etherscan V2 unified API — one key works across all chains via `chainid`.
// Base = 8453.
const ETHERSCAN_API = 'https://api.etherscan.io/v2/api'
const BASE_CHAIN_ID = '8453'

type ExplorerTx = {
  hash: string
  from: string
  to: string
  value: string
  timeStamp: string
  isError: string
}

type ExplorerTokenTx = {
  hash: string
  from: string
  to: string
  value: string
  timeStamp: string
  tokenSymbol: string
  tokenName: string
  tokenDecimal: string
  contractAddress: string
}

export type WalletPattern = {
  toAddress: string
  merchantName: string
  txCount: number
  avgAmount: number
  currency: string
  cadence: 'weekly' | 'monthly' | 'yearly'
  confidence: number
  lastCharged: string
}

// Known token contracts on Base mainnet (lowercase)
const KNOWN_CONTRACTS: Record<string, string> = {
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'USDC',
  '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca': 'USDbC',
  '0x50c5725949a6f0c72e6c4a641f24049a917db0cb': 'DAI',
  '0x4200000000000000000000000000000000000006': 'WETH',
}

// DEX routers, bridges, and other non-subscription contracts to skip
const SKIP_ADDRESSES = new Set([
  '0xe592427a0aece92de3edee1f18e0157c05861564',
  '0x1111111254eeb25477b68fb85ed929f73a960582',
  '0x0000000000000000000000000000000000000000',
])

const STABLECOINS = new Set(['USDC', 'USDbC', 'USDT', 'DAI'])

function merchantName(address: string, tokenSymbol?: string): string {
  const lower = address.toLowerCase()
  if (KNOWN_CONTRACTS[lower]) return `${KNOWN_CONTRACTS[lower]} Payment`
  return `Service ${address.slice(0, 6)}…${address.slice(-4)}`
}

function cadenceFromIntervals(intervals: number[]): 'weekly' | 'monthly' | 'yearly' | null {
  if (intervals.length === 0) return null
  const sorted = [...intervals].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  if (median >= 5 && median <= 9) return 'weekly'
  if (median >= 25 && median <= 40) return 'monthly'
  if (median >= 330 && median <= 400) return 'yearly'
  return null
}

function cv(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  if (mean === 0) return 0
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance) / mean
}

function confidence(txCount: number, amountCV: number, intervalCV: number): number {
  let score = txCount >= 5 ? 75 : txCount >= 4 ? 65 : txCount >= 3 ? 55 : 40
  if (amountCV < 0.05) score += 10
  if (intervalCV < 0.2) score += 10
  return Math.min(score, 95)
}

async function etherscanFetch(params: Record<string, string>): Promise<unknown[]> {
  const apiKey = process.env.ETHERSCAN_API_KEY ?? ''
  const query = new URLSearchParams({
    chainid: BASE_CHAIN_ID,
    ...params,
    ...(apiKey ? { apikey: apiKey } : {}),
  })
  const res = await fetch(`${ETHERSCAN_API}?${query}`, { signal: AbortSignal.timeout(10_000) })
  const data = (await res.json()) as { status: string; result: unknown[] }
  if (data.status !== '1' || !Array.isArray(data.result)) return []
  return data.result
}

export async function detectWalletSubscriptions(walletAddress: string): Promise<WalletPattern[]> {
  const address = walletAddress.toLowerCase()

  const [nativeTxs, tokenTxs] = await Promise.all([
    etherscanFetch({
      module: 'account',
      action: 'txlist',
      address,
      startblock: '0',
      endblock: '99999999',
      page: '1',
      offset: '500',
      sort: 'asc',
    }) as Promise<ExplorerTx[]>,
    etherscanFetch({
      module: 'account',
      action: 'tokentx',
      address,
      page: '1',
      offset: '500',
      sort: 'asc',
    }) as Promise<ExplorerTokenTx[]>,
  ])

  const patterns: WalletPattern[] = []

  // Native ETH — group outgoing by recipient
  const nativeByRecipient = new Map<string, ExplorerTx[]>()
  for (const tx of nativeTxs) {
    if (tx.from.toLowerCase() !== address) continue
    if (tx.isError !== '0') continue
    if (BigInt(tx.value) === BigInt(0)) continue
    const to = tx.to.toLowerCase()
    if (SKIP_ADDRESSES.has(to)) continue
    if (!nativeByRecipient.has(to)) nativeByRecipient.set(to, [])
    nativeByRecipient.get(to)!.push(tx)
  }

  for (const [toAddr, group] of nativeByRecipient.entries()) {
    if (group.length < 2) continue
    const sorted = group.sort((a, b) => Number(a.timeStamp) - Number(b.timeStamp))
    const days = sorted.map((tx) => Math.floor(Number(tx.timeStamp) / 86400))
    const amounts = sorted.map((tx) => Number(BigInt(tx.value)) / 1e18)
    const intervals = days.slice(1).map((d, i) => d - days[i])

    const cadence = cadenceFromIntervals(intervals)
    if (!cadence) continue

    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length
    patterns.push({
      toAddress: toAddr,
      merchantName: merchantName(toAddr),
      txCount: group.length,
      avgAmount: parseFloat(avgAmount.toFixed(4)),
      currency: 'ETH',
      cadence,
      confidence: confidence(group.length, cv(amounts), cv(intervals)),
      lastCharged: new Date(Number(sorted.at(-1)!.timeStamp) * 1000).toISOString(),
    })
  }

  // ERC20 tokens — group outgoing by (recipient, contract)
  const tokenByKey = new Map<string, ExplorerTokenTx[]>()
  for (const tx of tokenTxs) {
    if (tx.from.toLowerCase() !== address) continue
    const to = tx.to.toLowerCase()
    if (SKIP_ADDRESSES.has(to)) continue
    const key = `${to}:${tx.contractAddress.toLowerCase()}`
    if (!tokenByKey.has(key)) tokenByKey.set(key, [])
    tokenByKey.get(key)!.push(tx)
  }

  for (const [key, group] of tokenByKey.entries()) {
    if (group.length < 2) continue
    const [toAddr] = key.split(':')
    const sorted = group.sort((a, b) => Number(a.timeStamp) - Number(b.timeStamp))
    const decimals = Number(sorted[0].tokenDecimal ?? '18')
    const days = sorted.map((tx) => Math.floor(Number(tx.timeStamp) / 86400))
    const amounts = sorted.map((tx) => Number(BigInt(tx.value)) / 10 ** decimals)
    const intervals = days.slice(1).map((d, i) => d - days[i])

    const cadence = cadenceFromIntervals(intervals)
    if (!cadence) continue

    const tokenSymbol = sorted[0].tokenSymbol
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const isStable = STABLECOINS.has(tokenSymbol)

    patterns.push({
      toAddress: toAddr,
      merchantName: merchantName(toAddr, tokenSymbol),
      txCount: group.length,
      avgAmount: parseFloat(avgAmount.toFixed(isStable ? 2 : 4)),
      currency: isStable ? 'USD' : tokenSymbol,
      cadence,
      confidence: confidence(group.length, cv(amounts), cv(intervals)),
      lastCharged: new Date(Number(sorted.at(-1)!.timeStamp) * 1000).toISOString(),
    })
  }

  return patterns.sort((a, b) => b.confidence - a.confidence)
}
