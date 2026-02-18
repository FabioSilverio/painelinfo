/* ============================================
   MARKET DATA — USDBRL, B3, US indices, Crypto
   Free APIs: AwesomeAPI, CoinGecko, Yahoo (via proxy)
   ============================================ */

const MarketData = (() => {

    const CORS_PROXY = (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;

    const YAHOO_SYMBOLS = [
        { id: 'bvsp', name: 'Ibovespa', symbol: '^BVSP', label: 'B3' },
        { id: 'gspc', name: 'S&P 500', symbol: '^GSPC', label: 'S&P 500' },
        { id: 'dji', name: 'Dow Jones', symbol: '^DJI', label: 'Dow' },
        { id: 'ixic', name: 'Nasdaq', symbol: '^IXIC', label: 'Nasdaq' }
    ];

    let cache = {
        usdbrl: null,
        crypto: null,
        indices: null,
        updated: null
    };

    let callbacks = [];

    function notify() {
        callbacks.forEach(cb => { try { cb(cache); } catch {} });
    }

    function fetchWithTimeout(url, ms = 10000) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), ms);
        return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
    }

    async function fetchUSDBRL() {
        try {
            const r = await fetchWithTimeout('https://economia.awesomeapi.com.br/json/last/USD-BRL', 8000);
            if (!r.ok) return null;
            const data = await r.json();
            const d = data.USDBRL;
            if (!d) return null;
            return {
                bid: parseFloat(d.bid),
                ask: parseFloat(d.ask),
                high: parseFloat(d.high),
                low: parseFloat(d.low),
                pctChange: parseFloat(d.pctChange),
                updated: d.create_date || new Date().toISOString()
            };
        } catch {
            return null;
        }
    }

    async function fetchCrypto() {
        try {
            const r = await fetchWithTimeout(
                'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true',
                8000
            );
            if (!r.ok) return null;
            const data = await r.json();
            return [
                { id: 'btc', name: 'BTC', price: data.bitcoin?.usd ?? 0, change24: data.bitcoin?.usd_24h_change ?? 0 },
                { id: 'eth', name: 'ETH', price: data.ethereum?.usd ?? 0, change24: data.ethereum?.usd_24h_change ?? 0 },
                { id: 'sol', name: 'SOL', price: data.solana?.usd ?? 0, change24: data.solana?.usd_24h_change ?? 0 }
            ];
        } catch {
            return null;
        }
    }

    async function fetchYahooIndices() {
        const results = [];
        for (const { id, name, symbol, label } of YAHOO_SYMBOLS) {
            try {
                const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
                const r = await fetchWithTimeout(CORS_PROXY(url), 10000);
                if (!r.ok) continue;
                const data = await r.json();
                const chart = data?.chart?.result?.[0];
                if (!chart) continue;
                const meta = chart.meta || {};
                const quote = chart.indicators?.quote?.[0];
                const current = meta.regularMarketPrice ?? (quote?.close?.filter(Boolean).pop()) ?? 0;
                const previous = meta.previousClose ?? meta.chartPreviousClose ?? current;
                const pct = previous ? ((current - previous) / previous) * 100 : 0;
                results.push({
                    id,
                    name: label,
                    fullName: name,
                    price: Math.round(current * 10) / 10,
                    changePct: Math.round(pct * 100) / 100
                });
            } catch {
                results.push({ id, name: label, fullName: name, price: null, changePct: null });
            }
        }
        return results;
    }

    async function refresh() {
        const [usdbrl, crypto, indices] = await Promise.all([
            fetchUSDBRL(),
            fetchCrypto(),
            fetchYahooIndices()
        ]);
        cache = {
            usdbrl: usdbrl || cache.usdbrl,
            crypto: crypto || cache.crypto,
            indices: indices?.length ? indices : cache.indices,
            updated: new Date()
        };
        notify();
        return cache;
    }

    function onUpdate(cb) {
        callbacks.push(cb);
        if (cache.updated) cb(cache);
    }

    function getCache() {
        return cache;
    }

    return { refresh, onUpdate, getCache };
})();
