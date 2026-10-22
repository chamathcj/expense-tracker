import { useState } from 'react';
import { api } from '../api';

function today() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function TransactionForm({ categories, editing, onSaved, onCancel }) {
  const [form, setForm] = useState({
    amount: editing?.amount ?? '',
    type: editing?.type ?? 'expense',
    category_id: editing?.category_id ?? '',
    note: editing?.note ?? '',
    date: editing?.date ?? today(),
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const body = {
      amount: form.amount,
      type: form.type,
      category_id: form.category_id === '' ? null : Number(form.category_id),
      note: form.note,
      date: form.date,
    };

    try {
      if (editing) {
        await api(`/transactions/${editing.id}`, { method: 'PUT', body });
      } else {
        await api('/transactions', { method: 'POST', body });
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>{editing ? 'Edit transaction' : 'Add transaction'}</h2>

      <div className="row">
        <label>
          Type
          <select value={form.type} onChange={set('type')}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </label>
        <label>
          Amount
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={form.amount}
            onChange={set('amount')}
            required
          />
        </label>
      </div>

      <div className="row">
        <label>
          Category
          <select value={form.category_id} onChange={set('category_id')}>
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input type="date" value={form.date} onChange={set('date')} required />
        </label>
      </div>

      <label>
        Note
        <input
          type="text"
          maxLength={200}
          value={form.note}
          onChange={set('note')}
          placeholder="Optional"
        />
      </label>

      {error && <p className="error">{error}</p>}

      <div className="row">
        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : editing ? 'Save changes' : 'Add'}
        </button>
        {editing && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}