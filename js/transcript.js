/* ============================================
   TRANSCRIPT ANALYZER
   Full analysis pipeline for earnings calls,
   interviews, and documents
   ============================================ */

const TranscriptAnalyzer = (() => {

    function analyze(text) {
        if (!text || text.trim().length < 50) {
            return { error: 'Texto muito curto para análise. Cole uma transcrição com pelo menos 50 caracteres.' };
        }

        const summary = NLP.extractiveSummary(text, 5);
        const keywords = NLP.extractKeywords(text, 20);
        const sentiment = NLP.analyzeSentiment(text);
        const quotes = NLP.extractQuotes(text);
        const metrics = NLP.extractMetrics(text);
        const forwardLooking = NLP.detectForwardLooking(text);
        const inconsistencies = NLP.detectInconsistencies(text);
        const topics = extractTopics(text, keywords);
        const speakerAnalysis = analyzeSpeakers(text);

        return {
            summary,
            keywords,
            sentiment,
            quotes,
            metrics,
            forwardLooking,
            inconsistencies,
            topics,
            speakerAnalysis,
            stats: computeStats(text)
        };
    }

    function extractTopics(text, keywords) {
        const topicGroups = {
            'Resultados Financeiros': ['revenue', 'receita', 'earnings', 'lucro', 'profit', 'margin', 'margem', 'ebitda', 'eps', 'income', 'renda'],
            'Crescimento': ['growth', 'crescimento', 'expand', 'expansion', 'scale', 'increase', 'aumento', 'accelerate'],
            'Riscos & Desafios': ['risk', 'risco', 'challenge', 'desafio', 'headwind', 'concern', 'uncertainty', 'incerteza', 'pressure', 'pressão'],
            'Estratégia': ['strategy', 'estratégia', 'plan', 'plano', 'initiative', 'iniciativa', 'transform', 'pivot'],
            'Mercado': ['market', 'mercado', 'competition', 'competição', 'demand', 'demanda', 'consumer', 'consumidor', 'customer', 'cliente'],
            'Operações': ['operation', 'operação', 'efficiency', 'eficiência', 'cost', 'custo', 'supply', 'chain', 'cadeia'],
            'Tecnologia & Inovação': ['technology', 'tecnologia', 'innovation', 'inovação', 'digital', 'ai', 'artificial', 'cloud', 'software'],
            'Regulação & Compliance': ['regulation', 'regulação', 'compliance', 'regulatory', 'regulatório', 'government', 'governo', 'policy', 'política']
        };

        const kwSet = new Set(keywords.map(k => k.word));
        const foundTopics = [];

        for (const [topic, triggers] of Object.entries(topicGroups)) {
            const matchCount = triggers.filter(t => kwSet.has(t) || text.toLowerCase().includes(t)).length;
            if (matchCount >= 2) {
                const relatedKeywords = keywords.filter(k =>
                    triggers.some(t => k.word.includes(t) || t.includes(k.word))
                );
                foundTopics.push({
                    name: topic,
                    relevance: matchCount,
                    keywords: relatedKeywords.map(k => k.word)
                });
            }
        }

        return foundTopics.sort((a, b) => b.relevance - a.relevance);
    }

    function analyzeSpeakers(text) {
        const speakers = {};
        const lines = text.split('\n');

        const speakerPattern = /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)*|[A-Z]{2,}(?:\s[A-Z]{2,})*)\s*[:\-–—]\s*(.+)/;
        const rolePattern = /\b(CEO|CFO|COO|CTO|President|Chairman|Director|Analyst|VP|SVP|EVP)\b/i;

        for (const line of lines) {
            const match = line.match(speakerPattern);
            if (match) {
                const name = match[1].trim();
                const speech = match[2].trim();
                if (name.length > 1 && name.length < 40 && speech.length > 10) {
                    if (!speakers[name]) {
                        speakers[name] = { statements: [], wordCount: 0, role: null };
                        const roleMatch = line.match(rolePattern);
                        if (roleMatch) speakers[name].role = roleMatch[1];
                    }
                    speakers[name].statements.push(speech);
                    speakers[name].wordCount += speech.split(/\s+/).length;
                }
            }
        }

        return Object.entries(speakers)
            .map(([name, data]) => ({
                name,
                role: data.role,
                statementCount: data.statements.length,
                wordCount: data.wordCount,
                sentiment: data.statements.length > 0
                    ? NLP.analyzeSentiment(data.statements.join(' '))
                    : null
            }))
            .sort((a, b) => b.wordCount - a.wordCount)
            .slice(0, 10);
    }

    function computeStats(text) {
        const words = text.split(/\s+/).length;
        const sentences = NLP.sentenceSplit(text).length;
        const paragraphs = text.split(/\n\s*\n/).length;
        const readTime = Math.ceil(words / 200);

        return { words, sentences, paragraphs, readTime };
    }

    function renderResults(results) {
        if (results.error) {
            return `<div class="empty-state"><p>${results.error}</p></div>`;
        }

        let html = '';

        html += renderStats(results.stats);
        html += renderSummary(results.summary);
        html += renderSentiment(results.sentiment);
        html += renderTopics(results.topics);
        html += renderKeywords(results.keywords);

        if (results.metrics.length > 0) {
            html += renderMetrics(results.metrics);
        }

        if (results.quotes.length > 0) {
            html += renderQuotes(results.quotes);
        }

        if (results.forwardLooking.length > 0) {
            html += renderForwardLooking(results.forwardLooking);
        }

        if (results.inconsistencies.length > 0) {
            html += renderInconsistencies(results.inconsistencies);
        }

        if (results.speakerAnalysis.length > 0) {
            html += renderSpeakers(results.speakerAnalysis);
        }

        return html;
    }

    function renderStats(stats) {
        return `
        <div class="analysis-section fade-in">
            <div class="analysis-section-header">
                <h3><span class="as-icon">◈</span> Estatísticas do Documento</h3>
            </div>
            <div class="analysis-section-body" style="display:flex;gap:20px;flex-wrap:wrap;">
                <div style="text-align:center;flex:1;min-width:80px;">
                    <div style="font-family:var(--font-mono);font-size:22px;font-weight:700;color:var(--cyan);">${stats.words.toLocaleString()}</div>
                    <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Palavras</div>
                </div>
                <div style="text-align:center;flex:1;min-width:80px;">
                    <div style="font-family:var(--font-mono);font-size:22px;font-weight:700;color:var(--cyan);">${stats.sentences}</div>
                    <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Frases</div>
                </div>
                <div style="text-align:center;flex:1;min-width:80px;">
                    <div style="font-family:var(--font-mono);font-size:22px;font-weight:700;color:var(--cyan);">${stats.paragraphs}</div>
                    <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Parágrafos</div>
                </div>
                <div style="text-align:center;flex:1;min-width:80px;">
                    <div style="font-family:var(--font-mono);font-size:22px;font-weight:700;color:var(--cyan);">${stats.readTime}min</div>
                    <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Leitura</div>
                </div>
            </div>
        </div>`;
    }

    function renderSummary(sentences) {
        return `
        <div class="analysis-section fade-in" style="animation-delay:50ms">
            <div class="analysis-section-header">
                <h3><span class="as-icon">◧</span> Resumo Executivo</h3>
            </div>
            <div class="analysis-section-body">
                <div style="font-size:13px;line-height:1.8;color:var(--text-primary);">
                    ${sentences.map(s => `<p style="margin-bottom:8px;">${s}</p>`).join('')}
                </div>
            </div>
        </div>`;
    }

    function renderSentiment(sentiment) {
        const pWidth = sentiment.positive + sentiment.negative + sentiment.neutral;
        return `
        <div class="analysis-section fade-in" style="animation-delay:100ms">
            <div class="analysis-section-header">
                <h3><span class="as-icon">◉</span> Análise de Sentimento</h3>
                <span style="font-family:var(--font-mono);font-size:12px;color:${
                    sentiment.label.includes('Positivo') ? 'var(--green)' :
                    sentiment.label.includes('Negativo') ? 'var(--red)' : 'var(--text-secondary)'
                };font-weight:600;">${sentiment.label}</span>
            </div>
            <div class="analysis-section-body">
                <div class="sentiment-bar-container">
                    <div class="sentiment-label">
                        <span>Positivo ${sentiment.positive}%</span>
                        <span>Neutro ${sentiment.neutral}%</span>
                        <span>Negativo ${sentiment.negative}%</span>
                    </div>
                    <div class="sentiment-bar">
                        <div class="sentiment-bar-positive" style="width:${sentiment.positive / pWidth * 100}%"></div>
                        <div class="sentiment-bar-neutral" style="width:${sentiment.neutral / pWidth * 100}%"></div>
                        <div class="sentiment-bar-negative" style="width:${sentiment.negative / pWidth * 100}%"></div>
                    </div>
                </div>
                <div class="sentiment-words">
                    ${sentiment.positiveWords.map(w => `<span class="sw-positive">+${w}</span>`).join('')}
                    ${sentiment.negativeWords.map(w => `<span class="sw-negative">-${w}</span>`).join('')}
                </div>
            </div>
        </div>`;
    }

    function renderTopics(topics) {
        if (topics.length === 0) return '';
        return `
        <div class="analysis-section fade-in" style="animation-delay:150ms">
            <div class="analysis-section-header">
                <h3><span class="as-icon">⊞</span> Tópicos Identificados</h3>
                <span class="as-count">${topics.length}</span>
            </div>
            <div class="analysis-section-body">
                ${topics.map(t => `
                    <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);">
                        <div style="flex:1;">
                            <div style="font-weight:600;font-size:13px;color:var(--text-primary);">${t.name}</div>
                            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${t.keywords.join(', ')}</div>
                        </div>
                        <div style="font-family:var(--font-mono);font-size:11px;color:var(--accent);">relevância ${t.relevance}</div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    function renderKeywords(keywords) {
        const maxCount = keywords[0]?.count || 1;
        return `
        <div class="analysis-section fade-in" style="animation-delay:200ms">
            <div class="analysis-section-header">
                <h3><span class="as-icon">▤</span> Palavras-Chave</h3>
                <span class="as-count">${keywords.length}</span>
            </div>
            <div class="analysis-section-body">
                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                    ${keywords.map(k => {
                        const size = 10 + (k.count / maxCount) * 8;
                        const opacity = 0.5 + (k.count / maxCount) * 0.5;
                        return `<span style="font-family:var(--font-mono);font-size:${size}px;padding:3px 10px;
                            border-radius:12px;background:var(--accent-glow);color:var(--accent);
                            border:1px solid rgba(255,106,0,${opacity * 0.3});opacity:${opacity};">${k.word} <sup>${k.count}</sup></span>`;
                    }).join('')}
                </div>
            </div>
        </div>`;
    }

    function renderMetrics(metrics) {
        return `
        <div class="analysis-section fade-in" style="animation-delay:250ms">
            <div class="analysis-section-header">
                <h3><span class="as-icon">▲</span> Métricas Extraídas</h3>
                <span class="as-count">${metrics.length}</span>
            </div>
            <div class="analysis-section-body">
                ${metrics.map(m => `
                    <div class="metric-item">
                        <div class="metric-value">${escapeHTML(m.value)}</div>
                        <div class="metric-context">${escapeHTML(m.context)}</div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    function renderQuotes(quotes) {
        return `
        <div class="analysis-section fade-in" style="animation-delay:300ms">
            <div class="analysis-section-header">
                <h3><span class="as-icon">❝</span> Citações Relevantes</h3>
                <span class="as-count">${quotes.length}</span>
            </div>
            <div class="analysis-section-body">
                ${quotes.map(q => `
                    <div class="quote-item">
                        <div class="quote-text">"${escapeHTML(q.text)}"</div>
                        ${q.speaker ? `<div class="quote-context">— ${escapeHTML(q.speaker)}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    function renderForwardLooking(statements) {
        return `
        <div class="analysis-section fade-in" style="animation-delay:350ms">
            <div class="analysis-section-header">
                <h3><span class="as-icon">➤</span> Forward-Looking Statements</h3>
                <span class="as-count">${statements.length}</span>
            </div>
            <div class="analysis-section-body">
                ${statements.map(s => `
                    <div class="forward-item">${escapeHTML(s)}</div>
                `).join('')}
            </div>
        </div>`;
    }

    function renderInconsistencies(items) {
        return `
        <div class="analysis-section fade-in" style="animation-delay:400ms">
            <div class="analysis-section-header">
                <h3><span class="as-icon">⚠</span> Possíveis Inconsistências</h3>
                <span class="as-count">${items.length}</span>
            </div>
            <div class="analysis-section-body">
                ${items.map(item => `
                    <div class="inconsistency-item">
                        <h4>${escapeHTML(item.topic)}: ${item.values.map(v => escapeHTML(v)).join(' vs ')}</h4>
                        ${item.statements.map(s => `<p style="margin-bottom:6px;font-size:12px;">• ${escapeHTML(s.substring(0, 200))}</p>`).join('')}
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    function renderSpeakers(speakers) {
        return `
        <div class="analysis-section fade-in" style="animation-delay:450ms">
            <div class="analysis-section-header">
                <h3><span class="as-icon">◆</span> Participantes Identificados</h3>
                <span class="as-count">${speakers.length}</span>
            </div>
            <div class="analysis-section-body">
                ${speakers.map(s => `
                    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
                        <div style="width:36px;height:36px;border-radius:50%;background:var(--accent-glow);
                            display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);
                            font-size:14px;font-weight:700;color:var(--accent);flex-shrink:0;">
                            ${s.name.charAt(0)}
                        </div>
                        <div style="flex:1;">
                            <div style="font-weight:600;font-size:13px;color:var(--text-primary);">
                                ${escapeHTML(s.name)}
                                ${s.role ? `<span style="font-size:10px;color:var(--text-muted);margin-left:6px;">${escapeHTML(s.role)}</span>` : ''}
                            </div>
                            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
                                ${s.statementCount} declarações · ${s.wordCount} palavras
                                ${s.sentiment ? `· <span style="color:${
                                    s.sentiment.label.includes('Positivo') ? 'var(--green)' :
                                    s.sentiment.label.includes('Negativo') ? 'var(--red)' : 'var(--text-secondary)'
                                }">${s.sentiment.label}</span>` : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function getSampleTranscript() {
        return `EARNINGS CALL TRANSCRIPT — TechCorp Inc. Q4 2025

Operator: Good morning, ladies and gentlemen, and welcome to TechCorp's Fourth Quarter 2025 Earnings Conference Call. At this time, all participants are in a listen-only mode.

John Smith - CEO: Thank you, operator. Good morning everyone, and thank you for joining us today. I'm pleased to report that Q4 was another strong quarter for TechCorp. "We delivered record revenue of $4.2 billion, representing a 23% year-over-year increase."

Our cloud services segment continues to be the primary growth driver, with revenue reaching $2.1 billion, up 35% compared to last year. "This growth reflects the accelerating digital transformation across our enterprise customer base."

We also saw strong momentum in our AI and machine learning products. "Our AI platform now serves over 15,000 enterprise customers, up from 8,000 just twelve months ago."

Sarah Johnson - CFO: Thank you, John. Let me walk through the financial details. Total revenue for Q4 was $4.2 billion, exceeding our guidance of $3.9 billion. Gross margin expanded to 72.4%, up 180 basis points year-over-year.

Operating expenses were $2.1 billion, reflecting our continued investment in R&D and go-to-market. "We maintained disciplined spending while still investing aggressively in high-growth areas."

EBITDA came in at $1.4 billion, representing a 33% margin. Free cash flow was $1.1 billion. "We believe our strong cash generation positions us well for both organic growth and strategic acquisitions."

However, we did face some headwinds. "Supply chain constraints impacted our hardware division, resulting in a 12% decline in that segment." We expect these challenges to persist through at least the first half of 2026.

Looking ahead, we expect Q1 2026 revenue to be in the range of $4.4 billion to $4.6 billion. We anticipate full-year 2026 revenue of $19 billion to $20 billion, representing growth of 18% to 24%.

Michael Chen - Analyst, Goldman Sachs: Thank you. My question is about the AI segment. You mentioned 15,000 enterprise customers. Can you talk about the revenue per customer and how that's trending?

John Smith - CEO: Great question, Michael. "The average annual contract value for our AI platform is approximately $280,000, which has increased about 40% from a year ago." We're seeing customers expand their usage significantly as they move from pilot programs to production deployments.

"We expect AI-related revenue to reach $3 billion in 2026, which would make it roughly 15% of our total revenue." This is up from about 8% in 2025.

Lisa Park - Analyst, Morgan Stanley: I wanted to ask about margins. You mentioned gross margin of 72.4%, but earlier in the year it was 74.1%. What's driving the compression?

Sarah Johnson - CFO: Good question, Lisa. The margin compression is primarily due to mix shift. Our cloud infrastructure segment, while growing rapidly, carries lower margins than our software licensing business. "We expect margins to stabilize in the 71% to 73% range as we achieve scale efficiencies in cloud."

We're also investing heavily in data center capacity. We plan to spend approximately $3.5 billion in capex in 2026, up from $2.8 billion in 2025. "This investment is critical to meeting the strong demand we're seeing across all cloud and AI products."

John Smith - CEO: I'd also add that despite the near-term margin pressure, "we remain confident in our long-term target of 75% gross margin as our AI and software mix increases." The shift to higher-value AI services will be a significant tailwind.

Operator: That concludes our question and answer session. Thank you for joining us today.`;
    }

    return {
        analyze,
        renderResults,
        getSampleTranscript
    };

})();
