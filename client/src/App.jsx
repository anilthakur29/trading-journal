import { useEffect, useState } from 'react';

const today = () => new Date().toISOString().slice(0, 10);
const empty = { symbol: '', side: 'BUY', entry: '', exit: '', qty: '', charges: '', date: today(), note: '' };
const inr = (n) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function App() {
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(2);

  const refresh = async () => {
    const [t, s] = await Promise.all([
      fetch('/api/trades').then((r) => r.json()),
      fetch('/api/stats').then((r) => r.json()),
    ]);
    setTrades(t);
    setStats(s);
  };

  useEffect(() => { refresh().catch(() => setError('API not reachable')); }, []);

  const filteredTrades = trades.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const haystack = `${t.symbol} ${t.side} ${t.date} ${t.note || ''}`.toLowerCase();
    return haystack.includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filteredTrades.length / pageSize));
  const currentTrades = filteredTrades.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [search, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) return setError((await res.json()).error || 'Failed to save');
    setForm(empty);
    refresh();
  };

  const remove = async (id) => {
    await fetch(`/api/trades/${id}`, { method: 'DELETE' });
    refresh();
  };

  return (
    <div className="wrap">
      <h1>Trading Journal</h1>

      {stats && (
        <div className="cards">
          <div className="card"><small>Trades</small><b>{stats.totalTrades}</b></div>
          <div className="card"><small>Net P&amp;L</small><b className={stats.netPnl >= 0 ? 'pos' : 'neg'}>{inr(stats.netPnl)}</b></div>
          <div className="card"><small>Win rate</small><b>{stats.winRate.toFixed(1)}%</b></div>
          <div className="card"><small>Avg win / loss</small><b>{inr(stats.avgWin)} / {inr(stats.avgLoss)}</b></div>
        </div>
      )}

      <form onSubmit={submit}>
        <input name="symbol" placeholder="Symbol (RELIANCE)" value={form.symbol} onChange={change} required />
        <select name="side" value={form.side} onChange={change}>
          <option>BUY</option><option>SELL</option>
        </select>
        <input name="entry" type="number" step="0.01" placeholder="Entry price" value={form.entry} onChange={change} required />
        <input name="exit" type="number" step="0.01" placeholder="Exit price" value={form.exit} onChange={change} required />
        <input name="qty" type="number" placeholder="Qty" value={form.qty} onChange={change} required />
        <input name="charges" type="number" step="0.01" placeholder="Charges (₹)" value={form.charges} onChange={change} />
        <input name="date" type="date" value={form.date} onChange={change} required />
        <input name="note" placeholder="Why did I take this trade?" value={form.note} onChange={change} />
        <button type="submit">Add trade</button>
      </form>
      {error && <p className="neg">{error}</p>}

      <div className="toolbar">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search symbol, side, date, or note"
        />
        <label>
          Rows
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </label>
      </div>

      <div className="scroll">
        <table>
          <thead>
            <tr><th>Date</th><th>Symbol</th><th>Side</th><th>Entry</th><th>Exit</th><th>Qty</th><th>Net P&amp;L</th><th>Note</th><th></th></tr>
          </thead>
          <tbody>
            {currentTrades.map((t) => (
              <tr key={t.id}>
                <td>{t.date}</td><td>{t.symbol}</td><td>{t.side}</td>
                <td>{t.entry}</td><td>{t.exit}</td><td>{t.qty}</td>
                <td className={t.pnl >= 0 ? 'pos' : 'neg'}>{inr(t.pnl)}</td>
                <td>{t.note}</td>
                <td><button onClick={() => remove(t.id)}>✕</button></td>
              </tr>
            ))}
            {!filteredTrades.length && (
              <tr>
                <td colSpan="9">{search ? 'No trades match your search.' : 'No trades yet. Add your first one above.'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredTrades.length > pageSize && (
        <div className="pagination">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
        </div>
      )}
    </div>
  );
}
