// Per Wasla_21: consistent error envelope { code, message, field, ref }
export function apiError(res, status, code, message, field) {
  const body = { code, message };
  if (field) body.field = field;
  body.ref = `err-${Date.now().toString(36)}`;
  return res.status(status).json(body);
}

// دعم الهاتف: محلي مصري (01xxxxxxxxx) أو دولي (+رمز الدولة…).
// التخزين موحّد بصيغة E.164: +CC…
export function normalizePhone(raw) {
  const p = String(raw || '').replace(/[\s-]/g, '').trim();
  if (!p) return null;

  // محلي مصري: 01xxxxxxxxx → +201XXXXXXXXX
  if (/^01[0-9]{9}$/.test(p)) return '+20' + p.slice(1);

  // مصري بصيغة دولية: +201XXXXXXXXX / 00201XXXXXXXXX / 201XXXXXXXXX
  if (/^\+20[0-9]{10}$/.test(p)) return '+20' + p.slice(3);
  if (/^0020[0-9]{10}$/.test(p)) return '+20' + p.slice(4);
  if (/^20[0-9]{10}$/.test(p)) return '+20' + p.slice(2);

  // دولي صريح: +CC… (8–15 رقمًا)
  if (p.startsWith('+')) {
    const d = p.slice(1);
    return /^[0-9]{8,15}$/.test(d) ? '+' + d : null;
  }

  // دولي بصيغة 00CC…
  if (p.startsWith('00')) {
    const d = p.slice(2);
    return /^[0-9]{8,15}$/.test(d) ? '+' + d : null;
  }

  // أرقام صريحة بلا بادئة صفر — تُعتبر دولية
  if (/^[0-9]{8,15}$/.test(p) && !p.startsWith('0')) return '+' + p;

  return null;
}
