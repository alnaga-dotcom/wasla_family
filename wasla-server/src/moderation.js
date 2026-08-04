import { db } from './db.js';

const VERSION = 'wasla-moderation-v1.0.0';

const ARABIC_INDIC = /[٠١٢٣٤٥٦٧٨٩]/g;
const ARABIC_INDIC_MAP = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };

function normalize(text) {
  let s = String(text || '');
  // Unicode NFKC
  s = s.normalize('NFKC');
  // Remove zero-width and invisible
  s = s.replace(/[\u200B-\u200F\uFEFF\u2060\u00AD]/g, '');
  // Remove diacritics
  s = s.replace(/[\u064B-\u065F\u0670\u0640]/g, '');
  // Unify Arabic letters
  s = s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
  // Convert Arabic-Indic digits
  s = s.replace(ARABIC_INDIC, (c) => ARABIC_INDIC_MAP[c]);
  // Remove excessive repetition
  s = s.replace(/(.)\1{3,}/g, '$1$1');
  // Lowercase Latin
  s = s.toLowerCase();
  return s;
}

const PHONE_RE = /(?:\+?2\s?0?|0)?1\s?[0-9]{2,3}\s?[0-9]{3}\s?[0-9]{3,4}|\+\d{1,3}[\s\-]?\d{1,4}[\s\-]?\d{3,4}[\s\-]?\d{3,4}/;
const EMAIL_RE = /[a-z0-9._%+-]+\s*(?:\(at\)|@|\[at\]|at|ات|ا\.ت)\s*[a-z0-9.-]+\s*(?:\(dot\)|\.|\[dot\]|dot|دوت|نقطة)/;
const URL_RE = /(?:https?:\/\/|www\.|bit\.ly|tinyurl|t\.me|linktr\.ee|rebrand\.ly|short\.link)[^\s\)\]\}]+/;
const SOCIAL_RE = /(واتس\s*اب|واتس|تليجرام|تلغرام|سيجنال|سناب\s*شات|سناب|انست[جر][ا-ي]*|فيس\s*بوك|فيسبوك|تيك\s*توك|ديسكورد|وي\s*تشات|لاين|سكايب|whatsapp|telegram|signal|snapchat|instagram|facebook|tiktok|discord|wechat|line|skype|t\.me|wa\.me)/;
const OBFSUCATION_RE = /\b(at|arroba|dot|نقطة|دوت|ات|شرطة|underscore|ا\.ت|\bwa\b|\btw\b|\binst\b|\bface\b)\b/;

const SCORES = {
  phone: 80,
  email: 100,
  url: 70,
  social: 80,
  obfuscation: 50,
  profanity: 90,
};

const ARABIC_LEET_MAP = { '0': 'ا', '1': 'ل', '3': 'ا', '5': 'س', '7': 'ط', '8': 'ب', '9': 'ق' };
const LATIN_LEET_MAP = { '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g' };

const PROFANITY_TERMS = [
  // Arabic (normalized form: أإآ->ا, ة->ه, ى->ي)
  'احا', 'اخا', 'ابن كس', 'ابن شرموطه', 'ابن وسخه', 'بنت كس', 'بنت شرموطه', 'بنت وسخه',
  'عرص', 'زباله', 'زفت', 'خراء', 'خرا', 'خره', 'شرموط', 'متناك', 'منيوك', 'نياك', 'نيك',
  'ينيك', 'يانيك', 'انيك', 'كس', 'زب', 'قضيب', 'طيز', 'عهر', 'قحبه', 'عاهره', 'لوطي',
  'سحاقي', 'سحاقيه', 'خنيث', 'ديوث', 'كسمك', 'كسمها', 'متناكه', 'شرموطه',
  'بهيم', 'حيوان', 'كلب', 'غبي', 'اهبل', 'مغفل', 'غلس', 'مشخله', 'شحات', 'حرامي',
  'وسخه', 'قذاره', 'وصخ', 'قرد', 'حمار',
  // English
  'fuck', 'fuk', 'fucc', 'fucker', 'shit', 'bitch', 'whore', 'slut', 'asshole', 'pussy',
  'dick', 'cock', 'nigger', 'nigga', 'retard', 'bastard', 'cunt', 'fag', 'faggot',
];

