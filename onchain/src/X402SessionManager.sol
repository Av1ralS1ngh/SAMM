// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title X402SessionManager
 * @notice Manages spending sessions for x402 pattern: bounded allowance & expiry
 */
contract X402SessionManager {
    struct Session {
        address user;
        uint256 allowance;   // total allowed spend (in token units of chosen stable or abstract USD unit externally enforced)
        uint256 spent;       // cumulative spent
        uint64  expiresAt;   // unix timestamp
        bool active;
    }

    mapping(bytes32 => Session) public sessions; // sessionId => session
    address public owner;

    event SessionCreated(bytes32 indexed sessionId, address indexed user, uint256 allowance, uint64 expiresAt);
    event SessionConsumed(bytes32 indexed sessionId, uint256 amount, uint256 newSpent);
    event SessionCancelled(bytes32 indexed sessionId);
    event OwnerUpdated(address indexed oldOwner, address indexed newOwner);

    modifier onlyOwner(){ require(msg.sender == owner, "Not owner"); _; }

    constructor() { owner = msg.sender; }

    function setOwner(address _o) external onlyOwner { emit OwnerUpdated(owner, _o); owner = _o; }

    function createSession(bytes32 sessionId, address user, uint256 allowance, uint64 expiresAt) external onlyOwner {
        require(!sessions[sessionId].active, "Session exists");
        require(expiresAt > block.timestamp, "Expiry in past");
        sessions[sessionId] = Session({user: user, allowance: allowance, spent: 0, expiresAt: expiresAt, active: true});
        emit SessionCreated(sessionId, user, allowance, expiresAt);
    }

    function cancelSession(bytes32 sessionId) external {
        Session storage s = sessions[sessionId];
        require(s.active, "Inactive");
        require(msg.sender == owner || msg.sender == s.user, "No auth");
        s.active = false;
        emit SessionCancelled(sessionId);
    }

    function remaining(bytes32 sessionId) public view returns (uint256) {
        Session storage s = sessions[sessionId];
        if(!s.active || s.expiresAt < block.timestamp) return 0;
        if(s.spent >= s.allowance) return 0;
        return s.allowance - s.spent;
    }

    function consume(bytes32 sessionId, address user, uint256 amount) external onlyOwner {
        Session storage s = sessions[sessionId];
        require(s.active, "Inactive");
        require(s.expiresAt >= block.timestamp, "Expired");
        require(s.user == user, "Wrong user");
        require(s.spent + amount <= s.allowance, "Allowance exceeded");
        s.spent += amount;
        emit SessionConsumed(sessionId, amount, s.spent);
    }
}
