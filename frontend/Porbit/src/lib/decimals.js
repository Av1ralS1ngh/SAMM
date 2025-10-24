// Decimal conversion helpers for tokens with variable decimals.
// Safely handles large integers via BigInt. All amounts are strings or numbers as input.

export function toWei(amount, decimals = 18) {
  if (amount === null || amount === undefined || amount === '') return '0';
  const amtStr = String(amount).trim();
  if (!/^\d*(?:\.\d*)?$/.test(amtStr)) return '0';
  const [whole, frac = ''] = amtStr.split('.');
  const padded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  try {
    const big = BigInt(whole || '0') * (10n ** BigInt(decimals)) + BigInt(padded || '0');
    return big.toString();
  } catch { return '0'; }
}

export function fromWei(raw, decimals = 18, precision = 6) {
  if (!raw) return '0';
  try {
    const big = BigInt(raw);
    const base = 10n ** BigInt(decimals);
    const whole = big / base;
    const frac = big % base;
    if (precision === 0) return whole.toString();
    const fracStr = frac.toString().padStart(decimals, '0').slice(0, precision);
    return `${whole.toString()}.${fracStr}`.replace(/\.?0+$/, '');
  } catch { return '0'; }
}

export function formatAmount(raw, decimals = 18, precision = 4) {
  return fromWei(raw, decimals, precision);
}

export function safeBN(str) {
  try { return BigInt(str); } catch { return 0n; }
}
