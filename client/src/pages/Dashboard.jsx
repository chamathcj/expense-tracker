import { useCallback, useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import TransactionForm from '../components/TransactionForm';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#ec4899', '#64748b'];

const fmt = (n) =>
  Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Dashboard() {
  const { logout } = useAuth();

  const [month, setMonth] = useState(currentMonth());
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [byCategory, setByCategory] = useState([]);

  const [editing, setEditing] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ month });
      if (categoryFilter) params.set('category_id', categoryFilter);
      if (typeFilter) params.set('type', typeFilter);

      const [tx, sum, byCat] = await Promise.all([
        api(`/transactions?${params}`),
        api(`/summary/monthly?month=${month}`),
        api(`/summary/by-category?month=${month}`),
      ]);
      setTransactions(tx);
      setSummary(sum);
      setByCategory(byCat);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [month, categoryFilter, typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api('/categories').then(setCategories).catch((err) => setError(err.message));
  }, []);

  async function handleDelete(id) {
    if (!window.confirm('Delete this transaction?')) return;
    try {
      await api(`/transactions/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleSaved() {
    setEditing(null);
    setFormKey((k) => k + 1);
    load();
  }

  return (
    <div className="container">
      <header className="topbar">
        <h1>Expense Tracker</h1>
        <button className="secondary" onClick={logout}>Log out</button>
      </header>

      <div className="toolbar">
        <label>
          Month
          <input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
        </label>
        <label>
          Category
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="cards">
        <div className="card">
          <span className="muted">Income</span>
          <strong className="positive">{fmt(summary?.income ?? 0)}</strong>
        </div>
        <div className="card">
          <span className="muted">Expenses</span>
          <strong className="negative">{fmt(summary?.expenses ?? 0)}</strong>
        </div>
        <div className="card">
          <span className="muted">Balance</span>
          <strong>{fmt(summary?.balance ?? 0)}</strong>
        </div>
      </div>

      <div className="grid">
        <section className="panel">
          <h2>Spending by category</h2>
          {byCategory.length === 0 ? (
            <p className="muted">No expenses this month.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={byCategory} dataKey="total" nameKey="category" outerRadius={90}>
                  {byCategory.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="panel">
          <TransactionForm
            key={`${editing?.id ?? 'new'}-${formKey}`}
            categories={categories}
            editing={editing}
            onSaved={handleSaved}
            onCancel={() => setEditing(null)}
          />
        </section>
      </div>

      <section className="panel">
        <h2>Transactions</h2>
        {loading ? (
          <p className="muted">Loading...</p>
        ) : transactions.length === 0 ? (
          <p className="muted">No transactions found.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Note</th>
                  <th className="right">Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td>{t.date}</td>
                    <td>{t.category ?? '-'}</td>
                    <td>{t.note}</td>
                    <td className={`right ${t.type === 'income' ? 'positive' : 'negative'}`}>
                      {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                    </td>
                    <td className="actions">
                      <button className="link" onClick={() => setEditing(t)}>Edit</button>
                      <button className="link danger" onClick={() => handleDelete(t.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}