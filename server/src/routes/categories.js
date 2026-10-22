import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const result = await pool.query(
    'SELECT id, name FROM categories WHERE user_id = $1 ORDER BY name',
    [req.userId]
  );
  res.json(result.rows);
});

export default router;