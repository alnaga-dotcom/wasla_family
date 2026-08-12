import mysql from 'mysql2/promise';
import { config } from './config.js';

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  timezone: 'Z',
  dateStrings: true,
  multipleStatements: true,
});

// Mimic the node:sqlite API (prepare().get/all/run) but async, backed by MySQL.
function makeExecutor(conn) {
  const exec = (sql) => conn.execute(sql).then(([rows]) => ({ rows }));
  const query = (sql) => conn.query(sql).then(([rows]) => ({ rows }));
  return {
    prepare(sql) {
      return {
        get: (...params) => conn.execute(sql, params).then(([rows]) => rows[0] ?? undefined),
        all: (...params) => conn.execute(sql, params).then(([rows]) => rows),
        run: (...params) => conn.execute(sql, params).then(([result]) => ({ changes: result.affectedRows, lastInsertRowid: result.insertId })),
      };
    },
    exec,
    query,
  };
}

export const db = {
  prepare(sql) {
    return {
      get: (...params) => pool.execute(sql, params).then(([rows]) => rows[0] ?? undefined),
      all: (...params) => pool.execute(sql, params).then(([rows]) => rows),
      run: (...params) => pool.execute(sql, params).then(([result]) => ({ changes: result.affectedRows, lastInsertRowid: result.insertId })),
    };
  },
  exec(sql) {
    return pool.query(sql).then(([rows]) => ({ rows }));
  },
  async transaction(fn) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await fn(makeExecutor(conn));
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
  async close() {
    await pool.end();
  },
  pool,
};

