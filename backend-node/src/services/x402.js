import { paymentMiddleware } from 'x402-express';
import { wrapFetchWithPayment, decodeXPaymentResponse } from 'x402-fetch';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy } from 'viem/chains';
import dotenv from 'dotenv';

dotenv.config();

// Create x402 payment middleware
export const x402PaymentMiddleware = paymentMiddleware(
  process.env.PAYMENT_ADDRESS,
  {
    "POST /api/swap": {
      price: "$0.001", // Fee per swap
      network: "polygon-amoy",
      config: {
        description: "Execute a swap on Orbital DEX",
        inputSchema: {
          type: "object",
          properties: {
            tokenIn: { type: "string" },
            tokenOut: { type: "string" },
            amountIn: { type: "string" },
            minAmountOut: { type: "string" }
          },
          required: ["tokenIn", "tokenOut", "amountIn", "minAmountOut"]
        }
      }
    }
  },
  {
    url: process.env.X402_FACILITATOR_URL || process.env.FACILITATOR_URL || "https://x402.polygon.technology",
  }
);

// Create payment client for making x402 payments
const account = privateKeyToAccount(process.env.PRIVATE_KEY);
export const fetchWithX402Payment = wrapFetchWithPayment(fetch, account);
export const x402FacilitatorUrl = process.env.X402_FACILITATOR_URL || process.env.FACILITATOR_URL || "https://x402.polygon.technology";

// Helper function to decode payment responses
export const decodePaymentResponse = (headers) => {
  return decodeXPaymentResponse(headers.get("x-payment-response"));
};