export const config = {
  x402: {
    facilitatorUrl: process.env.X402_FACILITATOR_URL || 'https://x402.polygon.technology',
    verifierAddress: process.env.VERIFIER_ADDRESS,
    chainId: 80002, // Polygon Amoy testnet
  },
  blockchain: {
    rpcUrl: process.env.CHAIN_RPC_URL || 'https://rpc-amoy.polygon.technology',
    contractAddress: process.env.CONTRACT_ADDRESS || process.env.ORBITALPOOL_ADDRESS,
    poolAddress: process.env.ORBITALPOOL_ADDRESS || process.env.CONTRACT_ADDRESS,
    sessionManager: process.env.X402SessionManager_ADDRESS,
    paymentAdapter: process.env.X402PaymentAdapter_ADDRESS,
    tokenAddresses: {
      PYUSD: process.env.PYUSD,
      USDC: process.env.USDC,
    },
  },
  amm: {
    defaultSlippage: '0.5', // 0.5%
    defaultDeadline: 20 * 60, // 20 minutes
  },
};