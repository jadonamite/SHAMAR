import type { DispatchResult } from '../dispatch.js'
import type {
  ExecutionRail,
  RailCancelParams,
  RailControlParams,
  RailControlResult,
} from './types.js'

const NOT_ACTIVE = 'The card tier is not active yet, so SHAMAR has not touched this card.'

// Placeholder until the agentcard.sh account exists. Refuses everything and says so,
// so a subscription moved to 'card' early is never reported as cancelled.
export class CardRail implements ExecutionRail {
  readonly kind = 'card' as const
  // Closing a card is final; pausing will be the reversible action.
  readonly reversible = false

  async cancel(params: RailCancelParams): Promise<DispatchResult> {
    return {
      subscription_id: params.decision.subscription_id,
      merchant: params.decision.merchant,
      status: 'blocked_by_rail',
      recipient: null,
      reason: NOT_ACTIVE,
      reversible: false,
    }
  }

  async pause(_params: RailControlParams): Promise<RailControlResult> {
    return { ok: false, status: 'blocked_by_rail', reason: NOT_ACTIVE }
  }

  async resume(_params: RailControlParams): Promise<RailControlResult> {
    return { ok: false, status: 'blocked_by_rail', reason: NOT_ACTIVE }
  }
}

export const cardRail = new CardRail()
