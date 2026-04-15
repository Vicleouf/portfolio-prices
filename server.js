const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

/* ── PRIX via Yahoo Finance ── */
async function getPrice(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const data = await response.json();
  const meta = data.chart.result[0].meta;
  const prev = meta.previousClose || meta.chartPreviousClose || meta.regularMarketPreviousClose;
  const cur  = meta.regularMarketPrice;
  return { ticker, price: cur, prev, change: cur - prev, changePct: ((cur - prev) / prev) * 100 };
}

app.get('/prices', async (req, res) => {
  const tickers = (req.query.tickers || '').split(',').filter(Boolean);
  if (tickers.length === 0) return res.json([]);
  const results = await Promise.all(tickers.map(async ticker => {
    try { return await getPrice(ticker); }
    catch(e) { return { ticker, error: e.message }; }
  }));
  res.json(results);
});

/* ── PROXY ANTHROPIC ── */
app.post('/ai', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(400).json({ error: 'Clé API manquante' });
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(30000)
    });
    const data = await response.json();
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/', (req, res) => res.json({ status: 'ok', endpoints: ['/prices?tickers=AMZN,GOOG', '/ai (POST)'] }));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
