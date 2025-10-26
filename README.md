# SAMM

SAMM is a full-stack stablecoin automation platform that combines custom on-chain liquidity, payment routing, and risk analytics. The project pairs:

* **Foundry-based smart contracts** for Orbital-inspired stablecoin liquidity management, x402 payment flows, and oracle integrations (`onchain/`).
* **A Node.js service layer** that exposes APIs, payment facilitation hooks, and background jobs (`backend-node/`).
* **A React + Vite frontend** for merchant dashboards, swap interfaces, and real-time telemetry (`frontend/Porbit/`).
* **Circle CCTP helpers** to bridge liquidity across supported networks (`CCTP/`).

Everything in this repository is geared toward experimenting with efficient, compliant stablecoin payments.

## Highlights

* **Orbital-style AMM:** Concentrated liquidity design to handle many stablecoins in a single pool with resilience to depegs.
* **x402 automation:** Coinbase x402 integrations for machine-readable payment requests and reconciliation.
* **Compliance-aware tooling:** Risk scoring and analytics that surface issuer and reserve data for merchants.
* **Omnichain liquidity:** LayerZero OFT adapters and CCTP scripts for bridging liquidity between chains.

## Repository Layout

```
SAMM/
├── backend-node/    # Express APIs, services, and liquidity scripts
├── frontend/        # React interface (Porbit) with Tailwind styling
├── onchain/         # Foundry workspace: contracts, scripts, tests
├── CCTP/            # Circle CCTP utilities for debugging transfers
└── README.md        # Project overview (this file)
```

Each sub-project includes additional documentation with environment variables, run commands, and deployment notes.

## Getting Started

1. Clone the repository and install prerequisites (Node.js ≥ 18, pnpm or npm, Foundry, and a modern Python runtime for tooling).
2. Copy the relevant `.env.example` files into `.env` files and fill in credentials (RPC URLs, Coinbase keys, etc.).
3. Follow the project-level READMEs for setup:
	* `backend-node/README.md` for API services.
	* `frontend/Porbit/README.md` for the merchant dashboard.
	* `onchain/DEPLOY.md` for contract deployment flows.

## Contributing

This repository is actively evolving. If you open pull requests:

* Keep commits scoped to one sub-project when possible.
* Add or update tests in `onchain/test/` or backend/frontend suites based on the component you touch.
* Document new environment variables or scripts in the corresponding README.

## License

SAMM is released under the MIT License. See `LICENSE` for details.


















