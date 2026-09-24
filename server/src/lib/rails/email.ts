import { dispatchCancellation, type DispatchResult } from '../dispatch.js'
import type {
  ExecutionRail,
  RailCancelParams,
  RailControlParams,
  RailControlResult,
} from './types.js'

export class EmailRail implements ExecutionRail {
  readonly kind = 'email' as const
  // A sent cancellation email can't be taken back.
  readonly reversible = false

  async cancel(params: RailCancelParams): Promise<DispatchResult> {
    return dispatchCancellation({
      decision: params.decision,
      userPrivyDid: params.userPrivyDid,
      dbUserId: params.dbUserId,
      accountEmail: params.accountEmail,
      authorized: true,
      apply: params.apply,
    })
  }

  async pause(_params: RailControlParams): Promise<RailControlResult> {
    return {
      ok: false,
      status: 'not_supported',
      reason: 'Email rail does not support pause',
    }
  }

  async resume(_params: RailControlParams): Promise<RailControlResult> {
    return {
      ok: false,
      status: 'not_supported',
      reason: 'Email rail does not support resume',
    }
  }
}

export const emailRail = new EmailRail()
