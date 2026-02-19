/* ============================================
   REDDIT HOT — Posts em alta por score
   Usa JSON API via CORS proxy (sem API key)
   Refresh a cada minuto para manter atualizado
   ============================================ */

const RedditHot = (() => {

    const MIN_SCORE = 100;
    const SUBS = ['worldnews', 'politics', 'news', 'technology', 'science'];
    const CORS_PROXIES = [
        url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    ];

    let cache = [];
    let callbacks = [];

    function fetchWithTimeout(url, ms = 12000) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), ms);
        return fetch(url, {
            signal: ctrl.signal,
            headers: { 'Accept': 'application/json' }
        }).finally(() => clearTimeout(t));
    }

    async function fetchSubredditHot(sub) {
        const url = `https://www.reddit.com/r/${sub}/hot.json?limit=25&raw_json=1`;
        for (const proxyFn of CORS_PROXIES) {
            try {
                const proxied = proxyFn(url);
                const r = await fetchWithTimeout(proxied, 10000);
                if (!r.ok) continue;
                const data = await r.json();
                const children = data?.data?.children || [];
                return children
                    .filter(c => c.data && !c.data.stickied)
                    .map(c => ({
                        id: c.data.id,
                        title: c.data.title,
                        subreddit: c.data.subreddit,
                        score: c.data.score || 0,
                        numComments: c.data.num_comments || 0,
                        url: c.data.url?.startsWith('http') ? c.data.url : `https://reddit.com${c.data.permalink || ''}`,
                        permalink: `https://reddit.com${c.data.permalink || ''}`,
                        created: c.data.created_utc ? new Date(c.data.created_utc * 1000) : null
                    }));
            } catch {
                continue;
            }
        }
        return [];
    }

    async function refresh() {
        const results = await Promise.allSettled(SUBS.map(sub => fetchSubredditHot(sub)));
        const all = [];
        results.forEach(r => {
            if (r.status === 'fulfilled' && Array.isArray(r.value)) all.push(...r.value);
        });

        const seen = new Set();
        const oldIds = new Set(cache.map(p => p.id));
        const now = Date.now();

        cache = all
            .filter(p => {
                if (seen.has(p.id)) return false;
                seen.add(p.id);
                return true;
            })
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, 30)
            .map(p => ({
                ...p,
                isNew: !oldIds.has(p.id),
                addedAt: oldIds.has(p.id) ? undefined : now
            }));

        callbacks.forEach(cb => { try { cb(cache); } catch {} });
        return cache;
    }

    function onUpdate(cb) {
        callbacks.push(cb);
        if (cache.length) cb(cache);
    }

    function getPosts() {
        return cache;
    }

    return { refresh, onUpdate, getPosts, MIN_SCORE };
})();
