import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(join(dataDir, 'wasla.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    gender TEXT NOT NULL CHECK (gender IN ('male','female')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
    email_verified_at TEXT,
    phone_verified_at TEXT,
    verified_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS otp_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    code TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'register',
    expires_at TEXT NOT NULL,
    used_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_otp_user ON otp_codes(user_id);

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS profile_fields (
    user_id INTEGER NOT NULL REFERENCES users(id),
    field_key TEXT NOT NULL,
    value TEXT NOT NULL,
    domain TEXT NOT NULL,
    sensitive INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, field_key)
  );

  CREATE TABLE IF NOT EXISTS discovery_views (
    actor_id INTEGER NOT NULL REFERENCES users(id),
    target_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (actor_id, target_id)
  );

  CREATE TABLE IF NOT EXISTS match_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER NOT NULL REFERENCES users(id),
    target_id INTEGER NOT NULL REFERENCES users(id),
    action TEXT NOT NULL CHECK (action IN ('like','pass')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (actor_id, target_id)
  );
  CREATE INDEX IF NOT EXISTS idx_actions_target ON match_actions(target_id);

  CREATE TABLE IF NOT EXISTS archived_matches (
    user_id INTEGER NOT NULL REFERENCES users(id),
    other_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, other_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    receiver_id INTEGER NOT NULL REFERENCES users(id),
    text TEXT,
    kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text','ephemeral')),
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_msgs_pair ON messages(sender_id, receiver_id, id);

  CREATE TABLE IF NOT EXISTS blocked_members (
    user_id INTEGER NOT NULL REFERENCES users(id),
    blocked_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, blocked_id)
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id INTEGER NOT NULL REFERENCES users(id),
    reported_id INTEGER NOT NULL REFERENCES users(id),
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    photo_visibility INTEGER NOT NULL DEFAULT 0,
    last_seen_on INTEGER NOT NULL DEFAULT 1,
    paused INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    from_user_id INTEGER,
    type TEXT NOT NULL,
    text TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);

  CREATE TABLE IF NOT EXISTS favorites (
    user_id INTEGER NOT NULL REFERENCES users(id),
    favorite_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, favorite_id)
  );
  CREATE INDEX IF NOT EXISTS idx_fav_target ON favorites(favorite_id);

  CREATE TABLE IF NOT EXISTS plans (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    duration_months INTEGER NOT NULL DEFAULT 1,
    price_egp INTEGER NOT NULL DEFAULT 0,
    regular_price_egp INTEGER,
    features TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive'))
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    plan_code TEXT NOT NULL REFERENCES plans(code),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending','paid','active','expired','cancelled')),
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    auto_renew INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id, status, ends_at);

  CREATE TABLE IF NOT EXISTS daily_quotas (
    user_id INTEGER NOT NULL REFERENCES users(id),
    day TEXT NOT NULL,
    likes_used INTEGER NOT NULL DEFAULT 0,
    messages_used INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    subscription_id INTEGER REFERENCES subscriptions(id),
    amount_egp INTEGER NOT NULL,
    provider TEXT,
    provider_ref TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS admin_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER REFERENCES users(id),
    actor_role TEXT,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    reason TEXT,
    meta TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_admin_actions_actor ON admin_actions(actor_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON admin_actions(target_type, target_id, created_at);

  CREATE TABLE IF NOT EXISTS moderation_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    item_type TEXT NOT NULL CHECK (item_type IN ('message','profile_field','report','display_name')),
    item_id TEXT,
    field_key TEXT,
    original_text TEXT,
    normalized_text TEXT,
    risk_score INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','overturned')),
    violations TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_moderation_status ON moderation_items(status, risk_score DESC);
  CREATE INDEX IF NOT EXISTS idx_moderation_user ON moderation_items(user_id, created_at);

  CREATE TABLE IF NOT EXISTS moderation_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL REFERENCES moderation_items(id),
    actor_id INTEGER REFERENCES users(id),
    actor_role TEXT,
    action TEXT NOT NULL CHECK (action IN ('approve','reject','overturn')),
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_moderation_decisions_item ON moderation_decisions(item_id);

  CREATE TABLE IF NOT EXISTS match_scores (
    user_id INTEGER NOT NULL REFERENCES users(id),
    target_id INTEGER NOT NULL REFERENCES users(id),
    score INTEGER NOT NULL DEFAULT 0,
    level TEXT NOT NULL DEFAULT 'low',
    reasons TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, target_id)
  );
  CREATE INDEX IF NOT EXISTS idx_match_scores_user ON match_scores(user_id, score DESC);

  CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0',
    source TEXT NOT NULL,
    user_id INTEGER,
    entity_type TEXT,
    entity_id TEXT,
    correlation_id TEXT,
    payload TEXT NOT NULL,
    published_at TEXT NOT NULL DEFAULT (datetime('now')),
    processed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_events_type ON events(type, published_at);
  CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_type, entity_id, published_at);

  CREATE TABLE IF NOT EXISTS workflow_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    states TEXT NOT NULL,
    transitions TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (key, version)
  );

  CREATE TABLE IF NOT EXISTS workflow_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    definition_id INTEGER NOT NULL REFERENCES workflow_definitions(id),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    current_state TEXT NOT NULL,
    previous_state TEXT,
    context TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (definition_id, entity_type, entity_id)
  );
  CREATE INDEX IF NOT EXISTS idx_workflow_state ON workflow_instances(current_state, updated_at);

  CREATE TABLE IF NOT EXISTS workflow_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id INTEGER NOT NULL REFERENCES workflow_instances(id),
    from_state TEXT,
    to_state TEXT NOT NULL,
    actor_id INTEGER,
    actor_role TEXT,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_workflow_history ON workflow_history(instance_id, created_at);

  CREATE TABLE IF NOT EXISTS rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL,
    conditions TEXT NOT NULL,
    actions TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','draft')),
    user_message TEXT,
    sensitive INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_rules_event ON rules(event_type, priority DESC);

  CREATE TABLE IF NOT EXISTS rule_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id INTEGER NOT NULL REFERENCES rules(id),
    event_id TEXT,
    context TEXT,
    result TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recommendation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    viewer_id INTEGER NOT NULL REFERENCES users(id),
    target_id INTEGER NOT NULL REFERENCES users(id),
    source TEXT,
    position INTEGER,
    opened INTEGER NOT NULL DEFAULT 0,
    liked INTEGER NOT NULL DEFAULT 0,
    ignored INTEGER NOT NULL DEFAULT 0,
    shown_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_rec_history_viewer ON recommendation_history(viewer_id, target_id, shown_at);

  CREATE TABLE IF NOT EXISTS role_permissions (
    role TEXT NOT NULL,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    PRIMARY KEY (role, resource, action)
  );

  CREATE TABLE IF NOT EXISTS user_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL CHECK (kind IN ('profile','selfie')),
    filename TEXT NOT NULL,
    original_name TEXT,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deleted')),
    review_status TEXT NOT NULL DEFAULT 'approved' CHECK (review_status IN ('approved','pending','rejected')),
    reviewed_by INTEGER,
    reviewed_at TEXT,
    review_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_user_photos_user ON user_photos(user_id, kind);

  CREATE TABLE IF NOT EXISTS verification_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL DEFAULT 'id' CHECK (type IN ('id','selfie')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    note TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_ver_req_user ON verification_requests(user_id, status);

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'announcement' CHECK (category IN ('story','announcement','thread')),
    excerpt TEXT,
    body TEXT NOT NULL,
    cover_url TEXT,
    author TEXT,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','draft')),
    published_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status, published_at DESC);

  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    name TEXT,
    contact TEXT,
    category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('suggestion','complaint','other')),
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','open','closed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status, created_at DESC);
`);

// ترحيلات تدرجية — حقول جديدة فوق الجداول القائمة
function migrate() {
  const cols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
  if (!cols.includes('deleted_at')) {
    db.exec('ALTER TABLE users ADD COLUMN deleted_at TEXT');
  }
  if (!cols.includes('trust_level')) {
    db.exec('ALTER TABLE users ADD COLUMN trust_level INTEGER NOT NULL DEFAULT 1');
  }
  if (!cols.includes('email')) {
    db.exec('ALTER TABLE users ADD COLUMN email TEXT');
  }
  if (!cols.includes('push_token')) {
    db.exec('ALTER TABLE users ADD COLUMN push_token TEXT');
  }
  if (!cols.includes('verified_at')) {
    db.exec('ALTER TABLE users ADD COLUMN verified_at TEXT');
  }
  if (!cols.includes('email_verified_at')) {
    db.exec('ALTER TABLE users ADD COLUMN email_verified_at TEXT');
  }
  if (!cols.includes('phone_verified_at')) {
    db.exec('ALTER TABLE users ADD COLUMN phone_verified_at TEXT');
  }

  // Photo moderation columns (profile/selfie review workflow)
  const pcols = db.prepare("PRAGMA table_info(user_photos)").all().map((c) => c.name);
  if (!pcols.includes('review_status')) {
    db.exec(`ALTER TABLE user_photos ADD COLUMN review_status TEXT NOT NULL DEFAULT 'approved' CHECK (review_status IN ('approved','pending','rejected'))`);
  }
  if (!pcols.includes('reviewed_by')) {
    db.exec('ALTER TABLE user_photos ADD COLUMN reviewed_by INTEGER');
  }
  if (!pcols.includes('reviewed_at')) {
    db.exec('ALTER TABLE user_photos ADD COLUMN reviewed_at TEXT');
  }
  if (!pcols.includes('review_reason')) {
    db.exec('ALTER TABLE user_photos ADD COLUMN review_reason TEXT');
  }

  const roleAllowed = "'user','viewer','moderator','verification_officer','customer_support','rule_admin','subscription_admin','admin','super_admin'";
  if (!cols.includes('role')) {
    db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK (role IN (${roleAllowed}))`);
  } else {
    // Recreate users table to update role CHECK constraint (SQLite cannot ALTER CHECK)
    const current = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get().sql;
    if (!current.includes('verification_officer') || !current.includes('customer_support') || !current.includes('rule_admin')) {
      db.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          phone TEXT NOT NULL UNIQUE,
          email TEXT,
          gender TEXT NOT NULL CHECK (gender IN ('male','female')),
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
          role TEXT NOT NULL DEFAULT 'user' CHECK (role IN (${roleAllowed})),
          trust_level INTEGER NOT NULL DEFAULT 1,
          push_token TEXT,
          email_verified_at TEXT,
          phone_verified_at TEXT,
          verified_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          deleted_at TEXT
        );
        INSERT INTO users_new SELECT id, name, phone, email, gender, status, role, trust_level, push_token, email_verified_at, phone_verified_at, verified_at, created_at, deleted_at FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
        PRAGMA foreign_keys = ON;
      `);
    }
  }
}
migrate();

// خطط افتراضية — قابلة للتعديل من لوحة الإدارة (Wasla_17)
function seedPlans() {
  const plans = [
    { code: 'intro', name: 'Introductory offer', duration_months: 1, price_egp: 0, regular_price_egp: 199, features: JSON.stringify(['unlimited_likes', 'unlimited_messages', 'who_liked_you', 'share_contact']) },
    { code: 'monthly', name: 'Monthly', duration_months: 1, price_egp: 299, regular_price_egp: 599, features: JSON.stringify(['unlimited_likes', 'unlimited_messages', 'who_liked_you', 'share_contact']) },
    { code: 'quarterly', name: 'Quarterly', duration_months: 3, price_egp: 499, regular_price_egp: 999, features: JSON.stringify(['unlimited_likes', 'unlimited_messages', 'who_liked_you', 'share_contact']) },
  ];
  const insert = db.prepare(`INSERT OR IGNORE INTO plans (code, name, duration_months, price_egp, regular_price_egp, features) VALUES (?, ?, ?, ?, ?, ?)`);
  for (const p of plans) insert.run(p.code, p.name, p.duration_months, p.price_egp, p.regular_price_egp, p.features);
}
seedPlans();

// مصفوفة الأدوار والصلاحيات (Wasla_25)
function seedRolePermissions() {
  // resource.action
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
  const insert = db.prepare(`INSERT OR IGNORE INTO role_permissions (role, resource, action) VALUES (?, ?, ?)`);
  for (const { role, perms } of matrix) {
    for (const [resource, action] of perms) insert.run(role, resource, action);
  }
}
seedRolePermissions();

// Seed default workflows and rules after modules are loaded (avoid top-level import cycle)
import('./workflows.js').then(({ seedDefaultWorkflows }) => seedDefaultWorkflows()).catch(() => {});
import('./rules.js').then(({ createRule, listRules }) => {
  const existing = listRules({ eventType: 'MessageSent' });
  if (!existing.length) {
    // Sample rule — inactive by default so it does not break the app out of the box
    createRule({
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
}).catch(() => {});

export function nowIso() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}
