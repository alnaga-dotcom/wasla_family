// Field definitions for onboarding/completion, aligned with Wasla_05 tiers.
// Weights sum to 100 when the optional sensitive field is included.
export const FIELD_SPECS = {
  age:        { label: 'العمر',           domain: 'Personal',  tier: 1, weight: 15, type: 'number', values: null },
  city:       { label: 'المدينة',         domain: 'Personal',  tier: 1, weight: 15, type: 'select', values: ['القاهرة', 'الجيزة', 'الإسكندرية', 'المنصورة', 'طنطا'] },
  profession: { label: 'المهنة',           domain: 'Career',    tier: 2, weight: 15, type: 'select', values: ['هندسة', 'تعليم', 'طب', 'تجارة', 'محاسبة', 'تقنية'] },
  education:  { label: 'التعليم',          domain: 'Education', tier: 2, weight: 10, type: 'select', values: ['ثانوية', 'دبلوم', 'بكالوريوس', 'ماجستير', 'دكتوراه'] },
  religiosity:{ label: 'الالتزام الديني',  domain: 'Religious', tier: 2, weight: 10, type: 'select', values: ['ملتزم', 'متوسط', 'مرن'] },
  lifestyle:  { label: 'نمط الحياة',       domain: 'Lifestyle', tier: 2, weight: 5,  type: 'select', values: ['هادئ', 'منتظم', 'اجتماعي'] },
  nationality:{ label: 'الجنسية',          domain: 'Personal',  tier: 1, weight: 10, type: 'select', values: ['مصري', 'سعودي', 'إماراتي', 'كويتي', 'قطري', 'بحريني', 'عُماني', 'أردني', 'لبناني', 'سوري', 'عراقي', 'مغربي', 'جزائري', 'تونسي', 'ليبي', 'سوداني', 'يمني', 'تركي', 'أخرى'] },
  height:     { label: 'الطول (سم)',       domain: 'Personal',  tier: 1, weight: 5,  type: 'number', values: null, min: 120, max: 220 },
  health:     { label: 'حالات صحية',       domain: 'Health',    tier: 3, weight: 5,  type: 'select', values: ['لا توجد', 'أوضح لاحقًا'], sensitive: true },
  photo_done: { label: 'الصورة الشخصية',   domain: 'Verification', tier: 1, weight: 10, type: 'flag' },
  selfie_done:{ label: 'التحقق بالسيلفي',  domain: 'Verification', tier: 1, weight: 15, type: 'flag' },
  bio:        { label: 'نبذة عني',        domain: 'Personal',  tier: 2, weight: 10, type: 'text', maxLength: 500 },
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
    if (key === 'age' && (n < 18 || n > 78)) return { ok: false, reason: 'age_range' };
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
