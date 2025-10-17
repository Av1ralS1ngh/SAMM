// Using native fetch (Node 18+)

// Asset map (pyth feed ids)
export const ASSETS = {
  'usd-coin': { id: 'eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a', symbol: 'USDC' },
  tether: { id: '2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b', symbol: 'USDT' },
  dai: { id: 'b0948a5e5313200c632b51bb5ca32f6de0d36e9950a942d19751e833f70dabfd', symbol: 'DAI' },
  pyusd: { id: '6ec879b1e9963de5ee97e9c8710b742d6228252a5e2ca12d4ae81d7fe5ee8c5d', symbol: 'PYUSD' }
};

class PriceFeedService {
  constructor({ intervalSeconds = 30 } = {}) {
    this.url = 'https://hermes.pyth.network/v2/updates/price/latest';
    this.interval = intervalSeconds * 1000;
    this.prices = {}; // assetKey -> price object
    this.lastUpdate = null;
    this.timer = null;
    this.running = false;
  }

  _parseOne(entry) {
    const priceInfo = entry.price;
    const price = Number(priceInfo.price);
    const expo = Number(priceInfo.expo);
    const scale = Math.pow(10, expo);
    const actual = price * scale;
    const confRaw = Number(priceInfo.conf ?? priceInfo.confidence ?? 0);
    const conf = confRaw * scale;
    return {
      rawPrice: price,
      expo,
      price: Number(actual.toFixed(6)),
      confidence: Number(conf.toFixed(6)),
      timestamp: priceInfo.publish_time || Math.floor(Date.now() / 1000)
    };
  }

  async fetchBatch(feedIds, { timeoutMs = 8000 } = {}) {
    const params = new URLSearchParams();
    feedIds.forEach(id => params.append('ids[]', id));
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(`${this.url}?${params.toString()}`, { signal: controller.signal });
    } finally {
      clearTimeout(t);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const parsed = data.parsed || [];
    return parsed;
  }

  async updateAll() {
    const entries = Object.entries(ASSETS);
    const ids = entries.map(([_, v]) => v.id);
    let parsed = [];
    try {
      parsed = await this.fetchBatch(ids);
      console.log(`[PriceFeed] Fetched ${parsed.length} price entries`);
    } catch (e) {
      console.warn('[PriceFeed] Batch fetch failed:', e.message);
      return;
    }
    const nowIso = new Date().toISOString();
    const updated = { ...this.prices }; // start from existing to preserve if individual missing
    for (const [key, meta] of entries) {
      const candidate = parsed.find(p => p?.id?.toLowerCase() === meta.id.toLowerCase());
      if (!candidate) continue;
      try {
        const parsedEntry = this._parseOne(candidate);
        updated[key] = { symbol: meta.symbol, feed_id: meta.id, ...parsedEntry, stale: false };
        console.log(`[PriceFeed] Updated ${key}: $${parsedEntry.price}`);
      } catch (e) {
        console.warn(`[PriceFeed] Failed to parse ${key}:`, e.message);
      }
    }
    const updatedKeys = Object.keys(updated);
    if (!updatedKeys.length) {
      if (!this.lastUpdate) {
        console.warn('[PriceFeed] Initial update produced no data (check network / feed IDs)');
      }
      return; // keep existing (possibly empty) state
    }
    this.prices = updated;
    this.lastUpdate = nowIso;
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = async () => {
      if (!this.running) return;
      try { await this.updateAll(); } catch (_) {}
      // Mark stale if older than 2 * interval
      const cutoff = Date.now() - (2 * this.interval);
      Object.keys(this.prices).forEach(k => {
        const ts = this.prices[k]?.timestamp ? this.prices[k].timestamp * 1000 : 0;
        if (ts && ts < cutoff) this.prices[k].stale = true;
      });
      this.timer = setTimeout(loop, this.interval);
    };
    loop();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
  }
}

export const priceFeedService = new PriceFeedService({ intervalSeconds: 15 });
