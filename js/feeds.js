/* ============================================
   RSS FEED ENGINE
   Fetches, parses, and aggregates financial feeds
   Uses free CORS proxies — no API keys needed
   ============================================ */

const FeedEngine = (() => {

    const CORS_PROXIES = [
        url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
        url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
        url => `https://thingproxy.freeboard.io/fetch/${url}`,
    ];

    const RSS2JSON_API = 'https://api.rss2json.com/v1/api.json?rss_url=';

    const FEED_SOURCES = [
        {
            id: 'yahoo',
            name: 'Yahoo Finance',
            url: 'https://finance.yahoo.com/news/rssindex',
            color: '#7b1fa2',
            tagClass: 'yahoo'
        },
        {
            id: 'cnbc',
            name: 'CNBC',
            url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114',
            color: '#1565c0',
            tagClass: 'cnbc'
        },
        {
            id: 'marketwatch',
            name: 'MarketWatch',
            url: 'https://feeds.marketwatch.com/marketwatch/topstories/',
            color: '#2e7d32',
            tagClass: 'marketwatch'
        },
        {
            id: 'bbc',
            name: 'BBC Business',
            url: 'https://feeds.bbci.co.uk/news/business/rss.xml',
            color: '#b71c1c',
            tagClass: 'bbc'
        },
        {
            id: 'nyt',
            name: 'NYT Business',
            url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',
            color: '#e65100',
            tagClass: 'nyt'
        },
        {
            id: 'google',
            name: 'Google Finance',
            url: 'https://news.google.com/rss/search?q=finance+stock+market+economy&hl=en&gl=US&ceid=US:en',
            color: '#0277bd',
            tagClass: 'google'
        },
        {
            id: 'investing',
            name: 'Investing.com',
            url: 'https://www.investing.com/rss/news.rss',
            color: '#00695c',
            tagClass: 'investing'
        },
        {
            id: 'seekingalpha',
            name: 'Seeking Alpha',
            url: 'https://seekingalpha.com/market_currents.xml',
            color: '#ef6c00',
            tagClass: 'seekingalpha'
        },
        /* Notícias gerais e internacionais */
        {
            id: 'bbcworld',
            name: 'BBC World',
            url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
            color: '#b71c1c',
            tagClass: 'bbc'
        },
        {
            id: 'guardian',
            name: 'The Guardian World',
            url: 'https://www.theguardian.com/world/rss',
            color: '#052962',
            tagClass: 'guardian'
        },
        {
            id: 'politico',
            name: 'Politico',
            url: 'https://rss.politico.com/politics-news.xml',
            color: '#e71b23',
            tagClass: 'politico'
        },
        {
            id: 'reuters',
            name: 'Reuters',
            url: 'https://www.reuters.com/world/rss',
            color: '#e65100',
            tagClass: 'reuters'
        },
        {
            id: 'aljazeera',
            name: 'Al Jazeera',
            url: 'https://www.aljazeera.com/xml/rss/all.xml',
            color: '#005f80',
            tagClass: 'aljazeera'
        },
        {
            id: 'apnews',
            name: 'AP News',
            url: 'https://apnews.com/apf-topnews',
            color: '#333',
            tagClass: 'ap'
        },
        {
            id: 'npr',
            name: 'NPR News',
            url: 'https://feeds.npr.org/1001/rss.xml',
            color: '#c62b28',
            tagClass: 'npr'
        }
    ];

    let allArticles = [];
    let sourceStatus = {};
    let currentProxyIndex = 0;
    let fetchCallbacks = [];

    function fetchWithTimeout(url, ms = 15000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), ms);
        return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
    }

    async function fetchViaRSS2JSON(feedUrl, source) {
        try {
            const resp = await fetchWithTimeout(`${RSS2JSON_API}${encodeURIComponent(feedUrl)}`, 12000);
            if (!resp.ok) return null;
            const data = await resp.json();
            if (data.status !== 'ok' || !data.items) return null;

            const now = Date.now();
            return data.items.map(item => ({
                id: `${source.id}-${hashString(item.title || '')}`,
                title: cleanHTML(item.title || ''),
                link: item.link || '',
                description: cleanHTML(item.description || '').substring(0, 500),
                pubDate: parsePubDate(item) || new Date(now - 3600000),
                source: source,
                creator: item.author || '',
                read: false,
                addedAt: null
            })).filter(a => a.title);
        } catch {
            return null;
        }
    }

    async function fetchWithFallback(url) {
        for (let i = 0; i < CORS_PROXIES.length; i++) {
            const proxyFn = CORS_PROXIES[(currentProxyIndex + i) % CORS_PROXIES.length];
            try {
                const proxyUrl = proxyFn(url);
                const resp = await fetchWithTimeout(proxyUrl, 12000);
                if (!resp.ok) continue;
                const text = await resp.text();
                if (text.length < 100) continue;
                return text;
            } catch {
                continue;
            }
        }
        return null;
    }

    function parseRSS(xmlText, source) {
        const articles = [];
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlText, 'text/xml');

            const parseError = doc.querySelector('parsererror');
            if (parseError) {
                const htmlDoc = parser.parseFromString(xmlText, 'text/html');
                const items = htmlDoc.querySelectorAll('item');
                if (items.length === 0) return [];
            }

            let items = doc.querySelectorAll('item');
            if (items.length === 0) {
                items = doc.querySelectorAll('entry');
            }

            items.forEach((item, idx) => {
                if (idx > 30) return;

                const title = getTextContent(item, 'title');
                const link = getTextContent(item, 'link') || getAttr(item, 'link', 'href');
                const description = cleanHTML(getTextContent(item, 'description') || getTextContent(item, 'summary') || getTextContent(item, 'content'));
                const pubDate = getTextContent(item, 'pubDate') || getTextContent(item, 'published') || getTextContent(item, 'updated');
                const creator = getTextContent(item, 'dc:creator') || getTextContent(item, 'author');

                if (title) {
                    let parsed = pubDate ? (() => { const d = new Date(pubDate); return isNaN(d.getTime()) ? null : d; })() : null;
                    const fallbackDate = new Date(Date.now() - 3600000);
                    if (parsed && parsed.getTime() > Date.now()) parsed = new Date(Date.now() - 60000);
                    articles.push({
                        id: `${source.id}-${hashString(title)}`,
                        title: cleanHTML(title),
                        link,
                        description: description ? description.substring(0, 500) : '',
                        pubDate: parsed || fallbackDate,
                        source: source,
                        creator,
                        read: false,
                        addedAt: null
                    });
                }
            });
        } catch (e) {
            console.warn(`Parse error for ${source.name}:`, e);
        }
        return articles;
    }

    function getTextContent(parent, tagName) {
        const el = parent.querySelector(tagName);
        return el ? el.textContent.trim() : '';
    }

    function getAttr(parent, tagName, attr) {
        const el = parent.querySelector(tagName);
        return el ? el.getAttribute(attr) : '';
    }

    function cleanHTML(html) {
        if (!html) return '';
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent.trim().replace(/\s+/g, ' ');
    }

    function hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return Math.abs(hash).toString(36);
    }

    function parsePubDate(item) {
        const raw = item.pubDate || item.published || item.updated || item.date;
        if (!raw || typeof raw !== 'string') return null;
        const d = new Date(raw.trim());
        if (isNaN(d.getTime())) return null;
        const now = Date.now();
        if (d.getTime() > now) {
            return new Date(now - 60000);
        }
        return d;
    }

    async function fetchSource(source) {
        sourceStatus[source.id] = { status: 'loading', count: 0 };
        notifyCallbacks();

        let articles = await fetchViaRSS2JSON(source.url, source);

        if (!articles || articles.length === 0) {
            const xml = await fetchWithFallback(source.url);
            if (xml) {
                articles = parseRSS(xml, source);
            }
        }

        if (!articles || articles.length === 0) {
            sourceStatus[source.id] = { status: 'offline', count: 0 };
            notifyCallbacks();
            return [];
        }

        sourceStatus[source.id] = {
            status: 'online',
            count: articles.length
        };
        notifyCallbacks();
        return articles;
    }

    async function fetchAllFeeds() {
        for (const s of FEED_SOURCES) {
            sourceStatus[s.id] = { status: 'loading', count: 0 };
        }
        notifyCallbacks();

        const results = await Promise.allSettled(
            FEED_SOURCES.map(source => fetchSource(source))
        );

        const newArticles = [];
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
                newArticles.push(...result.value);
            }
        });

        const byId = new Map(allArticles.map(a => [a.id, a]));
        const now = Date.now();
        for (const article of newArticles) {
            const existing = byId.get(article.id);
            if (existing) {
                existing.pubDate = article.pubDate;
                existing.title = article.title;
                existing.description = article.description;
                existing.link = article.link;
            } else {
                if (!article.addedAt) article.addedAt = now;
                byId.set(article.id, article);
            }
        }
        allArticles = Array.from(byId.values());

        allArticles.sort((a, b) => b.pubDate - a.pubDate);

        if (allArticles.length > 500) {
            allArticles = allArticles.slice(0, 500);
        }

        notifyCallbacks();
        return allArticles;
    }

    function getArticles(filter = 'all', search = '') {
        let filtered = allArticles;
        if (filter !== 'all') {
            filtered = filtered.filter(a => a.source.id === filter);
        }
        if (search) {
            const q = search.toLowerCase();
            filtered = filtered.filter(a =>
                a.title.toLowerCase().includes(q) ||
                (a.description && a.description.toLowerCase().includes(q))
            );
        }
        return filtered;
    }

    function getSourceStatus() {
        return FEED_SOURCES.map(s => ({
            ...s,
            ...(sourceStatus[s.id] || { status: 'loading', count: 0 })
        }));
    }

    function getSources() {
        return FEED_SOURCES;
    }

    function onUpdate(callback) {
        fetchCallbacks.push(callback);
    }

    function notifyCallbacks() {
        for (const cb of fetchCallbacks) {
            try { cb(); } catch {}
        }
    }

    function formatTimeAgo(date) {
        if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '—';
        const now = new Date();
        let diff = now - date;
        if (diff < 0) return '1 min';
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (mins < 1) return 'agora';
        if (mins < 60) return `${mins} min`;
        if (hours < 24) return `${hours}h`;
        if (days < 7) return `${days}d`;
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    }

    return {
        fetchAllFeeds,
        getArticles,
        getSourceStatus,
        getSources,
        onUpdate,
        formatTimeAgo,
        FEED_SOURCES
    };

})();
