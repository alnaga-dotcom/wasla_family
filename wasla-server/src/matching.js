import { db } from './db.js';

const DEFAULT_WEIGHTS = {
  city: 20,
  nationality: 15,
  education: 15,
  religiosity: 20,
  lifestyle: 10,
  age: 10,
  height: 10,
};

const REASON_LABELS = {
  city: 'نفس المدينة',
  nationality: 'نفس الجنسية',
  education: 'توافق تعليمي',
  religiosity: 'توافق ديني',
  lifestyle: 'نفس نمط الحياة',
  age: 'قرب العمر',
  height: 'قرب الطول',
};

async function getWeights() {
  const row = await db.prepare("SELECT value FROM app_config WHERE config_key = 'match_weights'").get();
  if (row) {
    try { return JSON.parse(row.value); } catch { /* fall through */ }
  }
  return DEFAULT_WEIGHTS;
}

export async function getThreshold() {
  const row = await db.prepare("SELECT value FROM app_config WHERE config_key = 'match_threshold'").get();
  return row ? Number(row.value) : 60;
}

async function profileFields(userId) {
  const rows = await db.prepare('SELECT field_key, value FROM profile_fields WHERE user_id = ?').all(userId);
  const map = {};
  rows.forEach((r) => { map[r.field_key] = r.value; });
  if (map.birth_year) {
    const by = Number(map.birth_year);
    if (Number.isFinite(by)) map.age = String(new Date().getFullYear() - by);
  }
  return map;
}

function scoreLevel(score) {
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}

function ageScore(a, b, weight) {
  const av = Number(a.age);
  const bv = Number(b.age);
  if (!Number.isFinite(av) || !Number.isFinite(bv)) return { earned: 0, possible: 0, reason: null };
  const diff = Math.abs(av - bv);
  let earned = 0;
  if (diff <= 5) earned = weight;
  else if (diff <= 10) earned = weight * 0.5;
  return { earned, possible: weight, reason: diff <= 10 ? 'age' : null };
}

function heightScore(a, b, weight) {
  const av = Number(a.height);
  const bv = Number(b.height);
  if (!Number.isFinite(av) || !Number.isFinite(bv)) return { earned: 0, possible: 0, reason: null };
  const diff = Math.abs(av - bv);
  let earned = 0;
  if (diff <= 5) earned = weight;
  else if (diff <= 10) earned = weight * 0.5;
  return { earned, possible: weight, reason: diff <= 10 ? 'height' : null };
}

async function computeScore(a, b) {
  const weights = await getWeights();
  const threshold = await getThreshold();
  const reasons = [];
  let earned = 0;
  let possible = 0;

  for (const key of Object.keys(weights)) {
    const w = weights[key] || 0;
    if (key === 'age') {
      const s = ageScore(a, b, w);
      earned += s.earned;
      possible += s.possible;
      if (s.reason) reasons.push(REASON_LABELS[key]);
    } else if (key === 'height') {
      const s = heightScore(a, b, w);
      earned += s.earned;
      possible += s.possible;
      if (s.reason) reasons.push(REASON_LABELS[key]);
    } else if (a[key] && b[key] && a[key] === b[key]) {
      earned += w;
      possible += w;
      reasons.push(REASON_LABELS[key]);
    } else if (a[key] || b[key]) {
      possible += w;
    }
  }

  const score = possible > 0 ? Math.round((earned / possible) * 100) : 0;
  return { score, level: scoreLevel(score), threshold, reasons };
}

export async function getMatchScore(userId, targetId) {
  const cached = await db.prepare('SELECT score, level, reasons FROM match_scores WHERE user_id = ? AND target_id = ?').get(userId, targetId);
  if (cached) {
    return { score: cached.score, level: cached.level, reasons: JSON.parse(cached.reasons || '[]'), threshold: await getThreshold() };
  }
  const a = await profileFields(userId);
  const b = await profileFields(targetId);
  const result = await computeScore(a, b);
  await db.prepare(
    `INSERT INTO match_scores (user_id, target_id, score, level, reasons, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE score = VALUES(score), level = VALUES(level), reasons = VALUES(reasons), updated_at = VALUES(updated_at)`
  ).run(userId, targetId, result.score, result.level, JSON.stringify(result.reasons), new Date().toISOString().slice(0, 19));
  return { ...result, threshold: await getThreshold() };
}

export async function rankForDiscovery(userId, limit = 20) {
  const threshold = await getThreshold();
  // Discover candidates with selfie_done and not yet seen/acted
  const rows = await db.prepare(
    `SELECT u.id FROM users u
     WHERE u.id != ?
       AND u.status = 'active' AND u.deleted_at IS NULL
       AND COALESCE((SELECT paused FROM user_settings s WHERE s.user_id = u.id), 0) = 0
       AND EXISTS (SELECT 1 FROM profile_fields pf WHERE pf.user_id = u.id AND pf.field_key = 'selfie_done' AND pf.value = '1')
       AND NOT EXISTS (SELECT 1 FROM match_actions a WHERE a.actor_id = ? AND a.target_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM match_actions a WHERE a.actor_id = u.id AND a.target_id = ? AND a.action = 'pass')
       AND NOT EXISTS (SELECT 1 FROM discovery_views v WHERE v.actor_id = ? AND v.target_id = u.id)
     ORDER BY u.id DESC
     LIMIT ?`
  ).all(userId, userId, userId, userId, limit * 3);

  const scored = [];
  for (const r of rows) {
    const score = await getMatchScore(userId, r.id);
    scored.push({ userId: r.id, ...score });
  }
  const filtered = scored.filter((s) => s.score >= threshold);

  filtered.sort((a, b) => b.score - a.score);
  return filtered.slice(0, limit);
}

export async function saveWeights(weights) {
  await db.prepare(
    `INSERT INTO app_config (config_key, value, updated_at) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)`
  ).run('match_weights', JSON.stringify(weights), new Date().toISOString().slice(0, 19));
}

export async function saveThreshold(value) {
  await db.prepare(
    `INSERT INTO app_config (config_key, value, updated_at) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)`
  ).run('match_threshold', String(value), new Date().toISOString().slice(0, 19));
}

export async function listWeights() {
  return { weights: await getWeights(), threshold: await getThreshold() };
}

export function scoreLevelLabel(score) {
  return scoreLevel(score);
}
