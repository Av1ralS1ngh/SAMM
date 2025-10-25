# Deployment Guide (Core Orbital Stack)

This guide covers deploying the minimal on-chain stack: two mock ERC20 tokens, X402 session manager, payment adapter, and the `OrbitalPool`.

## Prerequisites
- Foundry installed (`forge`, `cast`) https://book.getfoundry.sh/getting-started/installation
- A funded private key (testnet) in your environment
- RPC endpoint exported in `foundry.toml` or via `--rpc-url`

## Environment Variables
Export these before running the script (example values shown):

```bash
export PRIVATE_KEY=1234567890123456789012345678901234567890123456789012345678901234
export VERIFIER_ADDRESS=0x0000000000000000000000000000000000000000   # placeholder until real verifier
export REQUIRE_X402=true

# Token 0 (e.g., USDC mock)
export TOKEN0_NAME="USD Coin"        \
       TOKEN0_SYMBOL="USDC"          \
       TOKEN0_DECIMALS=6              \
       TOKEN0_SUPPLY=1000000000000    # 1,000,000,000,000 units raw (adjust decimals)

# Token 1 (e.g., PayPal USD mock)
export TOKEN1_NAME="PayPal USD"      \
       TOKEN1_SYMBOL="PYUSD"         \
       TOKEN1_DECIMALS=6              \
       TOKEN1_SUPPLY=1000000000000
```

Notes:
- SUPPLY is raw integer (no decimal shifting automatically). Provide `supply * 10^decimals`.
- Set `REQUIRE_X402=false` if you want a pool without payment gating (adapter address passed as 0x0).

## Run Deployment
```bash
forge script script/DeployAll.s.sol:DeployAll \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  --verify --etherscan-api-key $ETHERSCAN_API_KEY  # (optional) remove if not verifying
```

The script will log a single JSON line:
```json
{"token0":"0x...","token1":"0x...","sessionManager":"0x...","paymentAdapter":"0x...","pool":"0x..."}
```
Copy this to:
- `backend-node/.env` (CONTRACT_ADDRESS=pool, etc.)
- ABI folder once you export / flatten (Foundry ARTIFACTS in `onchain/out/`)

## ABI Export
Artifacts appear in `onchain/out/` after compile. For the backend, copy the ABI array portion from:
- `out/OrbitalPool.sol/OrbitalPool.json`
- `out/X402PaymentAdapter.sol/X402PaymentAdapter.json`
- `out/X402SessionManager.sol/X402SessionManager.json`

Place into `backend-node/abi/` (e.g., `OrbitalPool.json`).

## Updating Verifier Later
If you deployed with a placeholder verifier:
```bash
cast send <paymentAdapter> "updateVerifier(address)" <newVerifier> --private-key $PRIVATE_KEY --rpc-url $SEPOLIA_RPC_URL
```

## Session Provisioning (Optional)
Create a session (adapter owns session manager):
```bash
cast send <sessionManager> "createSession(bytes32,address,uint256,uint64)" \
  $(cast keccak "demo-session") <userAddr> 1000000000000000000 $(date -v+1d +%s) \
  --private-key $PRIVATE_KEY --rpc-url $SEPOLIA_RPC_URL
```

## Quick Swap Flow (After Funding Pool)
1. User approves pool for tokenIn
2. Call `swap(tokenInIndex, tokenOutIndex, amountIn, minAmountOut)` (ensure indices match deployment order)

## Troubleshooting
| Issue | Cause | Fix |
|-------|-------|-----|
| Revert `pay` / `sess` | Payment/session not valid | Disable REQUIRE_X402 or set proper verifier & session | 
| Revert `liq` | Empty output reserve | Seed liquidity first with `addLiquidity` |
| `idx` revert | Bad token index | Use 0 or 1 only for two-token deployment |

## Future Enhancements
- Add deterministic create2 salt for reproducible addresses
- Integrate real oracle for price quoting
- Extend deployment to multiple stables or bridging if scope changes

---
This minimal script keeps deployment fast and predictable for integration with the Node backend.
