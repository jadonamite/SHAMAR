;; sam-policy.clar
;; SAM Policy -- Stacks Clarity port of SAMPolicy.sol v2.0.0
;; ERC-8004-inspired programmable agent permissions
;; Chain: Stacks Mainnet  |  Clarity 3 (epoch 3 / Nakamoto)
;;
;; Each user grants an agent principal time-bounded, revocable execution scopes.
;; SAM's backend MUST pass (is-authorized ...) before any autonomous action.
;;
;; Scope IDs (uint) mirror the Solidity keccak256 scopes; human-readable labels
;; live in the on-chain scope registry.
;;   u1 = sam.cancel   u2 = sam.pause   u3 = sam.remind   u4 = sam.analyze
;;
;; Parity with SAMPolicy.sol v2.0.0:
;;   - expiry u0 = permanent; non-zero expiry must be a future stacks-block-height
;;   - on-chain scope registry with labels; authorize rejects unknown scopes
;;   - owner emergency pause -> is-authorized evaluates as denied while paused
;;   - two-step ownership transfer (transfer + accept)
;;   - batch authorize / revoke
;;   - grant-default-scopes (permanent) and grant-default-scopes-with-expiry
;;   - rich read-only getters (per-scope status, registry enumeration)
;;   - sam-agent is a decorative canonical reference (NOT enforced in authorize)

;; -- Version ------------------------------------------------------------------

(define-constant CONTRACT-VERSION "2.0.0")

;; -- Error codes --------------------------------------------------------------

(define-constant ERR-NOT-OWNER          (err u401))
(define-constant ERR-EXPIRED-ON-ARRIVAL (err u402))
(define-constant ERR-PAUSED             (err u403))
(define-constant ERR-UNKNOWN-SCOPE      (err u404))
(define-constant ERR-NOT-PENDING-OWNER  (err u405))
(define-constant ERR-SCOPE-EXISTS       (err u406))
(define-constant ERR-EMPTY-LIST         (err u407))
(define-constant ERR-REGISTRY-FULL      (err u408))

;; -- Scope ID constants -------------------------------------------------------

(define-constant SCOPE-CANCEL  u1)
(define-constant SCOPE-PAUSE   u2)
(define-constant SCOPE-REMIND  u3)
(define-constant SCOPE-ANALYZE u4)

;; -- State --------------------------------------------------------------------

(define-data-var contract-owner principal tx-sender)
(define-data-var pending-owner  (optional principal) none)
(define-data-var sam-agent      principal tx-sender)
(define-data-var paused         bool false)

;; user -> agent -> scope-id -> expiry stacks-block-height
;;   u0             = permanent (no expiry)
;;   any other uint = stacks-block-height at which permission expires (exclusive)
;;   absent (none)  = not granted
(define-map permissions
  { user: principal, agent: principal, scope: uint }
  uint
)

;; scope-id -> human-readable label
(define-map scope-registry uint (string-ascii 64))

;; enumerable list of registered scope ids
(define-data-var registered-scope-ids (list 50 uint) (list))

;; -- Registry bootstrap (runs at deploy) --------------------------------------

(map-set scope-registry SCOPE-CANCEL  "sam.cancel")
(map-set scope-registry SCOPE-PAUSE   "sam.pause")
(map-set scope-registry SCOPE-REMIND  "sam.remind")
(map-set scope-registry SCOPE-ANALYZE "sam.analyze")
(var-set registered-scope-ids (list SCOPE-CANCEL SCOPE-PAUSE SCOPE-REMIND SCOPE-ANALYZE))

;; -- Read-only ----------------------------------------------------------------

;; Whether `agent` may execute `scope` for `user` right now.
;; Returns false while the contract is paused.
(define-read-only (is-authorized (user principal) (agent principal) (scope uint))
  (if (var-get paused)
    false
    (match (map-get? permissions { user: user, agent: agent, scope: scope })
      expiry (if (is-eq expiry u0) true (< stacks-block-height expiry))
      false
    )
  )
)

