/* ============================================
   NLP ENGINE — Client-side text analysis
   Extractive summarization, keyword extraction,
   trend detection, sentiment analysis
   ============================================ */

const NLP = (() => {

    const STOP_WORDS = new Set([
        'a','about','above','after','again','against','all','am','an','and','any','are',
        "aren't",'as','at','be','because','been','before','being','below','between','both',
        'but','by','can','could','did','do','does','doing','down','during','each','few',
        'for','from','further','get','got','had','has','have','having','he','her','here',
        'hers','herself','him','himself','his','how','i','if','in','into','is','it','its',
        'itself','just','ll','me','might','more','most','must','my','myself','need','no',
        'nor','not','now','of','off','on','once','only','or','other','our','ours','ourselves',
        'out','over','own','re','s','same','she','should','so','some','such','t','than',
        'that','the','their','theirs','them','themselves','then','there','these','they',
        'this','those','through','to','too','under','until','up','ve','very','was','we',
        'were','what','when','where','which','while','who','whom','why','will','with','won',
        'would','you','your','yours','yourself','yourselves','said','also','one','two',
        'new','like','time','just','know','take','people','come','could','good','make',
        'say','get','go','see','well','way','even','back','thing','give','much',
        'o','e','de','da','do','em','um','uma','que','para','com','por','se','não','mais',
        'como','mas','ao','os','as','dos','das','na','no','nos','nas','pelo','pela','pelos',
        'pelas','ou','ser','está','foi','são','ter','seu','sua','seus','suas','isso',
        'este','esta','estes','estas','esse','essa','esses','essas','entre','depois',
        'sem','mesmo','quando','muito','já','também','só','ainda','até','ela','ele'
    ]);

    const POSITIVE_WORDS = new Set([
        'growth','increase','profit','gain','positive','strong','improve','improvement',
        'exceeded','beat','outperform','accelerate','momentum','confident','confidence',
        'optimistic','optimism','upside','opportunity','opportunities','robust','healthy',
        'resilient','record','surge','soar','rally','bullish','upgrade','recovery',
        'strength','expand','expansion','innovation','breakthrough','success','successful',
        'efficient','efficiency','synergy','synergies','favorable','dividend','return',
        'returns','progress','growing','grew','risen','higher','boost','boosted',
        'crescimento','aumento','lucro','ganho','positivo','forte','melhorar','melhoria',
        'superou','confiante','otimista','oportunidade','robusto','saudável','recorde'
    ]);

    const NEGATIVE_WORDS = new Set([
        'loss','losses','decline','decrease','negative','weak','weakness','deteriorate',
        'miss','missed','underperform','decelerate','concern','concerned','risk','risks',
        'warning','downside','challenge','challenges','headwind','headwinds','volatile',
        'volatility','uncertainty','uncertain','bearish','downgrade','recession',
        'slowdown','contraction','debt','default','bankruptcy','restructuring','layoff',
        'layoffs','cut','cuts','impairment','write-down','deficit','inflation','pressure',
        'pressures','downturn','struggling','struggle','falling','fell','lower','drop',
        'dropped','crash','plunge','slump','crisis','threat','penalty','fine','fraud',
        'perda','perdas','declínio','diminuição','negativo','fraco','fraqueza','risco',
        'riscos','incerteza','recessão','desaceleração','dívida','inflação','pressão','crise'
    ]);

    const FORWARD_LOOKING_PATTERNS = [
        /\b(we expect|we anticipate|we believe|we project|we forecast|we estimate)\b/gi,
        /\b(going forward|looking ahead|in the future|next quarter|next year|fiscal year)\b/gi,
        /\b(guidance|outlook|target|targets|goal|goals|plan|plans|strategy)\b/gi,
        /\b(will be|will continue|will increase|will decrease|will achieve|will deliver)\b/gi,
        /\b(expected to|anticipated to|projected to|estimated to|likely to)\b/gi,
        /\b(on track|remain committed|positioned to|poised to|aim to)\b/gi,
        /\b(esperamos|acreditamos|projetamos|no futuro|próximo trimestre|próximo ano)\b/gi,
        /\b(meta|metas|objetivo|objetivos|plano|planos|estratégia|perspectiva)\b/gi,
    ];

    function tokenize(text) {
        return text.toLowerCase()
            .replace(/[^\w\s'-]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2);
    }

    function sentenceSplit(text) {
        return text
            .replace(/([.!?])\s+/g, '$1|SPLIT|')
            .split('|SPLIT|')
            .map(s => s.trim())
            .filter(s => s.length > 20);
    }

    function computeTF(words) {
        const tf = {};
        const total = words.length;
        for (const w of words) {
            if (!STOP_WORDS.has(w)) {
                tf[w] = (tf[w] || 0) + 1;
            }
        }
        for (const w in tf) {
            tf[w] = tf[w] / total;
        }
        return tf;
    }

    function extractKeywords(text, topN = 15) {
        const words = tokenize(text);
        const freq = {};
        for (const w of words) {
            if (!STOP_WORDS.has(w) && w.length > 3) {
                freq[w] = (freq[w] || 0) + 1;
            }
        }
        return Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, topN)
            .map(([word, count]) => ({ word, count }));
    }

    function extractiveSummary(text, numSentences = 4) {
        const sentences = sentenceSplit(text);
        if (sentences.length <= numSentences) return sentences;

        const words = tokenize(text);
        const tf = computeTF(words);

        const scored = sentences.map((sentence, index) => {
            const sWords = tokenize(sentence);
            let score = 0;

            for (const w of sWords) {
                score += (tf[w] || 0);
            }
            score /= Math.max(sWords.length, 1);

            if (index < 3) score *= 1.4;
            if (index === sentences.length - 1) score *= 1.2;

            if (sentence.length > 40 && sentence.length < 300) score *= 1.1;

            const hasNumber = /\d+/.test(sentence);
            if (hasNumber) score *= 1.3;

            return { sentence, score, index };
        });

        scored.sort((a, b) => b.score - a.score);
        const top = scored.slice(0, numSentences);
        top.sort((a, b) => a.index - b.index);

        return top.map(t => t.sentence);
    }

    function analyzeSentiment(text) {
        const words = tokenize(text);
        let positive = 0, negative = 0, total = 0;
        const posFound = [], negFound = [];

        for (const w of words) {
            if (STOP_WORDS.has(w)) continue;
            total++;
            if (POSITIVE_WORDS.has(w)) {
                positive++;
                if (!posFound.includes(w)) posFound.push(w);
            }
            if (NEGATIVE_WORDS.has(w)) {
                negative++;
                if (!negFound.includes(w)) negFound.push(w);
            }
        }

        const neutral = total - positive - negative;
        const pPct = total > 0 ? (positive / total * 100) : 0;
        const nPct = total > 0 ? (negative / total * 100) : 0;
        const neuPct = total > 0 ? (neutral / total * 100) : 0;

        let label = 'Neutro';
        if (pPct > nPct * 1.5) label = 'Positivo';
        else if (nPct > pPct * 1.5) label = 'Negativo';
        else if (pPct > nPct) label = 'Levemente Positivo';
        else if (nPct > pPct) label = 'Levemente Negativo';

        return {
            label,
            positive: Math.round(pPct * 10) / 10,
            negative: Math.round(nPct * 10) / 10,
            neutral: Math.round(neuPct * 10) / 10,
            positiveWords: posFound.slice(0, 12),
            negativeWords: negFound.slice(0, 12),
            positiveCount: positive,
            negativeCount: negative
        };
    }

    function extractQuotes(text) {
        const quotes = [];
        const patterns = [
            /"([^"]{20,300})"/g,
            /\u201c([^\u201d]{20,300})\u201d/g,
            /"([^"]{20,300})"/g
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const quote = match[1].trim();
                if (!quotes.some(q => q.text === quote)) {
                    const idx = match.index;
                    const before = text.substring(Math.max(0, idx - 80), idx).trim();
                    const speakerMatch = before.match(/([A-Z][a-z]+ [A-Z][a-z]+|CEO|CFO|COO|CTO|President|Chairman|Director|Analyst)/);
                    quotes.push({
                        text: quote,
                        speaker: speakerMatch ? speakerMatch[0] : null,
                        position: idx
                    });
                }
            }
        }

        return quotes.slice(0, 15);
    }

    function extractMetrics(text) {
        const metrics = [];
        const patterns = [
            /(\$[\d,.]+\s*(?:billion|million|trillion|mil(?:hão|hões)?|bilhão|bilhões|trilhão|trilhões)?)\b/gi,
            /(\d+(?:\.\d+)?%)\s+([^.]{5,80})/g,
            /(?:revenue|receita|earnings|lucro|profit|EBITDA|margin|margem|EPS|growth|crescimento)\s+(?:of|de|was|foi|at)\s+([\$€R\$]?[\d,.]+\s*(?:billion|million|%|bps)?)/gi,
            /([\d,.]+)\s*(basis points|bps|percentage points|pontos percentuais)/gi,
        ];

        const sentences = sentenceSplit(text);

        for (const sentence of sentences) {
            for (const pattern of patterns) {
                pattern.lastIndex = 0;
                let match;
                while ((match = pattern.exec(sentence)) !== null) {
                    const value = match[0].trim();
                    if (value.length < 100 && !metrics.some(m => m.value === value)) {
                        metrics.push({
                            value: match[1] || value,
                            context: sentence.substring(0, 120),
                            fullSentence: sentence
                        });
                    }
                }
            }
        }

        return metrics.slice(0, 20);
    }

    function detectForwardLooking(text) {
        const statements = [];
        const sentences = sentenceSplit(text);

        for (const sentence of sentences) {
            for (const pattern of FORWARD_LOOKING_PATTERNS) {
                pattern.lastIndex = 0;
                if (pattern.test(sentence)) {
                    if (!statements.includes(sentence)) {
                        statements.push(sentence);
                    }
                    break;
                }
            }
        }

        return statements.slice(0, 12);
    }

    function detectInconsistencies(text) {
        const inconsistencies = [];
        const sentences = sentenceSplit(text);

        const numberClaims = {};
        for (const sentence of sentences) {
            const keywords = tokenize(sentence).filter(w => !STOP_WORDS.has(w));
            const numbers = sentence.match(/[\$€R\$]?[\d,.]+%?/g);
            if (!numbers) continue;

            for (const kw of keywords) {
                if (kw.length < 4) continue;
                if (!numberClaims[kw]) numberClaims[kw] = [];
                for (const num of numbers) {
                    numberClaims[kw].push({ number: num, sentence });
                }
            }
        }

        for (const [keyword, claims] of Object.entries(numberClaims)) {
            if (claims.length < 2) continue;
            const uniqueNums = [...new Set(claims.map(c => c.number))];
            if (uniqueNums.length > 1 && uniqueNums.length <= 4) {
                const relevantClaims = claims.filter((c, i, arr) =>
                    arr.findIndex(x => x.number === c.number) === i
                );
                if (relevantClaims.length >= 2) {
                    inconsistencies.push({
                        topic: keyword,
                        values: uniqueNums,
                        statements: relevantClaims.map(c => c.sentence).slice(0, 3)
                    });
                }
            }
        }

        const sentimentShifts = [];
        for (let i = 0; i < sentences.length - 1; i++) {
            const s1 = analyzeSentiment(sentences[i]);
            const s2 = analyzeSentiment(sentences[i + 1]);
            if ((s1.label.includes('Positivo') && s2.label.includes('Negativo')) ||
                (s1.label.includes('Negativo') && s2.label.includes('Positivo'))) {
                if (s1.positiveCount + s1.negativeCount > 1 && s2.positiveCount + s2.negativeCount > 1) {
                    sentimentShifts.push({
                        topic: 'Mudança de tom',
                        values: [s1.label, s2.label],
                        statements: [sentences[i], sentences[i + 1]]
                    });
                }
            }
        }

        return [...inconsistencies.slice(0, 5), ...sentimentShifts.slice(0, 3)];
    }

    function detectTrends(articles) {
        const keywordTimeline = {};
        const now = Date.now();

        for (const article of articles) {
            const text = (article.title + ' ' + (article.description || '')).toLowerCase();
            const words = tokenize(text);
            const seen = new Set();

            for (const w of words) {
                if (STOP_WORDS.has(w) || w.length < 4 || seen.has(w)) continue;
                seen.add(w);

                if (!keywordTimeline[w]) keywordTimeline[w] = { recent: 0, older: 0, total: 0 };
                keywordTimeline[w].total++;

                const age = now - (article.pubDate ? new Date(article.pubDate).getTime() : now);
                const hourAge = age / (1000 * 60 * 60);
                if (hourAge < 6) {
                    keywordTimeline[w].recent++;
                } else {
                    keywordTimeline[w].older++;
                }
            }
        }

        return Object.entries(keywordTimeline)
            .filter(([, data]) => data.total >= 3)
            .map(([word, data]) => {
                const momentum = data.older > 0
                    ? (data.recent / data.older)
                    : (data.recent > 0 ? 2 : 0);
                return {
                    word,
                    count: data.total,
                    recent: data.recent,
                    older: data.older,
                    momentum: Math.round(momentum * 100) / 100
                };
            })
            .sort((a, b) => {
                const scoreA = a.count * (1 + a.momentum);
                const scoreB = b.count * (1 + b.momentum);
                return scoreB - scoreA;
            })
            .slice(0, 20);
    }

    return {
        extractKeywords,
        extractiveSummary,
        analyzeSentiment,
        extractQuotes,
        extractMetrics,
        detectForwardLooking,
        detectInconsistencies,
        detectTrends,
        tokenize,
        sentenceSplit
    };

})();
