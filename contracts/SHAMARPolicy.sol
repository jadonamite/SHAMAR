// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  SHAMARPolicy
 * @author SHAMAR
 * @notice Programmable agent-permission registry. A user grants an agent
 *         time-bounded, revocable execution scopes. The backend MUST pass
 *         {isAuthorized} before any autonomous action on that user's behalf.
 * @dev    Chain: Base. Successor to SAMPolicy (Celo 42220), with scopes
 *         renamed to the `shamar.*` namespace and `shamar.pay` added for the
 *         card tier.
 *
 *         Consent model: only the user grants or revokes their own scopes; a
 *         grant may carry an expiry (`0` means none); revocation works singly,
 *         in batch, or as a kill switch, and keeps working while paused.
 *
 *         {shamarAgent} is stored for off-chain discovery only and is
 *         deliberately not enforced in {authorize} or {isAuthorized}. Any
 *         address may be granted scopes; the backend always queries with the
 *         canonical one.
 */
contract SHAMARPolicy {
    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    /// @notice A single scope's live status for a (user, agent) pair.
    struct ScopeStatus {
        bytes32 scope;
        string  label;
        uint256 expiry; // 0 = not granted, NO_EXPIRY = permanent, else unix ts
        bool    active; // accounts for expiry and the global pause
    }

    // ---------------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------------

    /// @notice Sentinel expiry meaning "never expires".
    uint256 public constant NO_EXPIRY = type(uint256).max;

    string public constant VERSION = "3.0.0";

    bytes32 public constant SCOPE_CANCEL  = keccak256("shamar.cancel");
    bytes32 public constant SCOPE_PAUSE   = keccak256("shamar.pause");
    bytes32 public constant SCOPE_REMIND  = keccak256("shamar.remind");
    bytes32 public constant SCOPE_ANALYZE = keccak256("shamar.analyze");

    /// @notice Card tier: issue, fund, close or pause a card for a subscription.
    /// @dev    Spend ceilings are enforced by the card network, not here.
    bytes32 public constant SCOPE_PAY     = keccak256("shamar.pay");

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    address public owner;
    address public pendingOwner;

    /// @notice Canonical agent address. Off-chain reference; see contract docs.
    address public shamarAgent;

    /// @notice When true, all authorizations evaluate as denied.
    bool public paused;

    /// @notice user => agent => scope => expiry (0 none, NO_EXPIRY permanent).
    mapping(address => mapping(address => mapping(bytes32 => uint256))) public permissions;

    mapping(bytes32 => bool) public isRegisteredScope;
    mapping(bytes32 => string) public scopeLabel;

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

    constructor(address _shamarAgent) {
        if (_shamarAgent == address(0)) revert ZeroAddress();
        owner = msg.sender;
        shamarAgent = _shamarAgent;
        emit OwnershipTransferred(address(0), msg.sender);
        emit AgentUpdated(address(0), _shamarAgent);

        _registerScope(SCOPE_CANCEL,  "shamar.cancel");
        _registerScope(SCOPE_PAUSE,   "shamar.pause");
        _registerScope(SCOPE_REMIND,  "shamar.remind");
        _registerScope(SCOPE_ANALYZE, "shamar.analyze");
        _registerScope(SCOPE_PAY,     "shamar.pay");
    }

    // ---------------------------------------------------------------------
    // User: grant
    // ---------------------------------------------------------------------

    /// @notice Grant `agent` a single `scope`. `expiry` of 0 means no expiry.
    function authorize(address agent, bytes32 scope, uint256 expiry) public whenNotPaused {
        _authorize(msg.sender, agent, scope, expiry);
    }

    /// @notice Grant `agent` several scopes sharing one `expiry`.
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

    /// @notice Onboarding helper. Grants cancel, pause, remind and analyze with
    ///         no expiry. Deliberately excludes {SCOPE_PAY}, which is opt-in.
    function grantDefaultScopes(address agent) external whenNotPaused {
        _grantDefaults(agent, 0);
    }

    /// @notice As {grantDefaultScopes}, sharing one `expiry`.
    function grantDefaultScopesWithExpiry(address agent, uint256 expiry) external whenNotPaused {
        _grantDefaults(agent, expiry);
    }

    // ---------------------------------------------------------------------
    // User: revoke
    // ---------------------------------------------------------------------

    /// @notice Revoke one `scope`. Works even while paused.
    function revoke(address agent, bytes32 scope) public {
        permissions[msg.sender][agent][scope] = 0;
        emit Revoked(msg.sender, agent, scope);
    }

    /// @notice Revoke several scopes.
    function revokeBatch(address agent, bytes32[] calldata scopes) external {
        uint256 len = scopes.length;
        if (len == 0) revert EmptyScopeArray();
        for (uint256 i; i < len; ++i) {
            permissions[msg.sender][agent][scopes[i]] = 0;
            emit Revoked(msg.sender, agent, scopes[i]);
        }
    }

    /// @notice Kill switch. Revokes every registered scope from `agent`.
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

    /// @notice Whether `agent` may execute `scope` for `user` right now.
    function isAuthorized(address user, address agent, bytes32 scope) public view returns (bool) {
        if (paused) return false;
        uint256 expiry = permissions[user][agent][scope];
        if (expiry == 0) return false;
        if (expiry == NO_EXPIRY) return true;
        return block.timestamp < expiry;
    }

    /// @notice Raw stored expiry for a (user, agent, scope).
    function getExpiry(address user, address agent, bytes32 scope) external view returns (uint256) {
        return permissions[user][agent][scope];
    }

    /// @notice Status of every registered scope for a (user, agent) pair.
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

    function getRegisteredScopes() external view returns (bytes32[] memory) {
        return _registeredScopes;
    }

    function registeredScopeCount() external view returns (uint256) {
        return _registeredScopes.length;
    }

    // ---------------------------------------------------------------------
    // Owner
    // ---------------------------------------------------------------------

    function registerScope(bytes32 scope, string calldata label) external onlyOwner {
        _registerScope(scope, label);
    }

    function updateAgent(address newAgent) external onlyOwner {
        if (newAgent == address(0)) revert ZeroAddress();
        emit AgentUpdated(shamarAgent, newAgent);
        shamarAgent = newAgent;
    }

    /// @notice Emergency freeze. Revocation still works.
    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

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
