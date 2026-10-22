import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const getMonth = (q) =>
  /^\d{4}-\d{2}$/.test(q || '') ? q : new Date().toISOString().slice(0, 7);

// GET /summary/monthly?month=2026-10
router.get('/monthly', async (req, res) => {
  const start = `${getMonth(req.query.month)}-01`;
  const result = await pool.query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)::float  AS income,
       COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)::float AS expenses
     FROM transactions
     WHERE user_id = $1
       AND date >= $2::date AND date < ($2::date + INTERVAL '1 month')`,
    [req.userId, start]
  );
  const { income, expenses } = result.rows[0];
  res.json({ income, expenses, balance: income - expenses });
});

// GET /summary/by-category?month=2026-10
router.get('/by-category', async (req, res) => {
  const start = `${getMonth(req.query.month)}-01`;
  const result = await pool.query(
    `SELECT COALESCE(c.name, 'Uncategorised') AS category,
            SUM(t.amount)::float AS total
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = $1 AND t.type = 'expense'
       AND t.date >= $2::date AND t.date < ($2::date + INTERVAL '1 month')
     GROUP BY c.name
     ORDER BY total DESC`,
    [req.userId, start]
  );
  res.json(result.rows);
});

export default router;