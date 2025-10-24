// Minimal OrbitalPool ABI subset required for local swap calldata encoding fallback
export const ORBITAL_POOL_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "tokenIn", "type": "address" },
      { "internalType": "address", "name": "tokenOut", "type": "address" },
      { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
      { "internalType": "uint256", "name": "minAmountOut", "type": "uint256" }
    ],
    "name": "swap",
    "outputs": [
      { "internalType": "uint256", "name": "inputAmountGross", "type": "uint256" },
      { "internalType": "uint256", "name": "inputAmountNet", "type": "uint256" },
      { "internalType": "uint256", "name": "outputAmount", "type": "uint256" },
      { "internalType": "uint256", "name": "effectivePrice", "type": "uint256" },
      { "internalType": "uint256", "name": "segments", "type": "uint256" },
      { "internalType": "bool", "name": "success", "type": "bool" },
      { "internalType": "string", "name": "message", "type": "string" }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];
