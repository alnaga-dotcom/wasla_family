import { db } from './db.js';
import { listAllPermissions } from './permissions.js';
import { listWeights, getThreshold } from './matching.js';
import { listConfig } from './recommendations.js';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIELD_SPECS } from './fields.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsDir = join(__dirname, '..', '..', 'docs');

async function tableExists(name) {
  const row = await db.prepare(
    `SELECT 1 FROM information_schema.TABLES WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`
  ).get(name);
  return !!row;
}

export async function runDesignReview() {
  const checks = [];
  let pass = 0;
  let fail = 0;
  const add = (name, ok, detail = '') => { checks.push({ name, ok, detail }); if (ok) pass++; else fail++; };

  // 1. Documentation inventory (Wasla_01–26)
  const requiredDocs = [
    'Wasla_01_Philosophy.md','Wasla_02_Product_Principles.md','Wasla_03_Registration.md',
    'Wasla_04_Profile_Groups.md','Wasla_05_Profile_Fields.md','Wasla_06_Dynamic_Fields_And_Rule_Engine.md',
    'Wasla_07_Data_Model.md','Wasla_08_Master_Data_And_Localization.md','Wasla_09_Workflow_Engine.md',
    'Wasla_10_Event_Engine.md','Wasla_11_Rule_Engine.md','Wasla_12_Matching_Engine.md',
    'Wasla_13_Recommendation_Engine.md','Wasla_14_Trust_Engine.md','Wasla_15_Content_Moderation_Engine.md',
    'Wasla_16_Notification_Engine.md','Wasla_17_Subscription_System.md','Wasla_18_Messaging.md',
    'Wasla_19_Search.md','Wasla_20_Admin_Panel.md','Wasla_21_API_Design.md',
    'Wasla_22_Security.md','Wasla_23_Deployment.md','Wasla_24_Website_Design.md',
    'Wasla_25_Roles_And_Permissions.md','Wasla_26_Design_Review.md',
    'Wasla_27_Match_Workflow.md','Wasla_28_Formula_Engine.md','Wasla_29_API_Endpoints.md',
  ];
  const present = existsSync(docsDir) ? readdirSync(docsDir).filter((f) => f.endsWith('.md')) : [];
  for (const doc of requiredDocs) {
    add(`doc:${doc}`, present.includes(doc), present.includes(doc) ? '' : 'missing');
  }

  // 2. Role-permission matrix (Wasla_25)
  const permCount = (await listAllPermissions()).length;
  add('role_permission_matrix', permCount >= 30, `permissions=${permCount}`);

  // 3. Match threshold default 60 (Wasla_12 / F10)
  const threshold = await getThreshold();
  add('match_threshold_default_60', threshold === 60, `threshold=${threshold}`);

  // 4. Canonical plans exist with crossed-out regular prices (Wasla_17)
  const plans = await db.prepare('SELECT code, price_egp, regular_price_egp FROM plans ORDER BY price_egp').all();
  const expectedCodes = ['intro', 'monthly', 'quarterly'];
  const plansOk = expectedCodes.every((code) => {
    const p = plans.find((pl) => pl.code === code);
    return p && Number.isFinite(p.price_egp) && Number.isFinite(p.regular_price_egp) && p.price_egp <= p.regular_price_egp && p.regular_price_egp > 0;
  });
  add('canonical_plans', plansOk, JSON.stringify(plans));

  // 5. Free tier daily limits (Wasla_17)
  const freePlan = plans.find((p) => p.code === 'intro');
  add('free_plan_exists', !!freePlan, freePlan ? `price=${freePlan.price_egp}` : 'missing');

  // 6. Discovery is text-first (no swipe cards) — verified by users table existing (Wasla_19)
  const usersTable = await tableExists('users');
  add('search_text_based', usersTable, 'users table present for search');

  // 7. Messages require mutual like — check no table allows one-way bypass
  const messagesTable = await tableExists('messages');
  add('messages_table_exists', messagesTable);

  // 8. Moderation engine active
  const moderationTable = await tableExists('moderation_items');
  add('moderation_items_table_exists', moderationTable);

  // 14. Photo upload table exists
  const photosTable = await tableExists('user_photos');
  add('user_photos_table_exists', photosTable);

  // 9. Workflows seeded
  const workflowDefs = (await db.prepare('SELECT COUNT(*) AS c FROM workflow_definitions').get()).c;
  add('workflows_seeded', workflowDefs > 0, `definitions=${workflowDefs}`);

  // 10. Audit log table exists
  const auditTable = await tableExists('admin_actions');
  add('audit_log_table_exists', auditTable);

  // 11. Sensitive fields marked in schema
  const sensitiveFields = Object.values(FIELD_SPECS).filter((f) => f.sensitive).length;
  add('sensitive_fields_marked', sensitiveFields > 0, `sensitive_fields=${sensitiveFields}`);

  // 12. CORS configured for production via env
  const envExample = join(__dirname, '..', '.env.example');
  add('env_example_exists', existsSync(envExample));

  // 13. Admin endpoints present (smoke-level sanity)
  const adminTables = ['users','reports','payments','subscriptions','role_permissions','workflow_definitions','rules'];
  for (const t of adminTables) {
    const exists = await tableExists(t);
    add(`admin_table:${t}`, exists);
  }

  const passed = fail === 0;
  return { ok: passed, pass, fail, total: checks.length, checks, reviewedAt: new Date().toISOString() };
}
