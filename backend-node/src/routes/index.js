import express from 'express';
import { query, validationResult, body } from 'express-validator';
import { x402PaymentMiddleware } from '../services/x402.js';
import { x402Metering } from '../services/x402Metering.js';
import { blockchainService } from '../services/blockchain.js';
import { priceFeedService, ASSETS } from '../services/pricefeed.js';

const router = express.Router();
const PAYMENT_STORE = new Map();
const SESSION_STORE = new Map();

// Ensure price feed background updater running
priceFeedService.start();

// Get pool information
router.get('/pool/info', async (req, res) => {
  try {
    const poolInfo = await blockchainService.getPoolInfo();
    res.json(poolInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pool statistics
router.get('/pool/stats', async (req, res) => {
  try {
    const stats = await blockchainService.getPoolStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get full reserves (alias)
router.get('/pool/reserves', async (req, res) => {
  try {
    const reserves = await blockchainService.getReserves();
    res.json({ reserves });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Spot price (on-chain)
router.get('/pool/spot-price', [query('tokenIn').isInt(), query('tokenOut').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const price = await blockchainService.getSpotPrice(parseInt(req.query.tokenIn,10), parseInt(req.query.tokenOut,10));
    return res.json({ tokenIn: req.query.tokenIn, tokenOut: req.query.tokenOut, spotPrice: price });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Tick efficiency
router.get('/pool/tick-efficiency', [query('idx').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const eff = await blockchainService.getTickEfficiency(parseInt(req.query.idx,10));
    return res.json({ idx: req.query.idx, tickEfficiency: eff });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Tick info
router.get('/pool/tick-info', [query('idx').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const info = await blockchainService.getTickInfo(parseInt(req.query.idx,10));
    return res.json(info);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// User ticks
router.get('/pool/user-ticks', [query('user').isString()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const ticks = await blockchainService.getUserTicks(req.query.user);
    return res.json({ user: req.query.user, ticks });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Session remaining
router.get('/session/remaining', [query('sessionId').isString()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const remaining = await blockchainService.getSessionRemaining(req.query.sessionId);
    return res.json({ sessionId: req.query.sessionId, remaining });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Get swap quote (query params)
router.get('/quote',
  [
    query('tokenIn').isString(),
    query('tokenOut').isString(),
    query('amountIn').isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { tokenIn, tokenOut, amountIn } = req.query;
      const quote = await blockchainService.getQuote(tokenIn, tokenOut, amountIn);
      res.json({ amountIn, amountOut: quote });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Build swap calldata (execute preparation)
router.post('/swap/execute',
  [
    body('tokenIn').isString(),
    body('tokenOut').isString(),
    body('amountIn').isString(),
  body('minAmountOut').isString(),
    body('paymentId').optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
  const { tokenIn, tokenOut, amountIn, minAmountOut, paymentId } = req.body;
      if (paymentId) {
        try {
          x402Metering.consume(paymentId, 1);
        } catch (e) {
          return res.status(402).json({ error: 'payment required or insufficient', details: e.message, code: 'PAYMENT_REQUIRED' });
        }
      }
      const { to, data, value } = blockchainService.buildSwapCalldata({
        tokenIn,
        tokenOut,
        amountIn,
        minAmountOut,
      });
      return res.json({ to, data, value, chainId: blockchainService.provider.network?.chainId || null, paymentId: paymentId || null });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// Protected swap endpoint (off-chain metered): requires paymentId in body
router.post('/swap', [body('paymentId').isString()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { paymentId } = req.body;
  try {
    x402Metering.consume(paymentId, 1);
    return res.json({ ok: true, paymentId, remaining: x402Metering.status(paymentId).remaining });
  } catch (e) {
    return res.status(402).json({ error: 'payment required or insufficient', details: e.message, code: 'PAYMENT_REQUIRED' });
  }
});

// x402 authorize: issue a paymentId with a balance of units
router.post('/x402/authorize', [body('maxUnits').optional().isInt({ min: 1, max: 100 })], async (req, res) => {
  try {
    const { maxUnits } = req.body || {};
    const auth = await x402Metering.authorize({ maxUnits: maxUnits || 5 });
    return res.json({ status: 'ok', ...auth });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// x402 payment status
router.get('/x402/status', [query('paymentId').isString()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const rec = x402Metering.status(req.query.paymentId);
  if (!rec) return res.status(404).json({ error: 'unknown paymentId' });
  return res.json(rec);
});

// Payment requirements (static placeholder)
router.get('/payment/requirements', (_req, res) => {
  return res.json({
    x402Version: 1,
    requirements: {
      scheme: 'exact',
      network: 'polygon-amoy',
      maxAmountRequired: '1000',
      description: 'Access Orbital premium APIs',
      payTo: process.env.PAYMENT_ADDRESS || '0x0',
      asset: process.env.PAYMENT_ASSET || '0x0',
      maxTimeoutSeconds: 300,
    },
  });
});

// Payment verify (decodes header only)
router.post('/payment/verify', express.json(), (req, res) => {
  const { paymentHeader } = req.body || {};
  if (!paymentHeader) return res.status(400).json({ error: 'paymentHeader required' });
  // For demo we trust header (would call facilitator.verify here)
  const paymentId = `pid_${Date.now()}`;
  PAYMENT_STORE.set(paymentId, { verified: true, ts: Date.now() });
  return res.json({ isValid: true, settlementRequired: true, paymentId });
});

// Payment settle (stub)
router.post('/payment/settle', express.json(), (req, res) => {
  const { paymentId } = req.body || {};
  if (!paymentId) return res.status(400).json({ error: 'paymentId required' });
  const rec = PAYMENT_STORE.get(paymentId);
  if (!rec) return res.status(404).json({ error: 'payment not found' });
  rec.settled = true;
  rec.txHash = '0x' + 'deadbeef'.padEnd(64, '0');
  PAYMENT_STORE.set(paymentId, rec);
  return res.json({ success: true, txHash: rec.txHash });
});

// Session status (stub)
router.get('/session/status/:id', (req, res) => {
  const id = req.params.id;
  const rec = SESSION_STORE.get(id) || { state: 'unknown' };
  return res.json({ sessionId: id, ...rec });
});

// Liquidity add (stub)
router.post('/pool/liquidity/add', express.json(), async (req, res) => {
  try {
    const { amounts, planeConstant } = req.body || {};
    if (!Array.isArray(amounts)) return res.status(400).json({ error: 'amounts array required' });
    const calldata = blockchainService.buildAddLiquidityCalldata({ amounts, planeConstant: planeConstant || '0' });
    return res.json({ calldata, note: 'Client must approve tokens & send transaction' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Liquidity remove (stub)
router.post('/pool/liquidity/remove', express.json(), async (req, res) => {
  try {
    const { idx, fraction } = req.body || {};
    if (idx === undefined || fraction === undefined) return res.status(400).json({ error: 'idx and fraction required' });
    const calldata = blockchainService.buildRemoveLiquidityCalldata({ idx, fraction });
    return res.json({ calldata, note: 'Client constructs and sends transaction' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Price feed routes
router.get('/prices', (_req, res) => {
  return res.json({ status: 'success', data: priceFeedService.prices, lastUpdate: priceFeedService.lastUpdate });
});

router.get('/price/:asset', (req, res) => {
  const key = req.params.asset;
  if (!priceFeedService.prices[key]) {
    return res.status(404).json({ status: 'error', message: 'Asset not found', available: Object.keys(ASSETS) });
  }
  return res.json({ status: 'success', asset: key, data: priceFeedService.prices[key], lastUpdate: priceFeedService.lastUpdate });
});

router.post('/price/refresh', async (_req, res) => {
  try {
    await priceFeedService.updateAll();
    return res.json({ status: 'success', data: priceFeedService.prices, lastUpdate: priceFeedService.lastUpdate });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message });
  }
});

export default router;