// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IX402Verifier.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./X402SessionManager.sol";

/**
 * @title X402PaymentAdapter
 * @notice Adapter contract to verify x402 payments and manage payment settings
 */
contract X402PaymentAdapter is Ownable {
    IX402Verifier public verifier;
    X402SessionManager public sessionManager; // optional session control
    mapping(bytes32 => bool) public usedPayments;

    event PaymentVerified(bytes32 indexed paymentId, uint256 amount, address token);
    event PaymentVerifiedAndDebited(bytes32 indexed paymentId, bytes32 indexed sessionId, uint256 amount, address token, uint256 remaining);
    event VerifierUpdated(address indexed oldVerifier, address indexed newVerifier);
    event SessionManagerUpdated(address indexed oldManager, address indexed newManager);

    constructor(address _verifier) Ownable(msg.sender) {
        verifier = IX402Verifier(_verifier);
    }

    /**
     * @notice Verifies an x402 payment and marks it as used
     * @param paymentId Unique payment identifier
     * @param proof Payment proof data
     * @param amount Expected payment amount
     * @param token Token used for payment
     */
    function verifyAndMarkPayment(
        bytes32 paymentId,
        bytes calldata proof,
        uint256 amount,
        address token
    ) external returns (bool) {
        require(!usedPayments[paymentId], "Payment already used");
        require(verifier.verifyPayment(paymentId, proof, amount, token), "Invalid payment");
        
        usedPayments[paymentId] = true;
        emit PaymentVerified(paymentId, amount, token);
        return true;
    }

    /**
     * @notice Verifies an x402 payment, debits a session allowance and marks paymentId used
     * @param paymentId Unique payment identifier
     * @param sessionId User's spending session identifier
     * @param proof Off-chain proof per verifier implementation
     * @param amount Amount to debit
     * @param token Token used for the payment
     */
    function verifyAndDebit(
        bytes32 paymentId,
        bytes32 sessionId,
        bytes calldata proof,
        uint256 amount,
        address user,
        address token
    ) external returns (bool) {
        require(address(sessionManager) != address(0), "No session mgr");
        require(!usedPayments[paymentId], "Payment used");
        require(verifier.verifyPayment(paymentId, proof, amount, token), "Invalid payment");

        // mark first to prevent reentrancy style reuse
        usedPayments[paymentId] = true;

        // debit session via owner-only consume, we temporarily grant adapter ownership pattern not assumed. Simpler: adapter must be owner of session manager.
        sessionManager.consume(sessionId, user, amount);
        uint256 remaining = sessionManager.remaining(sessionId);
        emit PaymentVerifiedAndDebited(paymentId, sessionId, amount, token, remaining);
        return true;
    }

    /**
     * @notice Update the verifier contract address
     * @param _verifier New verifier contract address
     */
    function updateVerifier(address _verifier) external onlyOwner {
        address oldVerifier = address(verifier);
        verifier = IX402Verifier(_verifier);
        emit VerifierUpdated(oldVerifier, _verifier);
    }

    function setSessionManager(address _mgr) external onlyOwner {
        address old = address(sessionManager);
        sessionManager = X402SessionManager(_mgr);
        emit SessionManagerUpdated(old, _mgr);
    }
}