const SCHEMA = [
  `
  CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('male','female')),
    status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
    role VARCHAR(32) NOT NULL DEFAULT 'user' CHECK (role IN ('user','viewer','moderator','verification_officer','customer_support','rule_admin','subscription_admin','admin','super_admin')),
    trust_level INT NOT NULL DEFAULT 1,
    push_token TEXT,
    email_verified_at DATETIME,
    phone_verified_at DATETIME,
    verified_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    is_demo TINYINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_phone (phone)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS otp_codes (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    code VARCHAR(16) NOT NULL,
    purpose VARCHAR(32) NOT NULL DEFAULT 'register',
    expires_at DATETIME NOT NULL,
    used_at DATETIME,
    PRIMARY KEY (id),
    KEY idx_otp_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS sessions (
    token VARCHAR(64) PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    KEY idx_sessions_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS profile_fields (
    user_id INT UNSIGNED NOT NULL,
    field_key VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    domain VARCHAR(32) NOT NULL,
    \`sensitive\` INT NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, field_key),
    KEY idx_pf_domain (domain)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS discovery_views (
    actor_id INT UNSIGNED NOT NULL,
    target_id INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (actor_id, target_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS match_actions (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_id INT UNSIGNED NOT NULL,
    target_id INT UNSIGNED NOT NULL,
    action VARCHAR(8) NOT NULL CHECK (action IN ('like','pass')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_actions_pair (actor_id, target_id),
    KEY idx_actions_target (target_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS archived_matches (
    user_id INT UNSIGNED NOT NULL,
    other_id INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, other_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS messages (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    sender_id INT UNSIGNED NOT NULL,
    receiver_id INT UNSIGNED NOT NULL,
    text TEXT,
    kind VARCHAR(16) NOT NULL DEFAULT 'text' CHECK (kind IN ('text','ephemeral')),
    is_read INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_msgs_pair (sender_id, receiver_id, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS blocked_members (
    user_id INT UNSIGNED NOT NULL,
    blocked_id INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, blocked_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS reports (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    reporter_id INT UNSIGNED NOT NULL,
    reported_id INT UNSIGNED NOT NULL,
    reason TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS user_settings (
    user_id INT UNSIGNED PRIMARY KEY,
    photo_visibility INT NOT NULL DEFAULT 0,
    last_seen_on INT NOT NULL DEFAULT 1,
    paused INT NOT NULL DEFAULT 0
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS notifications (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    from_user_id INT UNSIGNED,
    type VARCHAR(32) NOT NULL,
    text TEXT NOT NULL,
    is_read INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_notif_user (user_id, is_read)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS favorites (
    user_id INT UNSIGNED NOT NULL,
    favorite_id INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, favorite_id),
    KEY idx_fav_target (favorite_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS plans (
    code VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    duration_months INT NOT NULL DEFAULT 1,
    price_egp INT NOT NULL DEFAULT 0,
    regular_price_egp INT,
    features TEXT NOT NULL DEFAULT ('[]'),
    status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive'))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    plan_code VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('pending','paid','active','expired','cancelled')),
    starts_at DATETIME NOT NULL,
    ends_at DATETIME NOT NULL,
    auto_renew INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_subs_user (user_id, status, ends_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS daily_quotas (
    user_id INT UNSIGNED NOT NULL,
    day VARCHAR(16) NOT NULL,
    likes_used INT NOT NULL DEFAULT 0,
    messages_used INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS payments (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    subscription_id INT UNSIGNED,
    amount_egp INT NOT NULL,
    provider VARCHAR(64),
    provider_ref VARCHAR(255),
    status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS admin_actions (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_id INT UNSIGNED,
    actor_role VARCHAR(32),
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id VARCHAR(100),
    reason TEXT,
    meta TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_admin_actions_actor (actor_id, created_at),
    KEY idx_admin_actions_target (target_type, target_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS moderation_items (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    item_type VARCHAR(32) NOT NULL CHECK (item_type IN ('message','profile_field','report','display_name')),
    item_id VARCHAR(100),
    field_key VARCHAR(100),
    original_text TEXT,
    normalized_text TEXT,
    risk_score INT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','overturned')),
    violations TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_moderation_status (status, risk_score DESC),
    KEY idx_moderation_user (user_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS moderation_decisions (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    item_id INT UNSIGNED NOT NULL,
    actor_id INT UNSIGNED,
    actor_role VARCHAR(32),
    action VARCHAR(16) NOT NULL CHECK (action IN ('approve','reject','overturn')),
    reason TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_moderation_decisions_item (item_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS match_scores (
    user_id INT UNSIGNED NOT NULL,
    target_id INT UNSIGNED NOT NULL,
    score INT NOT NULL DEFAULT 0,
    level VARCHAR(8) NOT NULL DEFAULT 'low',
    reasons TEXT,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, target_id),
    KEY idx_match_scores_user (user_id, score DESC)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS app_config (
    config_key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS events (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_id VARCHAR(64) NOT NULL,
    type VARCHAR(64) NOT NULL,
    version VARCHAR(16) NOT NULL DEFAULT '1.0',
    source VARCHAR(64) NOT NULL,
    user_id INT UNSIGNED,
    entity_type VARCHAR(64),
    entity_id VARCHAR(100),
    correlation_id VARCHAR(100),
    payload TEXT NOT NULL,
    published_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    PRIMARY KEY (id),
    UNIQUE KEY uq_events_event_id (event_id),
    KEY idx_events_type (type, published_at),
    KEY idx_events_entity (entity_type, entity_id, published_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS workflow_definitions (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    wf_key VARCHAR(100) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    states TEXT NOT NULL,
    transitions TEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_wf_def_key_ver (wf_key, version)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS workflow_instances (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    definition_id INT UNSIGNED NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    current_state VARCHAR(64) NOT NULL,
    previous_state VARCHAR(64),
    context TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_wf_inst_def_entity (definition_id, entity_type, entity_id),
    KEY idx_workflow_state (current_state, updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS workflow_history (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    instance_id INT UNSIGNED NOT NULL,
    from_state VARCHAR(64),
    to_state VARCHAR(64) NOT NULL,
    actor_id INT UNSIGNED,
    actor_role VARCHAR(32),
    reason TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_workflow_history (instance_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS rules (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(100) NOT NULL,
    conditions TEXT NOT NULL,
    actions TEXT NOT NULL,
    priority INT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','draft')),
    user_message TEXT,
    \`sensitive\` INT NOT NULL DEFAULT 0,
    version INT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_rules_event (event_type, priority DESC)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS rule_executions (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    rule_id INT UNSIGNED NOT NULL,
    event_id VARCHAR(100),
    context TEXT,
    result TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS recommendation_history (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    viewer_id INT UNSIGNED NOT NULL,
    target_id INT UNSIGNED NOT NULL,
    source VARCHAR(32),
    position INT,
    opened INT NOT NULL DEFAULT 0,
    liked INT NOT NULL DEFAULT 0,
    ignored INT NOT NULL DEFAULT 0,
    shown_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_rec_history_viewer (viewer_id, target_id, shown_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS role_permissions (
    role VARCHAR(64) NOT NULL,
    resource VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    PRIMARY KEY (role, resource, action)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS user_photos (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    kind VARCHAR(16) NOT NULL CHECK (kind IN ('profile','selfie','private')),
    filename TEXT NOT NULL,
    original_name TEXT,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes INT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','deleted')),
    review_status VARCHAR(16) NOT NULL DEFAULT 'approved' CHECK (review_status IN ('approved','pending','rejected')),
    reviewed_by INT UNSIGNED,
    reviewed_at DATETIME,
    review_reason TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_user_photos_user (user_id, kind)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS verification_requests (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    type VARCHAR(8) NOT NULL DEFAULT 'id' CHECK (type IN ('id','selfie')),
    status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    note TEXT,
    reviewed_by INT UNSIGNED,
    reviewed_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_ver_req_user (user_id, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS posts (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    slug VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(16) NOT NULL DEFAULT 'announcement' CHECK (category IN ('story','announcement','thread')),
    excerpt TEXT,
    body TEXT NOT NULL,
    cover_url VARCHAR(500),
    author VARCHAR(255),
    status VARCHAR(16) NOT NULL DEFAULT 'published' CHECK (status IN ('published','draft')),
    published_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_posts_slug (slug),
    KEY idx_posts_status (status, published_at DESC)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  `
  CREATE TABLE IF NOT EXISTS feedback (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED,
    name VARCHAR(255),
    contact VARCHAR(255),
    category VARCHAR(16) NOT NULL DEFAULT 'other' CHECK (category IN ('suggestion','complaint','other')),
    message TEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'new' CHECK (status IN ('new','open','closed')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_feedback_status (status, created_at DESC)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
];

async function columnExists(table, column) {
  const row = await db
    .prepare(`SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`)
    .get(table, column);
  return !!row && row.c > 0;
}

// ترحيلات تدرجية — حقول جديدة فوق الجداول القائمة
async function migrate() {
  const usersCols = [
    ['deleted_at', 'DATETIME'],
    ['is_demo', 'TINYINT NOT NULL DEFAULT 0'],
    ['trust_level', 'INT NOT NULL DEFAULT 1'],
    ['email', 'VARCHAR(255)'],
    ['push_token', 'TEXT'],
    ['verified_at', 'DATETIME'],
    ['email_verified_at', 'DATETIME'],
    ['phone_verified_at', 'DATETIME'],
    ['role', `VARCHAR(32) NOT NULL DEFAULT 'user' CHECK (role IN ('user','viewer','moderator','verification_officer','customer_support','rule_admin','subscription_admin','admin','super_admin'))`],
  ];
  for (const [col, ddl] of usersCols) {
    if (!(await columnExists('users', col))) {
      await db.exec(`ALTER TABLE users ADD COLUMN ${col} ${ddl}`);
    }
  }

  const photosCols = [
    ['review_status', `VARCHAR(16) NOT NULL DEFAULT 'approved' CHECK (review_status IN ('approved','pending','rejected'))`],
    ['reviewed_by', 'INT UNSIGNED'],
    ['reviewed_at', 'DATETIME'],
    ['review_reason', 'TEXT'],
  ];
  for (const [col, ddl] of photosCols) {
    if (!(await columnExists('user_photos', col))) {
      await db.exec(`ALTER TABLE user_photos ADD COLUMN ${col} ${ddl}`);
    }
  }
}

// خطط افتراضية — قابلة للتعديل من لوحة الإدارة (Wasla_17)
async function seedPlans() {
  const plans = [
    { code: 'intro', name: 'Introductory offer', duration_months: 1, price_egp: 0, regular_price_egp: 199, features: JSON.stringify(['unlimited_likes', 'unlimited_messages', 'who_liked_you', 'share_contact']) },
    { code: 'monthly', name: 'Monthly', duration_months: 1, price_egp: 299, regular_price_egp: 599, features: JSON.stringify(['unlimited_likes', 'unlimited_messages', 'who_liked_you', 'share_contact']) },
    { code: 'quarterly', name: 'Quarterly', duration_months: 3, price_egp: 499, regular_price_egp: 999, features: JSON.stringify(['unlimited_likes', 'unlimited_messages', 'who_liked_you', 'share_contact']) },
  ];
  for (const p of plans) {
    await db
      .prepare(`INSERT IGNORE INTO plans (code, name, duration_months, price_egp, regular_price_egp, features) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(p.code, p.name, p.duration_months, p.price_egp, p.regular_price_egp, p.features);
  }
}

// مصفوفة الأدوار والصلاحيات (Wasla_25)
async function seedRolePermissions() {
  const matrix = [
    { role: 'viewer', perms: [
      ['dashboard','view'], ['queues','view'], ['audit','view'],
    ]},
    { role: 'moderator', perms: [
      ['dashboard','view'], ['queues','view'], ['content','review'],
      ['content','override'], ['users','restrict'], ['audit','view'],
    ]},
    { role: 'verification_officer', perms: [
      ['dashboard','view'], ['verification','review'], ['verification','approve'],
      ['audit','view'],
    ]},
    { role: 'customer_support', perms: [
      ['dashboard','view'], ['queues','view'], ['users','search'],
      ['refunds','handle'], ['audit','view'],
    ]},
    { role: 'rule_admin', perms: [
      ['dashboard','view'], ['rules','manage'], ['sensitive_rules','review'],
      ['config','manage'], ['audit','view'],
    ]},
    { role: 'subscription_admin', perms: [
      ['dashboard','view'], ['users','search'], ['refunds','approve'],
      ['plans','manage'], ['config','manage'], ['audit','view'],
    ]},
    { role: 'admin', perms: [
      ['dashboard','view'], ['queues','view'], ['content','review'],
      ['content','override'], ['verification','review'], ['verification','approve'],
      ['users','search'], ['users','view_sensitive'], ['users','restrict'],
      ['refunds','handle'], ['refunds','approve'], ['plans','manage'],
      ['master_data','manage'], ['rules','manage'], ['sensitive_rules','review'],
      ['workflows','manage'], ['config','manage'], ['audit','view'],
    ]},
    { role: 'super_admin', perms: [
      ['dashboard','view'], ['queues','view'], ['content','review'],
      ['content','override'], ['verification','review'], ['verification','approve'],
      ['users','search'], ['users','view_sensitive'], ['users','restrict'],
      ['refunds','handle'], ['refunds','approve'], ['plans','manage'],
      ['master_data','manage'], ['rules','manage'], ['sensitive_rules','review'],
      ['workflows','manage'], ['config','manage'], ['roles','manage'],
      ['audit','view'],
    ]},
  ];
  for (const { role, perms } of matrix) {
    for (const [resource, action] of perms) {
      await db
        .prepare(`INSERT IGNORE INTO role_permissions (role, resource, action) VALUES (?, ?, ?)`)
        .run(role, resource, action);
    }
  }
}

// Seed default workflows and rules after modules are loaded (avoid import cycle)
async function seedDynamic() {
  const { seedDefaultWorkflows } = await import('./workflows.js');
  await seedDefaultWorkflows();

  const { createRule, listRules } = await import('./rules.js');
  const existing = await listRules({ eventType: 'MessageSent' });
  if (!existing.length) {
    await createRule({
      name: 'Require selfie before messaging',
      description: 'Users without selfie_done cannot send messages',
      eventType: 'MessageSent',
      conditions: [{ all: [{ field: 'sender.selfie_done', operator: 'not_equals', value: '1' }] }],
      actions: [{ type: 'deny_action', reason: 'selfie_required' }],
      priority: 100,
      status: 'inactive',
      userMessage: 'يجب إكمال التحقق بالسيلفي قبل إرسال الرسائل',
    });
  }
}

// تهيئة قاعدة البيانات: الإنشاء + الترحيل + البذر
export async function initDb() {
  for (const stmt of SCHEMA) {
    await db.exec(stmt);
  }
  await migrate();
  await seedPlans();
  await seedRolePermissions();
  await seedDynamic();
}

export function nowIso() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}
