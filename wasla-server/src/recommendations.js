import { db } from './db.js';
import { getMatchScore, getThreshold } from './matching.js';
import { publish } from './events.js';
import { trustLevel as computeTrustLevel } from './trust.js';

const DEFAULT_CONFIG = {
  compatibility_weight: 0.5,
  trust_weight: 0.2,
  freshness_weight: 0.2,
  photo_weight: 0.1,
  min_trust_level: 1,
  verified_boost: 1.3,
  new_member_boost_hours: 24,
  max_history_penalty: 0.3,
};

function getConfig() {
  const row = db.prepare("SELECT value FROM app_config WHERE key = 'recommendation_config'").get();
  if (row) {
    try { return { ...DEFAULT_CONFIG, ...JSON.parse(row.value) }; } catch { /* ignore */ }
  }
  return DEFAULT_CONFIG;
}

export function saveConfig(config) {
  db.prepare(
    `INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run('recommendation_config', JSON.stringify({ ...DEFAULT_CONFIG, ...config }), new Date().toISOString().slice(0, 19));
}

function profileFields(userId) {
  const rows = db.prepare('SELECT field_key, value FROM profile_fields WHERE user_id = ?').all(userId);
  const map = {};
  rows.forEach((r) => { map[r.field_key] = r.value; });
  return map;
}

function trustLevel(userId) {
  return computeTrustLevel(userId);
}

function hasPhoto(userId) {
  const row = db.prepare("SELECT 1 FROM profile_fields WHERE user_id = ? AND field_key = 'photo_done' AND value = '1'").get(userId);
  return !!row;
}

function freshnessScore(userId) {
  let score = 0;
  // recently created
  const user = db.prepare('SELECT created_at FROM users WHERE id = ?').get(userId);
  const hoursSinceCreated = user ? (Date.now() - new Date(user.created_at + 'Z').getTime()) / 3600000 : Infinity;
  if (hoursSinceCreated < 24) score += 0.5;
  // recently added selfie
  const selfie = db.prepare("SELECT updated_at FROM profile_fields WHERE user_id = ? AND field_key = 'selfie_done' AND value = '1'").get(userId);
  if (selfie) {
    const hours = (Date.now() - new Date(selfie.updated_at + 'Z').getTime()) / 3600000;
    if (hours < 24) score += 0.3;
  }
  return Math.min(1, score);
}

function historyPenalty(viewerId, targetId) {
  const rows = db.prepare(
    `SELECT opened, liked, ignored FROM recommendation_history WHERE viewer_id = ? AND target_id = ? ORDER BY shown_at DESC LIMIT 5`
  ).all(viewerId, targetId);
  if (!rows.length) return 0;
  let penalty = 0;
  rows.forEach((r) => {
    if (r.ignored) penalty += 0.2;
    else if (!r.opened) penalty += 0.05;
  });
  return Math.min(1, penalty);
}

function recordHistory(viewerId, targetId, source, position) {
  db.prepare(
    `INSERT INTO recommendation_history (viewer_id, target_id, source, position) VALUES (?, ?, ?, ?)`
  ).run(viewerId, targetId, source, position);
}

export function getRecommendations(userId, limit = 20) {
  const config = getConfig();
  const fields = profileFields(userId);
  const candidates = db.prepare(
    `SELECT u.id FROM users u
     WHERE u.id != ?
       AND u.status = 'active' AND u.deleted_at IS NULL
       AND COALESCE((SELECT paused FROM user_settings s WHERE s.user_id = u.id), 0) = 0
       AND EXISTS (SELECT 1 FROM profile_fields pf WHERE pf.user_id = u.id AND pf.field_key = 'selfie_done' AND pf.value = '1')
       AND NOT EXISTS (SELECT 1 FROM match_actions a WHERE a.actor_id = ? AND a.target_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM match_actions a WHERE a.actor_id = u.id AND a.target_id = ? AND a.action = 'pass')
       AND NOT EXISTS (SELECT 1 FROM discovery_views v WHERE v.actor_id = ? AND v.target_id = u.id)
     ORDER BY u.id DESC LIMIT ?`
  ).all(userId, userId, userId, userId, limit * 4);

  const blocked = new Set();
  db.prepare(
    `SELECT blocked_id FROM blocked_members WHERE user_id = ?
     UNION
     SELECT user_id FROM blocked_members WHERE blocked_id = ?`
  ).all(userId, userId).forEach((r) => blocked.add(r.blocked_id));

  const filtered = candidates.filter((c) => !blocked.has(c.id));
  const threshold = getThreshold();
  const scored = filtered.map((c, idx) => {
    const targetId = c.id;
    const match = getMatchScore(userId, targetId);
    const targetTrust = trustLevel(targetId);
    const photo = hasPhoto(targetId) ? 1 : 0;
    const fresh = freshnessScore(targetId);
    const histPenalty = historyPenalty(userId, targetId);

    if (targetTrust < config.min_trust_level) return null;
    if (match.score < threshold) return null;

    const compatibilityNorm = match.score / 100;
    const trustNorm = Math.min(1, targetTrust / 3);
    const trustBoost = targetTrust >= 2 ? config.verified_boost : 1;
    const photoNorm = photo;

    const finalScore = (
      compatibilityNorm * config.compatibility_weight +
      trustNorm * config.trust_weight * trustBoost +
      fresh * config.freshness_weight +
      photoNorm * config.photo_weight
    ) * (1 - Math.min(config.max_history_penalty, histPenalty));

    const reasons = [];
    if (match.score >= 80) reasons.push('توافق مرتفع');
    else if (match.score >= 60) reasons.push('يتوافق مع تفضيلاتك');
    if (fresh > 0) reasons.push('عضو جديد');
    if (targetTrust >= 2) reasons.push('موثّق');
    if (photo) reasons.push('لديه صورة');

    return {
      userId: targetId,
      score: Math.round(finalScore * 100),
      matchScore: match.score,
      matchLevel: match.level,
      trustLevel: targetTrust,
      reasons,
      source: 'recommendation',
    };
  }).filter(Boolean);

  scored.sort((a, b) => b.score - a.score);
  const result = scored.slice(0, limit);
  result.forEach((r, i) => recordHistory(userId, r.userId, r.source, i + 1));

  publish('RecommendationGenerated', { count: result.length, viewerId: userId }, 'recommendation', { userId, entityType: 'user', entityId: String(userId) });
  return result;
}

export function markOpened(viewerId, targetId) {
  db.prepare('UPDATE recommendation_history SET opened = 1 WHERE viewer_id = ? AND target_id = ? ORDER BY shown_at DESC LIMIT 1').run(viewerId, targetId);
}

export function markLiked(viewerId, targetId) {
  db.prepare('UPDATE recommendation_history SET liked = 1 WHERE viewer_id = ? AND target_id = ? ORDER BY shown_at DESC LIMIT 1').run(viewerId, targetId);
}

export function markIgnored(viewerId, targetId) {
  db.prepare('UPDATE recommendation_history SET ignored = 1 WHERE viewer_id = ? AND target_id = ? ORDER BY shown_at DESC LIMIT 1').run(viewerId, targetId);
}

export function listConfig() {
  return getConfig();
}