const ESC_RE = /[.*+?^${}()|[\]\\]/g;
const PROFANITY_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${PROFANITY_TERMS.map((t) => t.replace(ESC_RE, '\\$&')).join('|')})(?![\\p{L}\\p{N}])`,
  'iu'
);

function profanityVariants(text) {
  const n = normalize(text);
  return [
    n,
    n.replace(/[0-9]/g, ''),
    n.replace(/[0-9]/g, (d) => ARABIC_LEET_MAP[d] || d),
    n.replace(/[0-9]/g, (d) => LATIN_LEET_MAP[d] || d),
  ];
}

function hasProfanity(normalized) {
  for (const v of profanityVariants(normalized)) {
    const m = v.match(PROFANITY_RE);
    if (m) return m[0];
  }
  return null;
}

function detect(normalized) {
  const violations = [];
  let score = 0;
  const push = (type, matched) => {
    violations.push({ type, matched: matched.slice(0, 80) });
    score = Math.max(score, SCORES[type]);
  };

  const phone = normalized.match(PHONE_RE);
  if (phone) push('phone', phone[0]);

  const email = normalized.match(EMAIL_RE);
  if (email) push('email', email[0]);

  const url = normalized.match(URL_RE);
  if (url) push('url', url[0]);

  const social = normalized.match(SOCIAL_RE);
  if (social) push('social', social[0]);

  const obs = normalized.match(OBFSUCATION_RE);
  if (obs) push('obfuscation', obs[0]);

  const profanity = hasProfanity(normalized);
  if (profanity) push('profanity', profanity);

  return { score, violations };
}

function statusFromScore(score) {
  if (score >= 61) return 'reject';
  if (score >= 21) return 'review';
  return 'accept';
}

export function check(text) {
  const n = normalize(text);
  const { score, violations } = detect(n);
  const status = statusFromScore(score);
  return {
    allowed: status !== 'reject',
    review: status === 'review',
    riskScore: score,
    status: status === 'reject' ? 'REJECT' : status === 'review' ? 'REVIEW' : 'ACCEPT',
    violations,
    version: VERSION,
  };
}

export function checkField(userId, fieldKey, value) {
  return checkText(userId, 'profile_field', value, { field_key: fieldKey, item_id: `profile:${userId}:${fieldKey}` });
}

export function checkMessage(userId, text, messageId) {
  return checkText(userId, 'message', text, { item_id: String(messageId || ''), item_type: 'message' });
}

export function checkText(userId, itemType, text, meta = {}) {
  const result = check(text);
  const normalized = normalize(text);
  if (result.status !== 'ACCEPT' || result.review) {
    const r = db.prepare(
      `INSERT INTO moderation_items (user_id, item_type, item_id, field_key, original_text, normalized_text, risk_score, status, violations)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      meta.item_type || itemType,
      meta.item_id || '',
      meta.field_key || null,
      text.slice(0, 500),
      normalized.slice(0, 500),
      result.riskScore,
      result.status === 'REJECT' ? 'rejected' : 'pending',
      JSON.stringify(result.violations)
    );
    result.itemId = Number(r.lastInsertRowid);
  }
  return result;
}

export function getQueue(status = 'pending', limit = 200) {
  return db.prepare(
    `SELECT * FROM moderation_items WHERE status = ? ORDER BY risk_score DESC, id DESC LIMIT ?`
  ).all(status, limit);
}

export function resolveItem(itemId, action, actorId, actorRole, reason) {
  const status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'overturned';
  db.prepare('UPDATE moderation_items SET status = ? WHERE id = ?').run(status, itemId);
  db.prepare(
    `INSERT INTO moderation_decisions (item_id, actor_id, actor_role, action, reason) VALUES (?, ?, ?, ?, ?)`
  ).run(itemId, actorId || null, actorRole || null, action, reason || null);
  return { itemId, status };
}

export function itemById(itemId) {
  return db.prepare('SELECT * FROM moderation_items WHERE id = ?').get(itemId);
}

export function maskedText(text) {
  return String(text || '').replace(PHONE_RE, '[رقم هاتف]').replace(EMAIL_RE, '[بريد إلكتروني]').replace(URL_RE, '[رابط]');
}
