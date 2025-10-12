# Orbital DEX Backend

Node.js backend for the Orbital DEX with x402 payment integration.

## Features

- Express.js REST API
- x402 payment integration
- Blockchain interaction with ethers.js
- Pool statistics and quotes
- Swap execution with payment verification

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Configure your environment variables in `.env`

4. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Pool Operations

- `GET /api/pool/info` - Get pool information
- `GET /api/pool/stats` - Get pool statistics
- `GET /api/quote` - Get swap quote
- `GET /api/pool/reserves` - Get raw reserves array (depending on contract method availability)
- `GET /api/pool/spot-price?tokenIn=...&tokenOut=...` - Spot price placeholder (returns 0 for now)
- `GET /api/pool/tick-efficiency` - Capital efficiency placeholder
- `POST /api/swap/execute` - Build unsigned swap calldata (no signing / sending)

### x402 Payments

- `GET /api/payment/requirements` - Static PaymentRequirements document (demo)
- `POST /api/payment/verify` - Verify a payment header (stub, returns success)
- `POST /api/payment/settle` - Stub settlement; generates pseudo txHash
- `GET /api/session/status/:id` - Session status placeholder

### Liquidity

- `POST /api/pool/liquidity/add` - Stub add liquidity
- `POST /api/pool/liquidity/remove` - Stub remove liquidity

### Swap Flow (Client Side)
1. Fetch quote: `GET /api/quote?tokenIn=<addr>&tokenOut=<addr>&amountIn=<raw>`
2. Optionally verify payment (x402) before execution.
3. Get calldata: `POST /api/swap/execute` with body:
```json
{
	"tokenIn": "0x...",
	"tokenOut": "0x...",
	"amountIn": "1000000",
	"minAmountOut": "990000",
	"deadline": 1699999999
}
```
4. Submit transaction via user wallet (EIP-1193 provider):
```js
await provider.request({ method: 'eth_sendTransaction', params: [{ to, data, value }] });
```

### Payment Lifecycle (Demo)
1. `GET /api/payment/requirements` -> Retrieve static requirements.
2. Client obtains X-PAYMENT header using facilitator flow (outside scope here).
3. `POST /api/payment/verify` { paymentHeader } -> returns paymentId.
4. `POST /api/payment/settle` { paymentId } -> marks settlement + pseudo txHash.
5. `GET /api/session/status/<paymentId>` -> (future) unify payment/session state.

### Example Responses

Quote:
```json
{ "amountIn": "1000000", "amountOut": "995123", "tokenIn": "0x...", "tokenOut": "0x..." }
```

Swap Execute Calldata:
```json
{ "to": "0xPool", "data": "0xabcdef...", "value": "0x0", "chainId": 80002 }
```

Payment Requirements:
```json
{
	"x402Version": 1,
	"requirements": { "scheme": "exact", "network": "polygon-amoy", "maxAmountRequired": "1000" }
}
```

Payment Verify:
```json
{ "isValid": true, "settlementRequired": true, "paymentId": "pid_172748..." }
```

Payment Settle:
```json
{ "success": true, "txHash": "0xdeadbeef0000..." }
```

Liquidity Add (stub):
```json
{ "amounts": ["1000","1000"], "lpTokensMinted": "0", "newReserves": ["1000","1000"], "success": true }
```

### Future Improvements
* Replace stubbed spot price & tick efficiency with real contract view functions.
* Integrate actual facilitator verify & settle flows.
* Implement proper token index/symbol mapping and multi-hop routing if needed.
* Persist payment/session state in Redis/Postgres for horizontal scaling.
* Add rate limiting & structured logging (pino/winston).
* Add tests (Jest) for quotes, buildSwapCalldata, and payment lifecycle.

## Environment Variables

- `PORT` - Server port (default: 3000)
- `CHAIN_RPC_URL` - Blockchain RPC URL
- `CONTRACT_ADDRESS` - OrbitalPool contract address
- `X402_FACILITATOR_URL` - x402 facilitator URL
- `VERIFIER_ADDRESS` - x402 verifier contract address

## Development

- Run in development mode: `npm run dev`
- Run tests: `npm test`