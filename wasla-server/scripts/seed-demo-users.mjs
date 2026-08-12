// Seeding 10 demo/display accounts (is_demo=1, 017 numbers) for testing search + matching.
// Run against the SAME DB the server uses (env WASLA_DB_*), e.g.:
//   node scripts/seed-demo-users.mjs
// Overrides:
//   WASLA_DEMO_EMAIL_TEMPLATE = 'ostazi.academy+demo{n}@gmail.com' (default; {n} = 1..10)
import 'dotenv/config';
import { db } from '../src/db.js';

const TEMPLATE = process.env.WASLA_DEMO_EMAIL_TEMPLATE || 'ostazi.academy+demo{n}@gmail.com';

const PROFILES = [
  { gender: 'male',   first_name: 'محمد',    family_name: 'عبد الرحمن', birth_year: 1991, city: 'القاهرة',     governorate: 'القاهرة',     profession: 'هندسة',          education: 'بكالوريوس', religiosity: 'ملتزم', lifestyle: 'هادئ',    height: 178, weight: 82, marital_status: 'أعزب',   has_kids: 'لا',  want_kids: 'نعم', partner_marital_status: 'أعزب/عزباء فقط', partner_has_kids: 'لا', partner_want_kids: 'نعم', bio: 'مهندس معماري، أبحث عن شريكة حياة جادة لأستقر معها.' },
  { gender: 'female', first_name: 'سارة',     family_name: 'أحمد',      birth_year: 1995, city: 'الجيزة',      governorate: 'الجيزة',      profession: 'تقنية معلومات', education: 'بكالوريوس', religiosity: 'ملتزم', lifestyle: 'منتظم',  height: 163, weight: 58, marital_status: 'أعزب',   has_kids: 'لا',  want_kids: 'نعم', partner_marital_status: 'أعزب/عزباء فقط', partner_has_kids: 'لا', partner_want_kids: 'نعم', bio: 'مطورة برمجيات، أحب القراءة والسفر، وأبحث عن شريك متوافق.' },
  { gender: 'male',   first_name: 'كريم',    family_name: 'محمد',      birth_year: 1988, city: 'الإسكندرية', governorate: 'الإسكندرية', profession: 'طب',            education: 'ماجستير',  religiosity: 'متوسط', lifestyle: 'اجتماعي', height: 181, weight: 86, marital_status: 'مطلق',  has_kids: 'نعم', want_kids: 'نعم', partner_marital_status: 'مطلق/مطلقة', partner_has_kids: 'نعم', partner_want_kids: 'نعم', bio: 'طبيب أسنان، مطلق ولدي طفلة، أبحث عن شريكة متفهمة.' },
  { gender: 'female', first_name: 'منى',      family_name: 'إبراهيم',    birth_year: 1990, city: 'المنصورة',    governorate: 'الدقهلية',    profession: 'تعليم',         education: 'بكالوريوس', religiosity: 'ملتزم', lifestyle: 'هادئ',    height: 160, weight: 55, marital_status: 'مطلقة', has_kids: 'نعم', want_kids: 'لا', partner_marital_status: 'مطلق/مطلقة', partner_has_kids: 'نعم', partner_want_kids: 'لا', bio: 'مدرسة لغة عربية، أحب البيت والهدوء، لدي ابنة وأبحث عن شريك جاد.' },
  { gender: 'male',   first_name: 'أحمد',    family_name: 'السيد',       birth_year: 1997, city: 'طنطا',        governorate: 'الغربية',     profession: 'أعمال',          education: 'بكالوريوس', religiosity: 'متوسط', lifestyle: 'منتظم',  height: 175, weight: 78, marital_status: 'أعزب',   has_kids: 'لا',  want_kids: 'نعم', partner_marital_status: 'أي حالة', partner_has_kids: 'نعم', partner_want_kids: 'نعم', bio: 'أعمل في التجارة الحرة، أهوى كرة القدم وأبحث عن شريكة هادئة.' },
  { gender: 'female', first_name: 'نور',      family_name: 'علي',         birth_year: 1993, city: 'شبين الكوم',  governorate: 'المنوفية',    profession: 'ربة منزل',       education: 'ثانوية',   religiosity: 'ملتزم', lifestyle: 'هادئ',    height: 158, weight: 52, marital_status: 'أرمل',  has_kids: 'نعم', want_kids: 'لا', partner_marital_status: 'أرمل/أرملة', partner_has_kids: 'نعم', partner_want_kids: 'لا', bio: 'أرملة وأم لطفلين، أبحث عن شريك يقدر الأمانة والهدوء.' },
  { gender: 'male',   first_name: 'عمرو',     family_name: 'حسن',         birth_year: 1986, city: 'أسيوط',       governorate: 'أسيوط',        profession: 'قطاع حكومي',      education: 'دبلوم',    religiosity: 'متوسط', lifestyle: 'منتظم',  height: 172, weight: 80, marital_status: 'أعزب',   has_kids: 'لا',  want_kids: 'نعم', partner_marital_status: 'أي حالة', partner_has_kids: 'نعم', partner_want_kids: 'نعم', bio: 'موظف حكومي، شخصية مستقرة وأبحث عن شريكة للاستقرار.' },
  { gender: 'female', first_name: 'هاجر',     family_name: 'مصطفى',       birth_year: 1998, city: 'الفيوم',      governorate: 'الفيوم',       profession: 'طالب',           education: 'بكالوريوس', religiosity: 'ملتزم', lifestyle: 'هادئ',    height: 161, weight: 54, marital_status: 'أعزب',   has_kids: 'لا',  want_kids: 'نعم', partner_marital_status: 'أعزب/عزباء فقط', partner_has_kids: 'لا', partner_want_kids: 'نعم', bio: 'طالبة دراسات عليا في الصيدلة، أبحث عن شريك طموح.' },
  { gender: 'male',   first_name: 'يوسف',     family_name: 'عبد الله',    birth_year: 1990, city: 'بورسعيد',     governorate: 'بورسعيد',      profession: 'تقنية معلومات', education: 'ماجستير',  religiosity: 'ملتزم', lifestyle: 'منتظم',  height: 176, weight: 75, marital_status: 'أعزب',   has_kids: 'لا',  want_kids: 'نعم', partner_marital_status: 'أعزب/عزباء فقط', partner_has_kids: 'لا', partner_want_kids: 'نعم', bio: 'مهندس برمجيات، هادئ ومنظم، أبحث عن شريكة متوافقة فكريًا.' },
  { gender: 'female', first_name: 'شيماء',    family_name: 'فتحي',        birth_year: 1989, city: 'الأقصر',      governorate: 'الأقصر',       profession: 'تعليم',          education: 'بكالوريوس', religiosity: 'ملتزم', lifestyle: 'اجتماعي', height: 162, weight: 57, marital_status: 'أعزب',   has_kids: 'لا',  want_kids: 'نعم', partner_marital_status: 'أي حالة', partner_has_kids: 'نعم', partner_want_kids: 'نعم', bio: 'معلمة، اجتماعية وأحب التعارف الجاد، أبحث عن شريك مستقيم.' },
];

