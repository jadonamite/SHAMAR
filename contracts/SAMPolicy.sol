// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  SAMPolicy
 * @author Ciphergon / SAM
 * @notice ERC-8004-inspired programmable agent-permission registry.
 *         Each user grants an agent address time-bounded, revocable execution
 *         scopes. SAM's backend MUST pass {isAuthorized} before performing any
 *         autonomous action on a user's behalf.
 *
 * @dev    Chain: Celo mainnet (chainId 42220).
 *
 *         Consent model:
 *           - User-sovereign: only the user can grant/revoke their own scopes.
 *           - Time-bounded: a grant may carry an expiry; `0` means "no expiry".
 *           - Revocable: single, batch, or all-at-once kill switch.
 *           - Owner emergency pause: globally freezes all authorizations.
 *
 *         Scope semantics (progressive trust):
 *           SCOPE_REMIND  / SCOPE_ANALYZE — low-risk, informational.
 *           SCOPE_PAUSE   / SCOPE_CANCEL  — state-changing actions on a sub.
 *
 *         Note on {samAgent}: the canonical agent address is stored for
 *         off-chain reference and discovery only. It is intentionally NOT
 *         enforced inside {authorize}/{isAuthorized} — any agent address may be
 *         granted scopes. Enforcement is delegated to the backend, which always
 *         queries with the canonical agent address.
 */
