// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../X402PaymentAdapter.sol";

interface IOrbitalPoolWithX402 {
    function swapWithX402Payment(
        uint256 tokenIn,
        uint256 tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes32 paymentId,
        bytes calldata proof
    ) external returns (uint256 amountOut);
}