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

async function getConfig() {
  const row = await db.prepare("SELECT value FROM app_config WHERE config_key = 'recommendation_config'").get();
  if (row) {
    try { return { ...DEFAULT_CONFIG, ...JSON.parse(row.value) }; } catch { /* ignore */ }
  }
  return DEFAULT_CONFIG;
}

export async function saveConfig(config) {
  const value = JSON.stringify({ ...DEFAULT_CONFIG, ...config });
  const updatedAt = new Date().toISOString().slice(0, 19);
  await db.prepare(
    `INSERT INTO app_config (config_key, value, updated_at) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)`
  ).run('recommendation_config', value, updatedAt);
}

async function profileFields(userId) {
  const rows = await db.prepare('SELECT field_key, value FROM profile_fields WHERE user_id = ?').all(userId);
  const map = {};
  rows.forEach((r) => { map[r.field_key] = r.value; });
  return map;
}

async function hasPhoto(userId) {
  const row = await db.prepare("SELECT 1 FROM profile_fields WHERE user_id = ? AND field_key = 'photo_done' AND value = '1'").get(userId);
  return !!row;
}

async function freshnessScore(userId) {
  let score = 0;
  // recently created
  const user = await db.prepare('SELECT created_at FROM users WHERE id = ?').get(userId);
  const hoursSinceCreated = user ? (Date.now() - new Date(user.created_at + 'Z').getTime()) / 3600000 : Infinity;
  if (hoursSinceCreated < 24) score += 0.5;
  // recently added selfie
  const selfie = await db.prepare("SELECT updated_at FROM profile_fields WHERE user_id = ? AND field_key = 'selfie_done' AND value = '1'").get(userId);
  if (selfie) {
    const hours = (Date.now() - new Date(selfie.updated_at + 'Z').getTime()) / 3600000;
    if (hours < 24) score += 0.3;
  }
  return Math.min(1, score);
}

async function historyPenalty(viewerId, targetId) {
  const rows = await db.prepare(
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

async function recordHistory(viewerId, targetId, source, position) {
  await db.prepare(
    `INSERT INTO recommendation_history (viewer_id, target_id, source, position) VALUES (?, ?, ?, ?)`
  ).run(viewerId, targetId, source, position);
}

export async function getRecommendations(userId, limit = 20) {
  const config = await getConfig();
  const fields = await profileFields(userId);
  const candidates = await db.prepare(
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
  (await db.prepare(
    `SELECT blocked_id FROM blocked_members WHERE user_id = ?
     UNION
     SELECT user_id FROM blocked_members WHERE blocked_id = ?`
  ).all(userId, userId)).forEach((r) => blocked.add(r.blocked_id));

  const filtered = candidates.filter((c) => !blocked.has(c.id));
  const threshold = await getThreshold();
  const scored = [];
  for (const c of filtered) {
    const targetId = c.id;
    const match = await getMatchScore(userId, targetId);
    const targetTrust = await computeTrustLevel(targetId);
    const photo = (await hasPhoto(targetId)) ? 1 : 0;
    const fresh = await freshnessScore(targetId);
    const histPenalty = await historyPenalty(userId, targetId);

    if (targetTrust < config.min_trust_level) continue;
    if (match.score < threshold) continue;

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

    scored.push({
      userId: targetId,
      score: Math.round(finalScore * 100),
      matchScore: match.score,
      matchLevel: match.level,
      trustLevel: targetTrust,
      reasons,
      source: 'recommendation',
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const result = scored.slice(0, limit);
  for (const r of result) await recordHistory(userId, r.userId, r.source, result.indexOf(r) + 1);

  await publish('RecommendationGenerated', { count: result.length, viewerId: userId }, 'recommendation', { userId, entityType: 'user', entityId: String(userId) });
  return result;
}

export async function markOpened(viewerId, targetId) {
  await db.prepare(
    `UPDATE recommendation_history SET opened = 1
     WHERE id = (SELECT id FROM (SELECT id FROM recommendation_history WHERE viewer_id = ? AND target_id = ? ORDER BY shown_at DESC LIMIT 1) t)`
  ).run(viewerId, targetId);
}

export async function markLiked(viewerId, targetId) {
  await db.prepare(
    `UPDATE recommendation_history SET liked = 1
     WHERE id = (SELECT id FROM (SELECT id FROM recommendation_history WHERE viewer_id = ? AND target_id = ? ORDER BY shown_at DESC LIMIT 1) t)`
  ).run(viewerId, targetId);
}

export async function markIgnored(viewerId, targetId) {
  await db.prepare(
    `UPDATE recommendation_history SET ignored = 1
     WHERE id = (SELECT id FROM (SELECT id FROM recommendation_history WHERE viewer_id = ? AND target_id = ? ORDER BY shown_at DESC LIMIT 1) t)`
  ).run(viewerId, targetId);
}

export async function listConfig() {
  return getConfig();
}
