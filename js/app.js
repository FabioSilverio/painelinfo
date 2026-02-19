/* ============================================
   APP CONTROLLER
   Navigation, rendering, event handling
   ============================================ */

(function() {

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    let currentView = 'dashboard';
    let selectedArticle = null;
    let selectedSource = 'all';
    let searchQuery = '';
    let refreshInterval = null;

    // ---- INIT ----

    let marketRefreshInterval = null;
    let feedsLoading = false;

    function init() {
        setupNavigation();
        setupClock();
        setupFeedControls();
        setupMarketControls();
        setupTranscriptControls();
        setupModal();
        FeedEngine.onUpdate(handleFeedUpdate);
        MarketData.onUpdate(renderMarket);
        RedditHot.onUpdate(renderReddit);
        loadFeeds();
        MarketData.refresh();
        RedditHot.refresh();
        setupRedditControls();
        refreshInterval = setInterval(loadFeeds, 60000);
        marketRefreshInterval = setInterval(() => MarketData.refresh(), 2000);
        setInterval(() => RedditHot.refresh(), 60000);
        setInterval(() => {
            renderLiveFeed();
            if (currentView === 'feeds') renderFeedsList();
        }, 60000);
    }

    // ---- NAVIGATION ----

    function setupNavigation() {
        $$('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                switchView(view);
            });
        });
    }

    function switchView(view) {
        currentView = view;
        $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
        $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));

        if (view === 'feeds') renderFeedsList();
    }

    // ---- CLOCK ----

    function setupClock() {
        function tick() {
            const now = new Date();
            $('#clock').textContent = now.toLocaleTimeString('pt-BR', {
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
        }
        tick();
        setInterval(tick, 1000);
    }

    // ---- FEEDS ----

    async function loadFeeds() {
        if (feedsLoading) return;
        feedsLoading = true;
        setStatus('CARREGANDO', 'loading');
        try {
            await FeedEngine.fetchAllFeeds();
            setStatus('AO VIVO', 'online');
        } catch {
            setStatus('ERRO', 'error');
        } finally {
            feedsLoading = false;
        }
    }

    function setStatus(text, state) {
        $('#feed-status').textContent = text;
        const dot = $('.status-dot');
        dot.className = 'status-dot';
        if (state === 'online') dot.classList.add('pulse');
        else if (state === 'error') dot.classList.add('error');
        else if (state === 'loading') dot.classList.add('loading');
    }

    function handleFeedUpdate() {
        renderSources();
        renderLiveFeed();
        renderTrends();
        renderFeedFilter();
        if (currentView === 'feeds') renderFeedsList();
    }

    // ---- REDDIT EM ALTA ----

    function setupRedditControls() {
        const btn = $('#btn-refresh-reddit');
        if (btn) btn.addEventListener('click', () => RedditHot.refresh());
    }

    function renderReddit(posts) {
        const container = $('#reddit-container');
        const countEl = $('#reddit-count');
        if (!container) return;
        if (countEl) countEl.textContent = posts ? posts.length : 0;
        if (!posts || posts.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>Nenhum post em alta no momento. Tente atualizar.</p></div>';
            return;
        }
        container.innerHTML = posts.map(p => {
            const timeAgo = p.created ? FeedEngine.formatTimeAgo(p.created) : '';
            return `
            <a class="reddit-post-item" href="${escapeHTML(p.permalink)}" target="_blank" rel="noopener">
                <div class="reddit-post-meta">
                    <span class="reddit-sub">r/${escapeHTML(p.subreddit)}</span>
                    <span class="reddit-score"><strong>${p.score.toLocaleString()}</strong> pts · ${p.numComments} coment.${timeAgo ? ' · ' + timeAgo : ''}</span>
                </div>
                <div class="reddit-post-title">${escapeHTML(p.title)}</div>
            </a>
        `}).join('');
    }

    function setupFeedControls() {
        $('#btn-refresh').addEventListener('click', () => {
            loadFeeds();
        });

        $('#feed-filter').addEventListener('change', (e) => {
            selectedSource = e.target.value;
            renderLiveFeed();
        });

        if ($('#feed-search')) {
            $('#feed-search').addEventListener('input', (e) => {
                searchQuery = e.target.value;
                renderFeedsList();
            });
        }
    }

    // ---- MARKET / COTAÇÕES ----

    function setupMarketControls() {
        const btn = $('#btn-refresh-market');
        if (btn) btn.addEventListener('click', () => MarketData.refresh());
    }

    function renderMarket(cache) {
        const container = $('#market-container');
        if (!container) return;

        const parts = [];

        if (cache.usdbrl) {
            const u = cache.usdbrl;
            const changeClass = u.pctChange > 0 ? 'up' : u.pctChange < 0 ? 'down' : 'neutral';
            parts.push(`
                <div class="market-usdbrl">
                    <div>
                        <div class="main">R$ ${u.bid.toFixed(4)}</div>
                        <div class="sub">USD/BRL · Compra</div>
                    </div>
                    <div style="text-align:right;">
                        <span class="market-change ${changeClass}">${u.pctChange >= 0 ? '+' : ''}${u.pctChange.toFixed(2)}%</span>
                        <div class="sub">Máx R$ ${u.high.toFixed(2)} · Mín R$ ${u.low.toFixed(2)}</div>
                    </div>
                </div>
            `);
        }

        if (cache.indices && cache.indices.length) {
            parts.push('<div class="market-section"><div class="market-section-title">B3 & EUA</div>');
            cache.indices.forEach(idx => {
                const changeClass = idx.changePct == null ? 'neutral' : idx.changePct > 0 ? 'up' : idx.changePct < 0 ? 'down' : 'neutral';
                const value = idx.price != null ? idx.price.toLocaleString('pt-BR') : '—';
                const change = idx.changePct != null ? (idx.changePct >= 0 ? '+' : '') + idx.changePct + '%' : '—';
                parts.push(`
                    <div class="market-row">
                        <span class="market-label">${idx.name}</span>
                        <span class="market-value">${value}</span>
                        <span class="market-change ${changeClass}">${change}</span>
                    </div>
                `);
            });
            parts.push('</div>');
        }

        if (cache.crypto && cache.crypto.length) {
            parts.push('<div class="market-section"><div class="market-section-title">Crypto</div>');
            cache.crypto.forEach(c => {
                const changeClass = c.change24 > 0 ? 'up' : c.change24 < 0 ? 'down' : 'neutral';
                const priceStr = c.price >= 1000 ? c.price.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : c.price.toFixed(2);
                parts.push(`
                    <div class="market-row">
                        <span class="market-label">${c.name}</span>
                        <span class="market-value">$${priceStr}</span>
                        <span class="market-change ${changeClass}">${(c.change24 >= 0 ? '+' : '') + c.change24.toFixed(2)}%</span>
                    </div>
                `);
            });
            parts.push('</div>');
        }

        if (cache.updated) {
            parts.push(`<div class="market-updated">Atualizado ${cache.updated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>`);
        }

        if (parts.length === 0) {
            container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Carregando cotações...</p></div>';
        } else {
            container.innerHTML = parts.join('');
        }
    }

    // ---- RENDER: SOURCES ----

    function renderSources() {
        const statuses = FeedEngine.getSourceStatus();
        const container = $('#sources-container');
        container.innerHTML = statuses.map(s => `
            <div class="source-item">
                <span class="source-dot ${s.status}"></span>
                <span class="source-name">${s.name}</span>
                <span class="source-count">${s.count > 0 ? s.count + ' artigos' : s.status === 'loading' ? '...' : 'offline'}</span>
            </div>
        `).join('');

        const sourceList = $('#source-list');
        if (sourceList) {
            sourceList.innerHTML = `
                <button class="source-filter-btn ${selectedSource === 'all' ? 'active' : ''}" data-source="all">
                    <span class="source-filter-dot" style="background:var(--accent)"></span>
                    Todas
                    <span class="source-filter-count">${FeedEngine.getArticles().length}</span>
                </button>
                ${statuses.filter(s => s.count > 0).map(s => `
                    <button class="source-filter-btn ${selectedSource === s.id ? 'active' : ''}" data-source="${s.id}">
                        <span class="source-filter-dot" style="background:${s.color}"></span>
                        ${s.name}
                        <span class="source-filter-count">${s.count}</span>
                    </button>
                `).join('')}
            `;

            sourceList.querySelectorAll('.source-filter-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedSource = btn.dataset.source;
                    sourceList.querySelectorAll('.source-filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    renderFeedsList();
                });
            });
        }
    }

    function renderFeedFilter() {
        const select = $('#feed-filter');
        const statuses = FeedEngine.getSourceStatus().filter(s => s.count > 0);
        const current = select.value;
        select.innerHTML = `<option value="all">Todas as Fontes</option>` +
            statuses.map(s => `<option value="${s.id}">${s.name} (${s.count})</option>`).join('');
        select.value = current;
    }

    // ---- RENDER: LIVE FEED (Dashboard) ----

    function renderLiveFeed() {
        const articles = FeedEngine.getArticles(selectedSource);
        const container = $('#livefeed-container');

        if (articles.length === 0) {
            container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Carregando feeds...</p></div>`;
            return;
        }

        const now = Date.now();
        const NEW_BADGE_MS = 2 * 60 * 1000;
        container.innerHTML = articles.slice(0, 50).map((a, i) => {
            const isNew = a.addedAt && (now - a.addedAt) < NEW_BADGE_MS;
            return `
            <div class="feed-card unread" data-id="${a.id}" style="--i:${i}">
                <div class="feed-card-header">
                    <span class="feed-source-tag ${a.source.tagClass}">${a.source.name}</span>
                    ${isNew ? '<span class="feed-badge-new">Novo</span>' : ''}
                    <span class="feed-time">${FeedEngine.formatTimeAgo(a.pubDate)}</span>
                </div>
                <div class="feed-card-title">${escapeHTML(a.title)}</div>
                ${a.description ? `<div class="feed-card-excerpt">${escapeHTML(a.description.substring(0, 150))}</div>` : ''}
            </div>
        `}).join('');

        container.querySelectorAll('.feed-card').forEach(card => {
            card.addEventListener('click', () => {
                const article = articles.find(a => a.id === card.dataset.id);
                if (article) showArticleSummary(article);
            });
        });
    }

    // ---- RENDER: TRENDS ----

    function renderTrends() {
        const articles = FeedEngine.getArticles();
        if (articles.length === 0) return;

        const trends = NLP.detectTrends(articles);
        const container = $('#trends-container');
        const countBadge = $('#trend-count');

        countBadge.textContent = trends.length;

        if (trends.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>Aguardando dados suficientes...</p></div>';
            return;
        }

        const maxCount = trends[0]?.count || 1;

        container.innerHTML = trends.map((t, i) => `
            <div class="trend-item">
                <span class="trend-rank">${String(i + 1).padStart(2, '0')}</span>
                <div class="trend-info">
                    <div class="trend-keyword">${escapeHTML(t.word)}</div>
                    <div class="trend-meta">${t.count} menções · ${t.recent} recentes</div>
                </div>
                <div class="trend-bar">
                    <div class="trend-bar-fill" style="width:${(t.count / maxCount * 100)}%"></div>
                </div>
                <span class="trend-change ${t.momentum > 1 ? 'up' : t.momentum < 0.5 ? 'down' : ''}">
                    ${t.momentum > 1 ? '▲' : t.momentum < 0.5 ? '▼' : '—'}
                </span>
            </div>
        `).join('');
    }

    // ---- RENDER: ARTICLE SUMMARY (Dashboard sidebar) ----

    function showArticleSummary(article) {
        selectedArticle = article;
        const container = $('#summary-container');
        const text = article.title + '. ' + (article.description || '');
        const summary = NLP.extractiveSummary(text, 3);
        const keywords = NLP.extractKeywords(text, 8);
        const sentiment = NLP.analyzeSentiment(text);

        container.innerHTML = `
            <div class="summary-section fade-in">
                <h3>Título</h3>
                <div class="summary-text" style="font-weight:600;">${escapeHTML(article.title)}</div>
            </div>
            <div class="summary-section fade-in" style="animation-delay:50ms">
                <h3>Fonte · ${FeedEngine.formatTimeAgo(article.pubDate)}</h3>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span class="feed-source-tag ${article.source.tagClass}">${article.source.name}</span>
                    ${article.creator ? `<span style="font-size:11px;color:var(--text-muted);">${escapeHTML(article.creator)}</span>` : ''}
                </div>
            </div>
            <div class="summary-section fade-in" style="animation-delay:100ms">
                <h3>Resumo</h3>
                <div class="summary-text">${summary.map(s => escapeHTML(s)).join(' ')}</div>
            </div>
            <div class="summary-section fade-in" style="animation-delay:150ms">
                <h3>Sentimento: ${sentiment.label}</h3>
                <div class="sentiment-bar" style="margin-bottom:8px">
                    <div class="sentiment-bar-positive" style="width:${sentiment.positive}%"></div>
                    <div class="sentiment-bar-neutral" style="width:${sentiment.neutral}%"></div>
                    <div class="sentiment-bar-negative" style="width:${sentiment.negative}%"></div>
                </div>
            </div>
            <div class="summary-section fade-in" style="animation-delay:200ms">
                <h3>Palavras-chave</h3>
                <div class="summary-keywords">
                    ${keywords.map(k => `<span class="summary-keyword">${escapeHTML(k.word)}</span>`).join('')}
                </div>
            </div>
            ${article.link ? `
                <a href="${escapeHTML(article.link)}" target="_blank" rel="noopener" class="article-link fade-in" style="animation-delay:250ms">
                    ↗ Ler artigo completo
                </a>
            ` : ''}
        `;
    }

    // ---- RENDER: FEEDS LIST (Feed Reader view) ----

    function renderFeedsList() {
        const articles = FeedEngine.getArticles(selectedSource, searchQuery);
        const container = $('#feeds-list-container');

        if (articles.length === 0) {
            container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Carregando artigos...</p></div>`;
            return;
        }

        container.innerHTML = articles.slice(0, 100).map((a, i) => `
            <div class="feed-list-item ${selectedArticle?.id === a.id ? 'selected' : ''}" data-id="${a.id}" style="animation: fadeIn 0.2s ease forwards; animation-delay: ${i * 20}ms; opacity: 0;">
                <div class="feed-card-header">
                    <span class="feed-source-tag ${a.source.tagClass}">${a.source.name}</span>
                    <span class="feed-time">${FeedEngine.formatTimeAgo(a.pubDate)}</span>
                </div>
                <div class="feed-card-title">${escapeHTML(a.title)}</div>
                ${a.description ? `<div class="feed-card-excerpt">${escapeHTML(a.description.substring(0, 200))}</div>` : ''}
            </div>
        `).join('');

        container.querySelectorAll('.feed-list-item').forEach(item => {
            item.addEventListener('click', () => {
                const article = articles.find(a => a.id === item.dataset.id);
                if (article) {
                    selectedArticle = article;
                    container.querySelectorAll('.feed-list-item').forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');
                    showArticleDetail(article);
                }
            });
        });
    }

    function showArticleDetail(article) {
        const detail = $('#article-detail');
        const text = article.title + '. ' + (article.description || '');
        const summary = NLP.extractiveSummary(text, 3);
        const keywords = NLP.extractKeywords(text, 10);
        const sentiment = NLP.analyzeSentiment(text);

        detail.innerHTML = `
            <div class="fade-in">
                <div class="article-detail-title">${escapeHTML(article.title)}</div>
                <div class="article-detail-meta">
                    <span class="feed-source-tag ${article.source.tagClass}">${article.source.name}</span>
                    <span style="font-size:12px;color:var(--text-muted);">
                        ${article.pubDate ? article.pubDate.toLocaleString('pt-BR') : ''}
                    </span>
                    ${article.creator ? `<span style="font-size:12px;color:var(--text-secondary);">${escapeHTML(article.creator)}</span>` : ''}
                </div>

                <div class="article-detail-summary">
                    <h4>◧ Resumo Automático</h4>
                    <p style="font-size:13px;line-height:1.7;color:var(--text-primary);">
                        ${summary.map(s => escapeHTML(s)).join(' ')}
                    </p>
                </div>

                <div class="article-detail-summary" style="margin-bottom:20px;">
                    <h4>◉ Sentimento: ${sentiment.label}</h4>
                    <div class="sentiment-bar" style="margin:10px 0;">
                        <div class="sentiment-bar-positive" style="width:${sentiment.positive}%"></div>
                        <div class="sentiment-bar-neutral" style="width:${sentiment.neutral}%"></div>
                        <div class="sentiment-bar-negative" style="width:${sentiment.negative}%"></div>
                    </div>
                    <div class="sentiment-words">
                        ${sentiment.positiveWords.map(w => `<span class="sw-positive">+${w}</span>`).join('')}
                        ${sentiment.negativeWords.map(w => `<span class="sw-negative">-${w}</span>`).join('')}
                    </div>
                </div>

                <div class="article-detail-summary">
                    <h4>▤ Palavras-chave</h4>
                    <div class="summary-keywords" style="margin-top:8px;">
                        ${keywords.map(k => `<span class="summary-keyword">${escapeHTML(k.word)}</span>`).join('')}
                    </div>
                </div>

                <div class="article-detail-body">
                    ${article.description ? `<p>${escapeHTML(article.description)}</p>` : '<p style="color:var(--text-muted);">Conteúdo completo disponível no site original.</p>'}
                </div>

                ${article.link ? `
                    <a href="${escapeHTML(article.link)}" target="_blank" rel="noopener" class="article-link">
                        ↗ Ler artigo completo no ${article.source.name}
                    </a>
                ` : ''}
            </div>
        `;
    }

    // ---- TRANSCRIPT ----

    function setupTranscriptControls() {
        $('#btn-analyze').addEventListener('click', () => {
            const text = $('#transcript-input').value;
            runTranscriptAnalysis(text);
        });

        $('#btn-clear-transcript').addEventListener('click', () => {
            $('#transcript-input').value = '';
            $('#transcript-results').innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">◇</div>
                    <h3>Análise de Transcrições</h3>
                    <p>Cole uma transcrição e clique em "Analisar"</p>
                </div>
            `;
        });

        $('#btn-sample').addEventListener('click', () => {
            $('#transcript-input').value = TranscriptAnalyzer.getSampleTranscript();
        });
    }

    function runTranscriptAnalysis(text) {
        const container = $('#transcript-results');
        container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Analisando transcrição...</p></div>`;

        setTimeout(() => {
            const results = TranscriptAnalyzer.analyze(text);
            container.innerHTML = TranscriptAnalyzer.renderResults(results);
        }, 300);
    }

    // ---- MODAL ----

    function setupModal() {
        const modal = $('#article-modal');
        const backdrop = modal.querySelector('.modal-backdrop');
        const closeBtn = $('#modal-close');

        backdrop.addEventListener('click', () => modal.classList.add('hidden'));
        closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') modal.classList.add('hidden');
        });
    }

    // ---- UTILS ----

    function escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ---- KEYBOARD SHORTCUTS ----

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === '1') switchView('dashboard');
        if (e.key === '2') switchView('feeds');
        if (e.key === '3') switchView('transcript');
        if (e.key === 'r' && !e.ctrlKey && !e.metaKey) loadFeeds();
    });

    // ---- START ----

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
