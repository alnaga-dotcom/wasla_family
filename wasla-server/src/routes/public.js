import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

// GET /api/public/stats — real numbers for landing page (Wasla_24 §7)
// Excludes demo accounts, suspended users, and accounts pending deletion.
router.get('/stats', (req, res) => {
  const activeMembers = db.prepare(
    `SELECT COUNT(*) AS c FROM users
     WHERE status = 'active' AND deleted_at IS NULL
       AND role = 'user'`
  ).get().c;

  const verifiedMembers = db.prepare(
    `SELECT COUNT(*) AS c FROM users
     WHERE status = 'active' AND deleted_at IS NULL
       AND verified_at IS NOT NULL`
  ).get().c;

  const matches = db.prepare(
    `SELECT COUNT(*) AS c FROM match_actions a
     JOIN users u1 ON u1.id = a.actor_id
     JOIN users u2 ON u2.id = a.target_id
     WHERE a.action = 'like'
       AND EXISTS (
         SELECT 1 FROM match_actions b
         WHERE b.actor_id = a.target_id AND b.target_id = a.actor_id AND b.action = 'like'
       )
       AND u1.status = 'active' AND u1.deleted_at IS NULL
       AND u2.status = 'active' AND u2.deleted_at IS NULL`
  ).get().c;

  const messages = db.prepare(
    `SELECT COUNT(*) AS c FROM messages m
     JOIN users sender ON sender.id = m.sender_id
     JOIN users receiver ON receiver.id = m.receiver_id
     WHERE sender.status = 'active' AND sender.deleted_at IS NULL
       AND receiver.status = 'active' AND receiver.deleted_at IS NULL`
  ).get().c;

  res.json({ activeMembers, verifiedMembers, matches, messages });
});

// GET /api/public/plans — public pricing for landing page
router.get('/plans', (req, res) => {
  const rows = db.prepare('SELECT code, name, duration_months, price_egp, regular_price_egp, features, status FROM plans WHERE status = ? ORDER BY price_egp')
    .all('active');
  res.json({
    plans: rows.map((p) => ({
      ...p,
      features: JSON.parse(p.features || '[]'),
    })),
  });
});

export default router;
