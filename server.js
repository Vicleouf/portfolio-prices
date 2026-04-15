const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.get('/price/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const url = `https://stooq.com/q/l/?s=${ticker.toLowerCase()}.us&f=sd2t2ohlcv&h&e=csv`;
  try {
    const response = await fetch(url);
    const text = await response.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) return res.status(404).json({ error: 'no data' });
    const cols = lines[1].split(',');
    const open  = parseFloat(cols[3]);
    const close = parseFloat(cols[6]);
    if (isNaN(close) || close <= 0) return res.status(404).json({ error: 'invalid price' });
    const prev = isNaN(open) ? close : open;
    res.json({
      ticker,
      price: close,
      prev,
      change: close - prev,
      changePct: prev > 0 ? ((close - prev) / prev) * 100 : 0
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/prices', async (req, res) => {
  const tickers = (req.query.tickers || '').split(',').filter(Boolean);
  if (tickers.length === 0) return res.json([]);
  const results = await Promise.all(tickers.map(async ticker => {
    const url = `https://stooq.com/q/l/?s=${ticker.toLowerCase()}.us&f=sd2t2ohlcv&h&e=csv`;
    try {
      const response = await fetch(url);
      const text = await response.text();
      const lines = text.trim().split('\n');
      if (lines.length < 2) return { ticker, error: 'no data' };
      const cols = lines[1].split(',');
      const open  = parseFloat(cols[3]);
      const close = parseFloat(cols[6]);
      if (isNaN(close) || close <= 0) return { ticker, error: 'invalid' };
      const prev = isNaN(open) ? close : open;
      return { ticker, price: close, prev, change: close - prev, changePct: prev > 0 ? ((close - prev) / prev) * 100 : 0 };
    } catch(e) {
      return { ticker, error: e.message };
    }
  }));
  res.json(results);
});

app.get('/', (req, res) => res.json({ status: 'ok', usage: '/prices?tickers=AMZN,GOOG,VT' }));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