;; Raw stored expiry: (some uint) = granted (u0 = permanent), none = not granted.
(define-read-only (get-permission (user principal) (agent principal) (scope uint))
  (map-get? permissions { user: user, agent: agent, scope: scope })
)

;; Full status of one scope for a (user, agent) pair.
(define-read-only (get-scope-status (user principal) (agent principal) (scope uint))
  (let ((stored (map-get? permissions { user: user, agent: agent, scope: scope })))
    {
      scope:   scope,
      label:   (default-to "" (map-get? scope-registry scope)),
      granted: (is-some stored),
      expiry:  (default-to u0 stored),
      active:  (is-authorized user agent scope),
    }
  )
)

;; Convenience: status of all 4 built-in scopes at once.
(define-read-only (get-all-default-scopes (user principal) (agent principal))
  {
    cancel:  (get-scope-status user agent SCOPE-CANCEL),
    pause:   (get-scope-status user agent SCOPE-PAUSE),
    remind:  (get-scope-status user agent SCOPE-REMIND),
    analyze: (get-scope-status user agent SCOPE-ANALYZE),
  }
)

(define-read-only (is-scope-registered (scope uint))
  (is-some (map-get? scope-registry scope))
)

(define-read-only (get-scope-label (scope uint))
  (map-get? scope-registry scope)
)

(define-read-only (get-registered-scopes)
  (var-get registered-scope-ids)
)

(define-read-only (get-registered-scope-count)
  (len (var-get registered-scope-ids))
)

(define-read-only (get-owner)        (var-get contract-owner))
(define-read-only (get-pending-owner) (var-get pending-owner))
(define-read-only (get-sam-agent)    (var-get sam-agent))
(define-read-only (is-paused)        (var-get paused))
(define-read-only (get-version)      CONTRACT-VERSION)

;; -- Internal helpers ---------------------------------------------------------

;; fold accumulator: agent + expiry to apply; ok stays true while valid.
(define-private (auth-one
    (scope uint)
    (acc { agent: principal, expiry: uint, ok: bool }))
  (if (and (get ok acc) (is-scope-registered scope))
    (begin
      (map-set permissions
        { user: tx-sender, agent: (get agent acc), scope: scope }
        (get expiry acc))
      (print { event: "authorized", user: tx-sender, agent: (get agent acc),
               scope: scope, expiry: (get expiry acc) })
      acc
    )
    (merge acc { ok: false })
  )
)

(define-private (revoke-one (scope uint) (agent principal))
  (begin
    (map-delete permissions { user: tx-sender, agent: agent, scope: scope })
    (print { event: "revoked", user: tx-sender, agent: agent, scope: scope })
    agent
  )
)

;; -- Public: grant ------------------------------------------------------------

;; Grant `agent` a single `scope`.
;;   expiry = u0 -> permanent; expiry = N -> expires at stacks-block-height N (exclusive)
(define-public (authorize (agent principal) (scope uint) (expiry uint))
  (begin
    (asserts! (not (var-get paused)) ERR-PAUSED)
    (asserts! (is-scope-registered scope) ERR-UNKNOWN-SCOPE)
    (asserts! (or (is-eq expiry u0) (> expiry stacks-block-height)) ERR-EXPIRED-ON-ARRIVAL)
    (map-set permissions { user: tx-sender, agent: agent, scope: scope } expiry)
    (print { event: "authorized", user: tx-sender, agent: agent, scope: scope, expiry: expiry })
    (ok true)
  )
)

;; Grant `agent` multiple scopes sharing one `expiry`.
(define-public (authorize-batch (agent principal) (scopes (list 20 uint)) (expiry uint))
  (begin
    (asserts! (not (var-get paused)) ERR-PAUSED)
    (asserts! (> (len scopes) u0) ERR-EMPTY-LIST)
    (asserts! (or (is-eq expiry u0) (> expiry stacks-block-height)) ERR-EXPIRED-ON-ARRIVAL)
    (let ((res (fold auth-one scopes { agent: agent, expiry: expiry, ok: true })))
      (asserts! (get ok res) ERR-UNKNOWN-SCOPE)
      (ok true)
    )
  )
)

