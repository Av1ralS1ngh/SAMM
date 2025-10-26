// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./OrbitalPool.sol";

/**
 * @title OrbitalPoolX402Extension
 * @notice Extension exposing x402 payment & session swap entrypoints separated from core pool
 * @dev Inherits OrbitalPool to reduce stack depth pressure in the base contract compile unit.
 */
contract OrbitalPoolX402Extension is OrbitalPool {
    constructor(address[] memory _tokens, address _x402PaymentAdapter)
        OrbitalPool(_tokens, _x402PaymentAdapter) {}

    function swapWithX402Payment(
        uint256 tokenIn,
        uint256 tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes32 paymentId,
        bytes calldata proof
    ) external nonReentrant validTokenIndex(tokenIn) validTokenIndex(tokenOut) returns (uint256 amountOut) {
        amountOut = _swapWithX402PaymentInternal(tokenIn, tokenOut, amountIn, minAmountOut, paymentId, proof);
    }

    function swapWithX402Session(
        uint256 tokenIn,
        uint256 tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes32 sessionId,
        bytes32 paymentId,
        bytes calldata proof,
        address user
    ) external nonReentrant validTokenIndex(tokenIn) validTokenIndex(tokenOut) returns (uint256 amountOut) {
        amountOut = _swapWithX402SessionInternal(tokenIn, tokenOut, amountIn, minAmountOut, sessionId, paymentId, proof, user);
    }
}
