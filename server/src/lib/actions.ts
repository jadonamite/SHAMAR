import { sql } from './db.js'
import { buildAttestation, getAgentAddress } from './agent.js'

// Single path for recording an action. Builds a signed EIP-191 attestation and
// writes the audit row, so every action — whether approved by the user or fired
// by a policy — is attributable and verifiable. Used by recommendations accept,
// the policy engine, and POST /agent/attest.
export async function logAction(opts: {
  subscriptionId: string
  actionType: string
  triggeredBy: 'user' | 'policy'
  userPrivyDid: string
  reversible?: boolean
}) {
  const { subscriptionId, actionType, triggeredBy, userPrivyDid, reversible = true } = opts
  const { payload, signature } = await buildAttestation(subscriptionId, actionType, userPrivyDid)

  const [action] = await sql`
    INSERT INTO actions
      (subscription_id, type, triggered_by, executed_at, reversible, signature, agent_address, metadata)
    VALUES
      (${subscriptionId}, ${actionType}, ${triggeredBy}, NOW(), ${reversible},
       ${signature}, ${getAgentAddress()}, ${JSON.stringify(payload)})
    RETURNING id, signature, agent_address, executed_at
  `

  return { action, attestation: payload }
}