(define-private (grant-defaults (agent principal) (expiry uint))
  (begin
    (asserts! (not (var-get paused)) ERR-PAUSED)
    (asserts! (or (is-eq expiry u0) (> expiry stacks-block-height)) ERR-EXPIRED-ON-ARRIVAL)
    (map-set permissions { user: tx-sender, agent: agent, scope: SCOPE-CANCEL }  expiry)
    (map-set permissions { user: tx-sender, agent: agent, scope: SCOPE-PAUSE }   expiry)
    (map-set permissions { user: tx-sender, agent: agent, scope: SCOPE-REMIND }  expiry)
    (map-set permissions { user: tx-sender, agent: agent, scope: SCOPE-ANALYZE } expiry)
    (print { event: "granted-defaults", user: tx-sender, agent: agent, expiry: expiry })
    (ok true)
  )
)

;; Onboarding helper -- grant all built-in scopes permanently.
(define-public (grant-default-scopes (agent principal))
  (grant-defaults agent u0)
)

;; Grant all built-in scopes sharing one `expiry`.
(define-public (grant-default-scopes-with-expiry (agent principal) (expiry uint))
  (grant-defaults agent expiry)
)

;; -- Public: revoke (always allowed, even when paused) ------------------------

(define-public (revoke (agent principal) (scope uint))
  (begin
    (map-delete permissions { user: tx-sender, agent: agent, scope: scope })
    (print { event: "revoked", user: tx-sender, agent: agent, scope: scope })
    (ok true)
  )
)

(define-public (revoke-batch (agent principal) (scopes (list 20 uint)))
  (begin
    (asserts! (> (len scopes) u0) ERR-EMPTY-LIST)
    (fold revoke-one scopes agent)
    (ok true)
  )
)

;; Kill switch -- revoke every registered scope from `agent`.
(define-public (revoke-all (agent principal))
  (begin
    (fold revoke-one (var-get registered-scope-ids) agent)
    (print { event: "revoked-all", user: tx-sender, agent: agent })
    (ok true)
  )
)

;; -- Owner: administration ----------------------------------------------------

;; Register a new custom scope id with a human-readable label.
(define-public (register-scope (scope uint) (label (string-ascii 64)))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-OWNER)
    (asserts! (not (is-scope-registered scope)) ERR-SCOPE-EXISTS)
    (map-set scope-registry scope label)
    (var-set registered-scope-ids
      (unwrap! (as-max-len? (append (var-get registered-scope-ids) scope) u50)
               ERR-REGISTRY-FULL))
    (print { event: "scope-registered", scope: scope, label: label })
    (ok true)
  )
)

;; Rotate the canonical SAM agent address (decorative / off-chain reference).
(define-public (update-agent (new-agent principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-OWNER)
    (print { event: "agent-updated", old-agent: (var-get sam-agent), new-agent: new-agent })
    (var-set sam-agent new-agent)
    (ok true)
  )
)

;; Emergency: freeze all authorizations.
(define-public (pause)
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-OWNER)
    (var-set paused true)
    (print { event: "paused", by: tx-sender })
    (ok true)
  )
)

;; Lift the emergency freeze.
(define-public (unpause)
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-OWNER)
    (var-set paused false)
    (print { event: "unpaused", by: tx-sender })
    (ok true)
  )
)

;; Begin a two-step ownership transfer.
(define-public (transfer-ownership (new-owner principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-OWNER)
    (var-set pending-owner (some new-owner))
    (print { event: "ownership-transfer-started", old-owner: (var-get contract-owner), new-owner: new-owner })
    (ok true)
  )
)

;; Complete a two-step ownership transfer. Callable by the pending owner.
(define-public (accept-ownership)
  (begin
    (asserts! (is-eq (some tx-sender) (var-get pending-owner)) ERR-NOT-PENDING-OWNER)
    (print { event: "ownership-transferred", old-owner: (var-get contract-owner), new-owner: tx-sender })
    (var-set contract-owner tx-sender)
    (var-set pending-owner none)
    (ok true)
  )
)
