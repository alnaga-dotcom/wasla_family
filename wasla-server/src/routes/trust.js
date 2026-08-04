import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { trustLevel, trustFactors } from '../trust.js';

const router = Router();

// GET /api/trust/me — مستواك وعوامل الثقة (Wasla_14/16)
router.get('/trust/me', authRequired, (req, res) => {
  res.json({
    trust: {
      level: trustLevel(req.userId),
      factors: trustFactors(req.userId),
    },
  });
});

export default router;
