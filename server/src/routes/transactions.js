import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const txSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  type: z.enum(['income', 'expense']),
  category_id: z.coerce.number().int().nullable().optional(),
  note: z.string().max(200).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
});

const SELECT_FIELDS = `
  t.id, t.amount::float AS amount, t.type, t.note, t.category_id,
  to_char(t.date, 'YYYY-MM-DD') AS date, c.name AS category
`;

async function categoryIsValid(categoryId, userId) {
  if (!categoryId) return true;
  const r = await pool.query(
    'SELECT 1 FROM categories WHERE id = $1 AND user_id = $2',
    [categoryId, userId]
  );
  return r.rowCount > 0;
}

// GET /transactions?month=2026-10&category_id=3&type=expense
router.get('/', async (req, res) => {
  const { month, category_id, type } = req.query;
  const params = [req.userId];
  let sql = `
    SELECT ${SELECT_FIELDS}
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.user_id = $1`;

  if (/^\d{4}-\d{2}$/.test(month || '')) {
    params.push(`${month}-01`);
    sql += ` AND t.date >= $${params.length}::date
             AND t.date < ($${params.length}::date + INTERVAL '1 month')`;
  }
  if (category_id) {
    params.push(Number(category_id));
    sql += ` AND t.category_id = $${params.length}`;
  }
  if (type === 'income' || type === 'expense') {
    params.push(type);
    sql += ` AND t.type = $${params.length}`;
  }
  sql += ' ORDER BY t.date DESC, t.id DESC';

  const result = await pool.query(sql, params);
  res.json(result.rows);
});

router.post('/', async (req, res) => {
  const parsed = txSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { amount, type, category_id, note, date } = parsed.data;

  if (!(await categoryIsValid(category_id, req.userId))) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const result = await pool.query(
    `INSERT INTO transactions (user_id, category_id, amount, type, note, date)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [req.userId, category_id ?? null, amount, type, note ?? null, date]
  );
  res.status(201).json({ id: result.rows[0].id });
});

router.put('/:id', async (req, res) => {
  const parsed = txSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { amount, type, category_id, note, date } = parsed.data;

  if (!(await categoryIsValid(category_id, req.userId))) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const result = await pool.query(
    `UPDATE transactions
     SET category_id = $1, amount = $2, type = $3, note = $4, date = $5
     WHERE id = $6 AND user_id = $7`,
    [category_id ?? null, amount, type, note ?? null, date, req.params.id, req.userId]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  const result = await pool.query(
    'DELETE FROM transactions WHERE id = $1 AND user_id = $2',
    [req.params.id, req.userId]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

export default router;