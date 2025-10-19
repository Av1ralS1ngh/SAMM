import { randomBytes } from 'crypto';
import { fetchWithX402Payment, x402FacilitatorUrl } from './x402.js';

/**
 * Off-chain x402 metering (demo):
 * - authorize(): initiates a payment intent (simulated via signed fetch)
 * - recordPayment(): stores balance units
 * - consume(paymentId, units): decrements remaining; throws if insufficient
 * Units chosen: 1 unit per protected swap.
 */
class X402MeteringService {
  constructor() {
    this.payments = new Map(); // paymentId -> { remaining, createdAt, lastConsumption }
    this.unitsPerSwap = 1;
  }

  _generatePaymentId() {
    return '0x' + randomBytes(32).toString('hex');
  }

  async authorize({ maxUnits = 5, metadata = {} } = {}) {
    // In a real flow you'd call facilitator with a request that triggers pricing logic.
    // Here we simulate with a signed fetch to facilitator root for liveness.
    try {
      await fetchWithX402Payment(x402FacilitatorUrl, { method: 'HEAD' });
    } catch (_) {
      // Ignore network errors; still issue a paymentId for demo.
    }
    const paymentId = this._generatePaymentId();
    this.payments.set(paymentId, {
      remaining: maxUnits,
      createdAt: Date.now(),
      lastConsumption: null,
      metadata,
    });
    return { paymentId, remaining: maxUnits };
  }

  status(paymentId) {
    const rec = this.payments.get(paymentId);
    if (!rec) return null;
    return { paymentId, remaining: rec.remaining, createdAt: rec.createdAt, lastConsumption: rec.lastConsumption };
  }

  consume(paymentId, units = this.unitsPerSwap) {
    const rec = this.payments.get(paymentId);
    if (!rec) throw new Error('paymentId unknown');
    if (rec.remaining < units) throw new Error('insufficient balance');
    rec.remaining -= units;
    rec.lastConsumption = Date.now();
    this.payments.set(paymentId, rec);
    return { paymentId, remaining: rec.remaining };
  }
}

export const x402Metering = new X402MeteringService();