const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

function baseFields(p) {
  return {
    first_name: p.first_name,
    family_name: p.family_name,
    birth_year: String(p.birth_year),
    seeking: p.gender === 'male' ? 'شريكة' : 'شريك',
    profile_for: 'نفسي',
    country: 'مصر',
    governorate: p.governorate,
    city: p.city,
    nationality: 'مصري',
    profession: p.profession,
    education: p.education,
    religiosity: p.religiosity,
    lifestyle: p.lifestyle,
    height: String(p.height),
    weight: String(p.weight),
    health: 'لا توجد',
    bio: p.bio,
    marital_status: p.marital_status,
    has_kids: p.has_kids,
    kids_living: p.has_kids === 'نعم' ? 'معي' : 'غير منطبق',
    want_kids: p.want_kids,
    partner_marital_status: p.partner_marital_status,
    partner_has_kids: p.partner_has_kids,
    partner_kids_living: p.partner_has_kids === 'نعم' ? 'معه/معها' : 'غير منطبق',
    partner_want_kids: p.partner_want_kids,
    marital_done: '1',
    selfie_done: '1',
  };
}

async function upsertUser(i, p) {
  const phone = `0171${String(i).padStart(7, '0')}`; // 017 + 8 digits → 11 digits, valid Egyptian number
  const email = TEMPLATE.replace('{n}', String(i));
  const name = `${p.first_name} ${p.family_name}`;
  await db.prepare(
    `INSERT INTO users (name, phone, email, gender, status, is_demo, email_verified_at, phone_verified_at, created_at)
     VALUES (?, ?, ?, ?, 'active', 1, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), status = 'active', is_demo = 1, email_verified_at = VALUES(email_verified_at)`
  ).run(name, phone, email, p.gender, now, now, now);
  const u = await db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  const userId = Number(u.id);

  const fields = baseFields(p);
  for (const [key, value] of Object.entries(fields)) {
    await db.prepare(
      `INSERT INTO profile_fields (user_id, field_key, value, domain, \`sensitive\`, updated_at)
       VALUES (?, ?, ?, 'registration', 0, ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)`
    ).run(userId, key, value, now);
  }
  return { i, userId, phone, email, name };
}

// بعض الإعجابات بين الحسابات التجريبية لعرض المطابقات (ديمو فقط، بلا أحداث/إشعارات).
async function seedDemoLikes(ids) {
  const pairs = [[ids[0], ids[1]], [ids[2], ids[3]], [ids[4], ids[5]]];
  for (const [a, b] of pairs) {
    if (!a || !b) continue;
    for (const [actor, target] of [[a, b], [b, a]]) {
      await db.prepare(
        `INSERT INTO match_actions (actor_id, target_id, action, created_at) VALUES (?, ?, 'like', ?)
         ON DUPLICATE KEY UPDATE action = VALUES(action), created_at = VALUES(created_at)`
      ).run(actor, target, now);
    }
  }
}

const inserted = [];
for (let i = 0; i < PROFILES.length; i++) {
  inserted.push(await upsertUser(i + 1, PROFILES[i]));
}

await seedDemoLikes(inserted.map((x) => x.userId));
await db.close();

console.log('Seeded 10 demo users (is_demo=1):');
inserted.forEach((x) => console.log(`  #${x.i} id=${x.userId} ${x.name} — ${x.phone} — ${x.email}`));
console.log('Login via OTP (sent to email). Demo accounts are view/search-only for real users (likes blocked across real/demo).');
