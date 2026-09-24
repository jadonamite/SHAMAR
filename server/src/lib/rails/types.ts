import type { Decision } from '../reasoning.js'
import type { DispatchResult } from '../dispatch.js'

export type RailKind = 'email' | 'card'

export interface RailCancelParams {
  decision: Decision
  userPrivyDid: string
  dbUserId: string
  accountEmail: string
  apply: boolean
}

export interface RailControlParams {
  decision: Decision
  userPrivyDid: string
  dbUserId: string
}

export interface RailControlResult {
  ok: boolean
  status: string
  reason?: string
}

export interface ExecutionRail {
  readonly kind: RailKind
  readonly reversible: boolean
  cancel(params: RailCancelParams): Promise<DispatchResult>
  pause(params: RailControlParams): Promise<RailControlResult>
  resume(params: RailControlParams): Promise<RailControlResult>
}
