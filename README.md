# RA Terminal — Research Assistant

Personal research assistant with real-time financial RSS feed aggregation, automatic NLP summaries, trend detection, and transcript analysis. All client-side, no API keys, free to use.

## Features

### Dashboard
- Real-time financial news from 8 sources (Yahoo Finance, CNBC, MarketWatch, BBC Business, NYT Business, Google Finance, Investing.com, Seeking Alpha)
- Emerging trend detection with momentum indicators
- Click any article for instant auto-summary, sentiment analysis, and keyword extraction

### Feed Reader
- Full article list with source filtering and search
- Detailed article view with NLP-powered analysis
- Direct links to original sources

### Transcript Analyzer
- Paste any earnings call, interview, or document
- Automatic extractive summarization
- Sentiment analysis (positive/negative/neutral with word-level breakdown)
- Quote extraction with speaker attribution
- Financial metric extraction ($, %, basis points)
- Forward-looking statement detection
- Inconsistency detection across claims
- Speaker analysis with per-speaker sentiment
- Topic clustering

## Tech Stack

- **Pure HTML/CSS/JS** — no frameworks, no build tools
- **Client-side NLP** — extractive summarization, TF-IDF keyword scoring, sentiment lexicon
- **RSS via CORS proxies** — rss2json.com + allorigins + fallbacks
- **Zero cost** — no APIs, no backend, no subscriptions

## Deploy to GitHub Pages

1. Create a new repository on GitHub
2. Push this code:
   ```bash
   cd research-assistant
   git init
   git add .
   git commit -m "Initial commit — RA Terminal"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/research-assistant.git
   git push -u origin main
   ```
3. Go to **Settings > Pages** in your repository
4. Under "Source", select **Deploy from a branch**
5. Select **main** branch, root folder `/`
6. Click **Save**
7. Your site will be live at `https://YOUR_USERNAME.github.io/research-assistant/`

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | Switch to Dashboard |
| `2` | Switch to Feed Reader |
| `3` | Switch to Transcript Analyzer |
| `r` | Refresh feeds |

## License

MIT
