// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IX402Verifier {
    /**
     * @notice Verifies an x402 payment proof
     * @param paymentId The unique ID of the x402 payment
     * @param proof The payment proof data
     * @param amount The expected payment amount
     * @param token The token address that was used for payment
     * @return valid Whether the payment proof is valid
     */
    function verifyPayment(
        bytes32 paymentId,
        bytes calldata proof,
        uint256 amount,
        address token
    ) external view returns (bool valid);
}