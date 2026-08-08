import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { trustLevel, trustFactors } from '../trust.js';
import { ah } from '../async-handler.js';

const router = Router();

// GET /api/trust/me — مستواك وعوامل الثقة (Wasla_14/16)
router.get('/trust/me', authRequired, ah(async (req, res) => {
  res.json({
    trust: {
      level: await trustLevel(req.userId),
      factors: await trustFactors(req.userId),
    },
  });
}));

export default router;
