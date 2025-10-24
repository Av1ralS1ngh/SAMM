// Central API client for backend-node integration
// Uses fetch with JSON handling and simple error normalization.

const DEFAULT_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

function buildURL(path, params) {
  const url = new URL(path.startsWith('http') ? path : `${DEFAULT_BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.append(k, v);
  });
  return url.toString();
}

async function request(method, path, { params, body, signal } = {}) {
  const url = buildURL(path, params);
  const init = { method, headers: { 'Accept': 'application/json' } };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  if (signal) init.signal = signal;
  let res;
  try {
    res = await fetch(url, init);
  } catch (networkErr) {
    throw { type: 'network', message: networkErr.message };
  }
  let json;
  try {
    json = await res.json();
  } catch (parseErr) {
    throw { type: 'parse', status: res.status, message: 'Invalid JSON response' };
  }
  if (!res.ok) {
    throw { type: 'http', status: res.status, message: json.error || json.message || 'Request failed', data: json };
  }
  return json;
}

export const api = {
  getPoolInfo: () => request('GET', '/pool/info'),
  getPoolStats: () => request('GET', '/pool/stats'),
  getReserves: () => request('GET', '/pool/reserves'),
  getQuote: ({ tokenIn, tokenOut, amountIn }) => request('GET', '/quote', { params: { tokenIn, tokenOut, amountIn } }),
  buildSwap: ({ tokenIn, tokenOut, amountIn, minAmountOut, paymentId }) => request('POST', '/swap/execute', { body: { tokenIn, tokenOut, amountIn, minAmountOut, paymentId } }),
  protectedSwap: ({ paymentId }) => request('POST', '/swap', { body: { paymentId } }),
  addLiquidity: ({ amounts, planeConstant }) => request('POST', '/pool/liquidity/add', { body: { amounts, planeConstant } }),
  removeLiquidity: ({ idx, fraction }) => request('POST', '/pool/liquidity/remove', { body: { idx, fraction } }),
  prices: () => request('GET', '/prices'),
  price: (asset) => request('GET', `/price/${asset}`),
  refreshPrices: () => request('POST', '/price/refresh'),
  x402Authorize: ({ maxUnits }) => request('POST', '/x402/authorize', { body: { maxUnits } }),
  x402Status: ({ paymentId }) => request('GET', '/x402/status', { params: { paymentId } }),
  paymentRequirements: () => request('GET', '/payment/requirements'),
  paymentVerify: ({ paymentHeader }) => request('POST', '/payment/verify', { body: { paymentHeader } }),
  paymentSettle: ({ paymentId }) => request('POST', '/payment/settle', { body: { paymentId } }),
};

export function shortenAddress(addr, chars = 4) {
  if (!addr) return '';
  return `${addr.slice(0, 2 + chars)}...${addr.slice(-chars)}`;
}

export function formatNumber(num, decimals = 4) {
  if (num === undefined || num === null || num === '') return '0';
  const n = Number(num);
  if (Number.isNaN(n)) return String(num);
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

export { DEFAULT_BASE };
