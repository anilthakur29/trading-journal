import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.env.DATA_FILE || path.join(__dirname, 'trades.json');
const MAX_TRADES = 500; // demo safety cap
const load = () => (fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : []);
const save = (t) => fs.writeFileSync(FILE, JSON.stringify(t, null, 2));

// Net P&L = gross P&L minus charges (brokerage, STT, etc.)
const netPnl = (t) =>
  (t.side === 'BUY' ? t.exit - t.entry : t.entry - t.exit) * t.qty - (t.charges || 0);

app.get('/api/trades', (req, res) => {
  const trades = load().map((t) => ({ ...t, pnl: netPnl(t) }));
  res.json(trades.sort((a, b) => b.date.localeCompare(a.date)));
});

app.post('/api/trades', (req, res) => {
  const { symbol, side, entry, exit, qty, charges, date, note } = req.body;
  const e = Number(entry), x = Number(exit), q = Number(qty), c = Number(charges || 0);
  if (!symbol || !['BUY', 'SELL'].includes(side) || [e, x, q].some((n) => !(n > 0)) || c < 0 || !date) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  const trade = {
    id: randomUUID(), symbol: String(symbol).toUpperCase().trim(), side,
    entry: e, exit: x, qty: q, charges: c, date, note: String(note || '').slice(0, 300),
  };
  const trades = load();
  if (trades.length >= MAX_TRADES) return res.status(400).json({ error: 'Demo limit reached' });
  trades.push(trade);
  save(trades);
  res.status(201).json({ ...trade, pnl: netPnl(trade) });
});

app.delete('/api/trades/:id', (req, res) => {
  save(load().filter((t) => t.id !== req.params.id));
  res.status(204).end();
});

app.get('/api/stats', (req, res) => {
  const pnls = load().map(netPnl);
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const sum = (a) => a.reduce((s, n) => s + n, 0);
  res.json({
    totalTrades: pnls.length,
    netPnl: sum(pnls),
    winRate: pnls.length ? (wins.length / pnls.length) * 100 : 0,
    avgWin: wins.length ? sum(wins) / wins.length : 0,
    avgLoss: losses.length ? sum(losses) / losses.length : 0,
  });
});

// Serve the built React app (production)
const DIST = path.join(__dirname, '../client/dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('*', (req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
