import { createHash, randomUUID } from 'node:crypto'
import { privateKeyToAccount } from 'viem/accounts'
import { createPublicClient, http, keccak256, toBytes } from 'viem'
import { celo } from 'viem/chains'

const AGENT_PRIVATE_KEY = (process.env.AGENT_PRIVATE_KEY ?? '') as `0x${string}`
const AGENT_ADDRESS     = process.env.AGENT_ADDRESS ?? '0x0000000000000000000000000000000000000000'
const POLICY_CONTRACT   = (process.env.SAM_POLICY_CONTRACT ?? '') as `0x${string}`

const account = AGENT_PRIVATE_KEY
  ? privateKeyToAccount(AGENT_PRIVATE_KEY)
  : null

const publicClient = createPublicClient({
  chain: celo,
  transport: http('https://forno.celo.org'),
})

const SAM_POLICY_ABI = [
  {
    name: 'isAuthorized',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user',  type: 'address' },
      { name: 'agent', type: 'address' },
      { name: 'scope', type: 'bytes32' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

// Scope hashes — must match keccak256 values in SAMPolicy.sol
export const SCOPES = {
  CANCEL:  keccak256(toBytes('sam.cancel'))  as `0x${string}`,
  PAUSE:   keccak256(toBytes('sam.pause'))   as `0x${string}`,
  REMIND:  keccak256(toBytes('sam.remind'))  as `0x${string}`,
  ANALYZE: keccak256(toBytes('sam.analyze')) as `0x${string}`,
} as const

export type AttestationPayload = {
  action_id: string
  subscription_id: string
  action_type: string
  user_privy_did: string
  timestamp: string
  agent: string
}

export function isAgentConfigured(): boolean {
  return !!AGENT_PRIVATE_KEY && AGENT_ADDRESS !== '0x0000000000000000000000000000000000000000'
}

export function getAgentAddress(): string {
  return AGENT_ADDRESS
}

export function getPolicyContract(): string {
  return POLICY_CONTRACT
}

export function buildAttestationId(subId: string, actionType: string, timestamp: string): string {
  return createHash('sha256')
    .update(`${subId}:${actionType}:${timestamp}`)
    .digest('hex')
    .slice(0, 32)
}

// EIP-191 personal_sign — verifiable on Celoscan and 8004scan
export async function signAttestation(payload: AttestationPayload): Promise<string> {
  if (!account) return 'unsigned:no_key'
  const canonical = JSON.stringify(payload, Object.keys(payload).sort())
  return account.signMessage({ message: canonical })
}

export async function buildAttestation(
  subscriptionId: string,
  actionType: string,
  userPrivyDid: string
): Promise<{ payload: AttestationPayload; signature: string }> {
  const timestamp = new Date().toISOString()
  const payload: AttestationPayload = {
    action_id:       randomUUID(),
    subscription_id: subscriptionId,
    action_type:     actionType,
    user_privy_did:  userPrivyDid,
    timestamp,
    agent:           AGENT_ADDRESS,
  }
  const signature = await signAttestation(payload)
  return { payload, signature }
}

// Check onchain SAMPolicy authorization. Falls back to false if contract not set.
// userWalletAddress is the user's EVM wallet (stored in users.wallet_address).
export async function checkOnchainAuthorization(
  userWalletAddress: string,
  scope: `0x${string}`
): Promise<boolean> {
  if (!POLICY_CONTRACT || !userWalletAddress) return false
  try {
    return await publicClient.readContract({
      address: POLICY_CONTRACT,
      abi: SAM_POLICY_ABI,
      functionName: 'isAuthorized',
      args: [
        userWalletAddress as `0x${string}`,
        AGENT_ADDRESS as `0x${string}`,
        scope,
      ],
    })
  } catch {
    return false
  }
}