contract SAMPolicy {
    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    /// @notice A single scope's live status for a (user, agent) pair.
    struct ScopeStatus {
        bytes32 scope;  // scope identifier
        string  label;  // human-readable label, e.g. "sam.cancel"
        uint256 expiry; // 0 = not granted, NO_EXPIRY = permanent, else unix ts
        bool    active; // true if currently authorized (accounts for time/pause)
    }

    // ---------------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------------

    /// @notice Sentinel expiry meaning "never expires".
    uint256 public constant NO_EXPIRY = type(uint256).max;

    /// @notice Contract version.
    string public constant VERSION = "2.0.0";

    bytes32 public constant SCOPE_CANCEL  = keccak256("sam.cancel");
    bytes32 public constant SCOPE_PAUSE   = keccak256("sam.pause");
    bytes32 public constant SCOPE_REMIND  = keccak256("sam.remind");
    bytes32 public constant SCOPE_ANALYZE = keccak256("sam.analyze");

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    /// @notice Contract administrator (scope registry, agent rotation, pause).
    address public owner;

    /// @notice Pending owner in the two-step ownership transfer.
    address public pendingOwner;

    /// @notice Canonical SAM agent address (off-chain reference; see contract docs).
    address public samAgent;

    /// @notice When true, all authorizations evaluate as denied.
    bool public paused;

    /// @notice user => agent => scope => expiry (0 none, NO_EXPIRY permanent).
    mapping(address => mapping(address => mapping(bytes32 => uint256))) public permissions;

    /// @notice Whether a scope id has been registered.
    mapping(bytes32 => bool) public isRegisteredScope;

    /// @notice Human-readable label for a registered scope.
    mapping(bytes32 => string) public scopeLabel;

    /// @dev Enumerable list of registered scope ids.
    bytes32[] private _registeredScopes;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event Authorized(address indexed user, address indexed agent, bytes32 indexed scope, uint256 expiry);
    event Revoked(address indexed user, address indexed agent, bytes32 indexed scope);
    event ScopeRegistered(bytes32 indexed scope, string label);
    event AgentUpdated(address indexed oldAgent, address indexed newAgent);
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error NotOwner();
    error NotPendingOwner();
    error ContractPaused();
    error ZeroAddress();
    error UnknownScope(bytes32 scope);
    error ScopeAlreadyRegistered(bytes32 scope);
    error ExpiryInPast(uint256 expiry);
    error EmptyScopeArray();

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    /**
     * @param _samAgent Canonical SAM agent address (off-chain reference).
     */
    constructor(address _samAgent) {
        if (_samAgent == address(0)) revert ZeroAddress();
        owner = msg.sender;
        samAgent = _samAgent;
        emit OwnershipTransferred(address(0), msg.sender);
        emit AgentUpdated(address(0), _samAgent);

        _registerScope(SCOPE_CANCEL,  "sam.cancel");
        _registerScope(SCOPE_PAUSE,   "sam.pause");
        _registerScope(SCOPE_REMIND,  "sam.remind");
        _registerScope(SCOPE_ANALYZE, "sam.analyze");
    }

    // ---------------------------------------------------------------------
    // User: grant
    // ---------------------------------------------------------------------

    /**
     * @notice Grant `agent` a single `scope`, optionally time-bounded.
     * @param agent  Agent address being authorized.
     * @param scope  Registered scope identifier.
     * @param expiry Unix timestamp expiry; `0` means no expiry. Must be in the
     *               future when non-zero.
     */
    function authorize(address agent, bytes32 scope, uint256 expiry) public whenNotPaused {
        _authorize(msg.sender, agent, scope, expiry);
    }

    /**
     * @notice Grant `agent` multiple scopes sharing one `expiry`.
     */
    function authorizeBatch(address agent, bytes32[] calldata scopes, uint256 expiry)
        external
        whenNotPaused
    {
        uint256 len = scopes.length;
        if (len == 0) revert EmptyScopeArray();
        for (uint256 i; i < len; ++i) {
            _authorize(msg.sender, agent, scopes[i], expiry);
        }
    }

    /**
     * @notice Onboarding helper — grant all built-in scopes with no expiry.
     */
    function grantDefaultScopes(address agent) external whenNotPaused {
        _grantDefaults(agent, 0);
    }

    /**
     * @notice Grant all built-in scopes sharing one `expiry`.
     * @param expiry Unix timestamp expiry; `0` means no expiry.
     */
    function grantDefaultScopesWithExpiry(address agent, uint256 expiry) external whenNotPaused {
        _grantDefaults(agent, expiry);
    }

    // ---------------------------------------------------------------------
    // User: revoke
    // ---------------------------------------------------------------------

    /**
     * @notice Revoke a single `scope` from `agent`. Always allowed, even when paused.
     */
    function revoke(address agent, bytes32 scope) public {
        permissions[msg.sender][agent][scope] = 0;
        emit Revoked(msg.sender, agent, scope);
    }

    /**
     * @notice Revoke multiple scopes from `agent`.
     */
    function revokeBatch(address agent, bytes32[] calldata scopes) external {
        uint256 len = scopes.length;
        if (len == 0) revert EmptyScopeArray();
        for (uint256 i; i < len; ++i) {
            permissions[msg.sender][agent][scopes[i]] = 0;
            emit Revoked(msg.sender, agent, scopes[i]);
        }
    }

    /**
     * @notice Kill switch — revoke every registered scope from `agent`.
     */
    function revokeAll(address agent) external {
        uint256 len = _registeredScopes.length;
        for (uint256 i; i < len; ++i) {
            bytes32 scope = _registeredScopes[i];
            permissions[msg.sender][agent][scope] = 0;
            emit Revoked(msg.sender, agent, scope);
        }
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /**
     * @notice Whether `agent` may execute `scope` for `user` right now.
     * @dev Returns false while the contract is paused.
     */
    function isAuthorized(address user, address agent, bytes32 scope) public view returns (bool) {
        if (paused) return false;
        uint256 expiry = permissions[user][agent][scope];
        if (expiry == 0) return false;
        if (expiry == NO_EXPIRY) return true;
        return block.timestamp < expiry;
    }

    /**
     * @notice Raw stored expiry for a (user, agent, scope).
     */
    function getExpiry(address user, address agent, bytes32 scope) external view returns (uint256) {
        return permissions[user][agent][scope];
    }

    /**
     * @notice Full status of every registered scope for a (user, agent) pair.
     * @dev Convenience read for frontends — avoids per-scope round trips.
     */
    function getPermissions(address user, address agent)
        external
        view
        returns (ScopeStatus[] memory statuses)
    {
        uint256 len = _registeredScopes.length;
        statuses = new ScopeStatus[](len);
        for (uint256 i; i < len; ++i) {
            bytes32 scope = _registeredScopes[i];
            statuses[i] = ScopeStatus({
                scope:  scope,
                label:  scopeLabel[scope],
                expiry: permissions[user][agent][scope],
                active: isAuthorized(user, agent, scope)
            });
        }
    }

    /// @notice All registered scope identifiers.
    function getRegisteredScopes() external view returns (bytes32[] memory) {
        return _registeredScopes;
    }

    /// @notice Number of registered scopes.
    function registeredScopeCount() external view returns (uint256) {
        return _registeredScopes.length;
    }

    // ---------------------------------------------------------------------
    // Owner: administration
    // ---------------------------------------------------------------------

    /**
     * @notice Register a new custom scope with a human-readable label.
     */
    function registerScope(bytes32 scope, string calldata label) external onlyOwner {
        _registerScope(scope, label);
    }

    /**
     * @notice Update the canonical SAM agent address (off-chain reference only).
     */
    function updateAgent(address newAgent) external onlyOwner {
        if (newAgent == address(0)) revert ZeroAddress();
        emit AgentUpdated(samAgent, newAgent);
        samAgent = newAgent;
    }

    /// @notice Emergency: freeze all authorizations.
    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    /// @notice Lift the emergency freeze.
    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    /**
     * @notice Begin a two-step ownership transfer.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /**
     * @notice Complete a two-step ownership transfer. Callable by pending owner.
     */
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    function _authorize(address user, address agent, bytes32 scope, uint256 expiry) internal {
        if (agent == address(0)) revert ZeroAddress();
        if (!isRegisteredScope[scope]) revert UnknownScope(scope);

        uint256 stored;
        if (expiry == 0) {
            stored = NO_EXPIRY;
        } else {
            if (expiry <= block.timestamp) revert ExpiryInPast(expiry);
            stored = expiry;
        }

        permissions[user][agent][scope] = stored;
        emit Authorized(user, agent, scope, stored);
    }

    function _grantDefaults(address agent, uint256 expiry) internal {
        _authorize(msg.sender, agent, SCOPE_CANCEL,  expiry);
        _authorize(msg.sender, agent, SCOPE_PAUSE,   expiry);
        _authorize(msg.sender, agent, SCOPE_REMIND,  expiry);
        _authorize(msg.sender, agent, SCOPE_ANALYZE, expiry);
    }

    function _registerScope(bytes32 scope, string memory label) internal {
        if (isRegisteredScope[scope]) revert ScopeAlreadyRegistered(scope);
        isRegisteredScope[scope] = true;
        scopeLabel[scope] = label;
        _registeredScopes.push(scope);
        emit ScopeRegistered(scope, label);
    }
}
