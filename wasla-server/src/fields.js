// Field definitions for onboarding/completion, aligned with Wasla_05 tiers.
// Weights cap at 100 through completionFor; values keep the full set usable.
export const FIELD_SPECS = {
  first_name:  { label: 'الاسم الأول',       domain: 'Identity',   tier: 1, weight: 5,  type: 'text', maxLength: 60, private: true },
  family_name: { label: 'اسم العائلة',       domain: 'Identity',   tier: 1, weight: 5,  type: 'text', maxLength: 60, private: true },
  birth_year:  { label: 'سنة الميلاد',       domain: 'Identity',   tier: 1, weight: 10, type: 'number', min: 1948, max: 2008 },
  seeking:     { label: 'أنا أبحث عن',       domain: 'Preference', tier: 1, weight: 5,  type: 'select', values: ['شريك', 'شريكة'] },
  profile_for: { label: 'الحساب لصالح',      domain: 'Account',    tier: 1, weight: 5,  type: 'select', values: ['نفسي', 'أحد من عائلتي', 'أحد من أصدقائي'] },
  country:     { label: 'الدولة',            domain: 'Personal',   tier: 1, weight: 5,  type: 'select', values: ['مصر', 'السعودية', 'الإمارات', 'الكويت', 'قطر', 'البحرين', 'عُمان', 'الأردن', 'لبنان', 'سوريا', 'العراق', 'اليمن', 'ليبيا', 'تونس', 'الجزائر', 'المغرب', 'السودان', 'تركيا', 'أخرى'] },
  governorate: { label: 'المحافظة',          domain: 'Personal',   tier: 1, weight: 5,  type: 'select', values: ['القاهرة', 'الجيزة', 'الإسكندرية', 'الدقهلية', 'البحر الأحمر', 'البحيرة', 'الفيوم', 'الغربية', 'الإسماعيلية', 'المنوفية', 'المنيا', 'القليوبية', 'الوادي الجديد', 'السويس', 'أسوان', 'أسيوط', 'بني سويف', 'بورسعيد', 'دمياط', 'الشرقية', 'جنوب سيناء', 'كفر الشيخ', 'مطروح', 'الأقصر', 'قنا', 'شمال سيناء', 'سوهاج', 'أخرى'] },
  city:        { label: 'المدينة',          domain: 'Personal',   tier: 1, weight: 5,  type: 'text', maxLength: 40 },
  nationality: { label: 'الجنسية',          domain: 'Personal',   tier: 1, weight: 5,  type: 'select', values: ['مصري', 'سعودي', 'إماراتي', 'كويتي', 'قطري', 'بحريني', 'عُماني', 'أردني', 'لبناني', 'سوري', 'عراقي', 'يمني', 'ليبي', 'تونسي', 'جزائري', 'مغربي', 'سوداني', 'تركي', 'أخرى'] },
  profession:  { label: 'المهنة',           domain: 'Career',     tier: 2, weight: 10, type: 'select', values: ['طب', 'هندسة', 'تعليم', 'تقنية معلومات', 'أعمال', 'تجارة', 'حرفي', 'قطاع حكومي', 'ربة منزل', 'طالب', 'لا أعمل', 'أخرى'] },
  profession_other: { label: 'المهنة (حدد)', domain: 'Career',    tier: 2, weight: 0,  type: 'text', maxLength: 60 },
  education:   { label: 'المؤهل الدراسي',   domain: 'Education',  tier: 2, weight: 10, type: 'select', values: ['أقل من ثانوي', 'ثانوية', 'دبلوم', 'بكالوريوس', 'ماجستير', 'دكتوراه', 'أخرى'] },
  religiosity: { label: 'الالتزام الديني',  domain: 'Religious',  tier: 2, weight: 5,  type: 'select', values: ['ملتزم', 'متوسط', 'مرن'] },
  lifestyle:   { label: 'نمط الحياة',       domain: 'Lifestyle',  tier: 2, weight: 5,  type: 'select', values: ['هادئ', 'منتظم', 'اجتماعي'] },
  height:      { label: 'الطول (سم)',       domain: 'Personal',   tier: 1, weight: 5,  type: 'number', values: null, min: 120, max: 220 },
  weight:      { label: 'الوزن (كجم)',       domain: 'Personal',   tier: 2, weight: 5,  type: 'number', values: null, min: 30, max: 250 },
  health:      { label: 'حالات صحية',       domain: 'Health',     tier: 3, weight: 5,  type: 'select', values: ['لا توجد', 'أوضح لاحقًا'], sensitive: true },
  photo_done:  { label: 'الصورة الشخصية',   domain: 'Verification', tier: 1, weight: 5,  type: 'flag' },
  selfie_done: { label: 'التحقق بالسيلفي',  domain: 'Verification', tier: 1, weight: 10, type: 'flag' },
  bio:         { label: 'نبذة عني',         domain: 'Personal',   tier: 2, weight: 10, type: 'text', maxLength: 500 },
};

export const CHECKLIST = [
  { key: 'photo_done',  label: 'أضف صورتك',               bonus: '+١٠٪' },
  { key: 'selfie_done', label: 'تحقق بالسيلفي',           bonus: '+١٥٪' },
  { key: 'profession',  label: 'أكمل المهنة',             bonus: '+١٥٪' },
  { key: 'lifestyle',   label: 'القيم ونمط الحياة',       bonus: '+١٥٪' },
  { key: 'health',      label: 'التفضيلات الحساسة',       bonus: '+٥٪ اختياري' },
];

export const MAX_TOTAL = Object.values(FIELD_SPECS).reduce((sum, s) => sum + s.weight, 0);

export function completionFor(fields) {
  const present = {};
  Object.keys(fields).forEach((k) => { present[k] = true; });
  const total = Object.keys(FIELD_SPECS).reduce((sum, key) => {
    if (present[key]) return sum + FIELD_SPECS[key].weight;
    return sum;
  }, 0);
  const pct = Math.min(100, Math.round((total / MAX_TOTAL) * 100));
  return {
    pct,
    total,
    max: MAX_TOTAL,
    done: Object.keys(FIELD_SPECS).filter((k) => present[k]),
    missing: Object.keys(FIELD_SPECS).filter((k) => !present[k]),
    checklist: CHECKLIST.map((c) => ({ ...c, done: present[c.key] })),
  };
}

export function isValidFieldValue(key, value) {
  const spec = FIELD_SPECS[key];
  if (!spec) return { ok: false, reason: 'unknown_field' };
  if (spec.type === 'number') {
    const n = Number(value);
    if (!Number.isFinite(n)) return { ok: false, reason: 'not_a_number' };
    if (key === 'birth_year') {
      if (n < 1948 || n > 2008) return { ok: false, reason: 'birth_year_range' };
      return { ok: true, value: String(Math.floor(n)) };
    }
    if (key === 'height' && (n < (spec.min || 0) || n > (spec.max || 999))) return { ok: false, reason: 'height_range' };
    return { ok: true, value: String(n) };
  }
  if (spec.type === 'flag') {
    if (value !== 1 && value !== true && value !== '1') return { ok: false, reason: 'flag_expected' };
    return { ok: true, value: '1' };
  }
  if (spec.type === 'select') {
    if (!spec.values.includes(value)) return { ok: false, reason: 'invalid_choice' };
    return { ok: true, value };
  }
  if (spec.type === 'text') {
    const s = String(value || '').trim();
    if (!s) return { ok: false, reason: 'empty_text' };
    if (s.length > (spec.maxLength || 2000)) return { ok: false, reason: 'too_long' };
    return { ok: true, value: s };
  }
  return { ok: false, reason: 'invalid_type' };
}
