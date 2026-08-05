let API_BASE = null;
function defaultApiBase() {
  const isNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
  if (isNative) return 'http://10.0.2.2:4000';
  return 'http://127.0.0.1:4000';
}
async function loadConfig() {
  try {
    const res = await fetch('/config.json');
    if (res.ok) {
      const cfg = await res.json();
      if (cfg.apiBase) {
        localStorage.setItem('wasla_api_base', cfg.apiBase);
        return cfg.apiBase;
      }
    }
  } catch (e) {
    // no config; fall through to localStorage / default
  }
  const local = localStorage.getItem('wasla_api_base');
  if (local) return local;
  const fallback = defaultApiBase();
  localStorage.setItem('wasla_api_base', fallback);
  return fallback;
}

const state = {
  token: localStorage.getItem('wasla_token') || null,
  user: JSON.parse(localStorage.getItem('wasla_user') || 'null'),
  phone: null,
  pendingGender: null,
  pendingName: null,
};

const el = (id) => document.getElementById(id);

const RETRY_DELAY_MS = [1000, 3000, 8000];

async function api(path, method = 'GET', body = null, _tries = 0) {
  const url = API_BASE + path;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (state.token) options.headers.Authorization = 'Bearer ' + state.token;
  if (body) options.body = JSON.stringify(body);
  try {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { status: res.status, data };
    return data;
  } catch (err) {
    if ((err.status === 401 || err.status === 403) && state.token) {
      logout();
      throw err;
    }
    if (!err.status && _tries < RETRY_DELAY_MS.length) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS[_tries]));
      return api(path, method, body, _tries + 1);
    }
    throw err;
  }
}

async function apiUpload(path, formData, _tries = 0) {
  const url = API_BASE + path;
  const options = {
    method: 'POST',
    headers: {},
  };
  if (state.token) options.headers.Authorization = 'Bearer ' + state.token;
  options.body = formData;
  try {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { status: res.status, data };
    return data;
  } catch (err) {
    if ((err.status === 401 || err.status === 403) && state.token) {
      logout();
      throw err;
    }
    if (!err.status && _tries < RETRY_DELAY_MS.length) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS[_tries]));
      return apiUpload(path, formData, _tries + 1);
    }
    throw err;
  }
}

function isStaff(role) {
  return role && role !== 'user';
}

function setToken(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('wasla_token', token);
  localStorage.setItem('wasla_user', JSON.stringify(user));
  document.getElementById('nav').classList.remove('hidden');
  const adminBtn = document.getElementById('nav-admin');
  if (adminBtn) adminBtn.classList.toggle('hidden', !isStaff(user?.role));
  updateBadge();
  registerPushToken();
  connectRealtime();
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('wasla_token');
  localStorage.removeItem('wasla_user');
  document.getElementById('nav').classList.add('hidden');
  const adminBtn = document.getElementById('nav-admin');
  if (adminBtn) adminBtn.classList.add('hidden');
  disconnectRealtime();
  renderLogin();
}

// سجل رمز الجهاز للإشعارات الفورية (best-effort — يعمل بصمت عند غياب الدعم)
async function registerPushToken() {
  if (!state.token) return;
  try {
    const isNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
    if (isNative) {
      const push = window.Capacitor.Plugins.PushNotifications;
      if (!push) return;
      const status = await push.requestPermissions();
      if (status && status.receive === 'granted') {
        if (push.createChannel) {
          push.createChannel({ id: 'wasla', name: 'وصلــه', importance: 5, visibility: 1, vibration: true, sound: 'default' }).catch(() => {});
        }
        push.addListener('registration', (data) => {
          api('/api/push/token', 'POST', { token: data.value }).catch(() => {});
        });
        push.addListener('pushNotificationActionPerformed', () => {
          setPage('messages');
        });
        push.register();
      }
      return;
    }
    if ('serviceWorker' in navigator && 'PushManager' in window && navigator.serviceWorker) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await api('/api/push/token', 'POST', { token: sub.endpoint });
    }
  } catch (e) {
    // تجاهل — لا إشعارات فورية إن لم يدعم المتصفح
  }
}

// اتصال لحظي للرسائل عبر WebSocket (Wasla_27)
let ws = null;
function connectRealtime() {
  if (!state.token) return;
  try {
    const scheme = API_BASE.replace(/^http/, 'ws');
    ws = new WebSocket(scheme + '/ws?token=' + encodeURIComponent(state.token));
    ws.onmessage = (evt) => {
      let msg = {};
      try { msg = JSON.parse(evt.data); } catch (e) {}
      if (msg.event === 'MessageReceived') {
        updateBadge();
        const hist = el('chatHistory');
        if (state.chatUserId === msg.message?.senderId && hist) {
          hist.insertAdjacentHTML('beforeend', `<div class="message-bubble them">${escapeHtml(msg.message.text)}</div>`);
          hist.scrollTop = hist.scrollHeight;
        }
      } else if (msg.event === 'MatchMutual' || msg.event === 'LikeReceived') {
        updateBadge();
      }
    };
    ws.onclose = () => { if (state.token) setTimeout(connectRealtime, 5000); };
  } catch (e) {}
}
function disconnectRealtime() {
  if (ws) { ws.onclose = null; ws.close(); ws = null; }
}

function setPage(page) {
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
  if (page === 'profile') renderProfile();
  if (page === 'discovery') renderDiscovery();
  if (page === 'mutuals') renderMutuals();
  if (page === 'messages') renderMessages();
  if (page === 'notifications') renderNotifications();
  if (page === 'settings') renderSettings();
  if (page === 'admin') renderAdmin();
}

async function updateBadge() {
  if (!state.token) return;
  try {
    const data = await api('/api/notifications');
    const unread = Number(data.unread) || 0;
    const badge = el('notif-badge');
    if (badge) {
      badge.textContent = unread > 99 ? '99+' : unread;
      badge.classList.toggle('hidden', unread === 0);
    }
  } catch (e) {}
}

function showError(container, err) {
  let msg = err?.data?.message || err?.message || 'حدث خطأ';
  if (!err?.status) msg = 'تعذر الاتصال بالخادم — حاول مرة أخرى بعد لحظات';
  container.innerHTML = `<div class="error">${msg}</div>`;
}

function brandHeader() {
  return `<div class="brand-logo">وصلــه</div>`;
}

function renderLogin() {
  const app = el('app');
  app.innerHTML = `
    <div class="card">
      ${brandHeader()}
      <h1>تسجيل الدخول</h1>
      <p>أدخل رقم هاتفك لإرسال رمز التحقق إلى بريدك الإلكتروني</p>
      <label>رقم الهاتف</label>
      <input id="phone" type="tel" placeholder="01xxxxxxxx" />
      <button id="loginBtn">إرسال رمز التحقق</button>
      <div id="error"></div>
      <p style="text-align:center;margin-top:16px"><a href="#" id="toRegister">ليس لديك حساب؟ سجّل</a></p>
    </div>
  `;
  el('toRegister').addEventListener('click', (e) => { e.preventDefault(); renderRegister(); });
  el('loginBtn').addEventListener('click', async () => {
    const phone = el('phone').value.trim();
    if (!phone) { showError(el('error'), { message: 'أدخل رقم الهاتف' }); return; }
    try {
      const data = await api('/api/auth/login', 'POST', { phone });
      state.phone = phone;
      renderVerify(data.dev?.otp);
    } catch (err) { showError(el('error'), err); }
  });
}

const REG_COUNTRY = ['مصر', 'السعودية', 'الإمارات', 'الكويت', 'قطر', 'البحرين', 'عُمان', 'الأردن', 'لبنان', 'سوريا', 'العراق', 'اليمن', 'ليبيا', 'تونس', 'الجزائر', 'المغرب', 'السودان', 'تركيا', 'أخرى'];
const REG_GOVERNORATE = ['القاهرة', 'الجيزة', 'الإسكندرية', 'الدقهلية', 'البحر الأحمر', 'البحيرة', 'الفيوم', 'الغربية', 'الإسماعيلية', 'المنوفية', 'المنيا', 'القليوبية', 'الوادي الجديد', 'السويس', 'أسوان', 'أسيوط', 'بني سويف', 'بورسعيد', 'دمياط', 'الشرقية', 'جنوب سيناء', 'كفر الشيخ', 'مطروح', 'الأقصر', 'قنا', 'شمال سيناء', 'سوهاج', 'أخرى'];
const REG_NATIONALITY = ['مصري', 'سعودي', 'إماراتي', 'كويتي', 'قطري', 'بحريني', 'عُماني', 'أردني', 'لبناني', 'سوري', 'عراقي', 'يمني', 'ليبي', 'تونسي', 'جزائري', 'مغربي', 'سوداني', 'تركي', 'أخرى'];
const REG_PROFESSION = ['طب', 'هندسة', 'تعليم', 'تقنية معلومات', 'أعمال', 'تجارة', 'حرفي', 'قطاع حكومي', 'ربة منزل', 'طالب', 'لا أعمل', 'أخرى'];
const REG_EDUCATION = ['أقل من ثانوي', 'ثانوية', 'دبلوم', 'بكالوريوس', 'ماجستير', 'دكتوراه', 'أخرى'];

function renderRegister() {
  const app = el('app');
  const reg = { gender: 'male', seeking: 'شريكة', profileFor: 'نفسي' };
  let step = 1;
  const options = (list, current) => list.map((o) => `<option value="${o}" ${o === current ? 'selected' : ''}>${o}</option>`).join('');
  function draw() {
    let body = '';
    if (step === 1) {
      body = `
        <p style="text-align:center;color:var(--muted);font-size:14px">الخطوة ١ من ٣ — من نحن؟</p>
        <label>الاسم الأول</label>
        <input id="firstName" type="text" placeholder="الاسم الحقيقي (لن يظهر)" />
        <label>اسم العائلة</label>
        <input id="familyName" type="text" placeholder="اسم العائلة الحقيقي (لن يظهر)" />
        <label>اسم الظهور</label>
        <input id="name" type="text" placeholder="الاسم الذي يظهر للآخرين" />
        <label>سنة الميلاد</label>
        <input id="birthYear" type="number" placeholder="مثال: 1995" min="1948" max="2008" />
        <label>الجنس</label>
        <select id="gender"><option value="male" selected>ذكر</option><option value="female">أنثى</option></select>
        <label>أنا أبحث عن</label>
        <select id="seeking"><option value="شريكة" selected>شريكة</option><option value="شريك">شريك</option></select>
        <label>الحساب لصالح</label>
        <select id="profileFor">${options(['نفسي', 'أحد من عائلتي', 'أحد من أصدقائي'], 'نفسي')}</select>
      `;
    } else if (step === 2) {
      body = `
        <p style="text-align:center;color:var(--muted);font-size:14px">الخطوة ٢ من ٣ — من أين أنت؟</p>
        <label>الدولة</label>
        <select id="country">${options(REG_COUNTRY, 'مصر')}</select>
        <label>الجنسية</label>
        <select id="nationality">${options(REG_NATIONALITY, 'مصري')}</select>
        <label>المحافظة</label>
        <select id="governorate">${options(REG_GOVERNORATE, 'القاهرة')}</select>
        <label>المدينة</label>
        <input id="city" type="text" placeholder="مثال: المنصورة" />
      `;
    } else {
      body = `
        <p style="text-align:center;color:var(--muted);font-size:14px">الخطوة ٣ من ٣ — عملك وتعليمك</p>
        <label>المهنة</label>
        <select id="profession"><option value="">اختر المهنة...</option>${options(REG_PROFESSION, '')}</select>
        <div id="professionOtherWrap" style="display:none">
          <label>حدد مهنتك</label>
          <input id="profession_other" type="text" placeholder="مثال: طبيب أسنان" />
        </div>
        <label>المؤهل الدراسي</label>
        <select id="education">${options(REG_EDUCATION, '')}</select>
        <label>رقم الهاتف</label>
        <input id="phone" type="tel" placeholder="01xxxxxxxx" />
        <label>البريد الإلكتروني</label>
        <input id="email" type="email" placeholder="example@domain.com" />
      `;
    }
    app.innerHTML = `
      <div class="card">
        ${brandHeader()}
        <h1>إنشاء حساب</h1>
        <div style="display:flex;gap:4px;margin-bottom:16px">
          ${[1, 2, 3].map((s) => `<div style="flex:1;height:4px;border-radius:2px;background:${s <= step ? 'var(--accent)' : 'var(--border)'}"></div>`).join('')}
        </div>
        ${body}
        <div style="display:flex;gap:8px">
          ${step > 1 ? `<button class="secondary" id="backBtn" style="margin-top:12px">السابق</button>` : ''}
          ${step < 3 ? `<button id="nextBtn" style="margin-top:12px">التالي</button>` : `<button id="registerBtn" style="margin-top:12px">إنشاء حسابي</button>`}
        </div>
        <div id="error"></div>
        <p style="text-align:center;margin-top:16px"><a href="#" id="toLogin">لديك حساب؟ ادخل</a></p>
      </div>
    `;
    el('toLogin').addEventListener('click', (e) => { e.preventDefault(); renderLogin(); });
    if (step === 1) {
      el('seeking').addEventListener('change', (e) => { reg.seeking = e.target.value; });
      el('profileFor').addEventListener('change', (e) => { reg.profileFor = e.target.value; });
    }
    if (step === 3) {
      el('profession').addEventListener('change', (e) => { el('professionOtherWrap').style.display = e.target.value === 'أخرى' ? 'block' : 'none'; });
    }
    const nextBtn = el('nextBtn');
    if (nextBtn) nextBtn.addEventListener('click', () => {
      if (step === 1) {
        if (!el('name').value.trim()) { showError(el('error'), { message: 'أدخل اسم الظهور أولًا' }); return; }
        const by = el('birthYear').value.trim();
        if (!by) { showError(el('error'), { message: 'أدخل سنة الميلاد' }); return; }
        const byN = Number(by);
        if (byN < 1948 || byN > 2008) { showError(el('error'), { message: 'سنة الميلاد يجب أن تكون بين ١٩٤٨ و ٢٠٠٨' }); return; }
        reg.name = el('name').value.trim();
        reg.gender = el('gender').value;
        reg.firstName = el('firstName').value.trim();
        reg.familyName = el('familyName').value.trim();
        reg.birthYear = by;
      } else if (step === 2) {
        if (!el('city').value.trim()) { showError(el('error'), { message: 'اكتب اسم المدينة' }); return; }
        reg.country = el('country').value;
        reg.nationality = el('nationality').value;
        reg.governorate = el('governorate').value;
        reg.city = el('city').value.trim();
      }
      step++;
      draw();
    });
    const backBtn = el('backBtn');
    if (backBtn) backBtn.addEventListener('click', () => { step--; draw(); });
    const registerBtn = el('registerBtn');
    if (registerBtn) registerBtn.addEventListener('click', async () => {
      const profession = el('profession').value;
      const phone = el('phone').value.trim();
      const email = el('email').value.trim();
      const education = el('education').value;
      const missing = [];
      if (!reg.firstName) missing.push('الاسم الأول');
      if (!reg.familyName) missing.push('اسم العائلة');
      if (!reg.name) missing.push('اسم الظهور');
      if (!reg.birthYear) missing.push('سنة الميلاد');
      if (!reg.city) missing.push('المدينة');
      if (!profession) missing.push('المهنة');
      if (!education) missing.push('المؤهل الدراسي');
      if (!phone) missing.push('رقم الهاتف');
      if (!email) missing.push('البريد الإلكتروني');
      if (missing.length) {
        showError(el('error'), { message: 'يرجى إكمال جميع الحقول: ' + missing.join('، ') });
        return;
      }
      const fields = {
        first_name: reg.firstName,
        family_name: reg.familyName,
        birth_year: reg.birthYear,
        seeking: reg.seeking,
        profile_for: reg.profileFor,
        country: reg.country,
        nationality: reg.nationality,
        governorate: reg.governorate,
        city: reg.city,
        profession,
        profession_other: profession === 'أخرى' ? el('profession_other').value.trim() : '',
        education,
      };
      const payload = {
        name: reg.name,
        gender: reg.gender,
        phone,
        email,
        fields,
      };
      try {
        const data = await api('/api/auth/register', 'POST', payload);
        state.phone = payload.phone;
        renderVerify(data.dev?.otp);
      } catch (err) { showError(el('error'), err); }
    });
  }
  draw();
}

function renderVerify(hint) {
  const app = el('app');
  app.innerHTML = `
    <div class="card">
      ${brandHeader()}
      <h1>رمز التحقق</h1>
      <p>أدخل الرمز المرسل إلى بريدك الإلكتروني (تحقق من صندوق الوارد والبريد المزعج)</p>
      ${hint ? `<p class="badge">رمز التجربة: ${hint}</p>` : ''}
      <input id="code" type="text" placeholder="الرمز" />
      <button id="verifyBtn">تحقق</button>
      <div id="error"></div>
    </div>
  `;
  el('verifyBtn').addEventListener('click', async () => {
    const code = el('code').value.trim();
    if (!code) { showError(el('error'), { message: 'أدخل رمز التحقق' }); return; }
    try {
      const data = await api('/api/auth/otp/verify', 'POST', { phone: state.phone, code });
      setToken(data.token, data.user);
      renderProfile();
    } catch (err) { showError(el('error'), err); }
  });
}

async function renderProfile() {
  const app = el('app');
  app.innerHTML = `<div class="card"><p>جاري التحميل...</p></div>`;
  try {
    const me = await api('/api/profile/me');
    const completion = me.completion || {};
    const fields = me.fields || {};
    const photos = me.photos || {};
    let ver;
    try { ver = await api('/api/verification/me'); } catch (e) {}
    const verCard = ver ? verificationCard(ver) : '';
    app.innerHTML = `
      <div class="card">
        <h2>${me.user.name} ${me.user.verified ? '✔️' : ''}</h2>
        <p class="badge">مستوى الثقة: ${me.user.trustLevel || 1}</p>
        <p>اكتمال الملف: ${completion.pct || 0}%</p>
        <div style="height:8px;background:#E3E3EC;border-radius:4px"><div style="height:100%;width:${completion.pct || 0}%;background:#6B4EE6;border-radius:4px"></div></div>
      </div>
      ${verCard}
      <div class="card">
        <h3>الصور</h3>
        ${photoUploader('photo', 'الصورة الشخصية', photos.profile)}
        ${photoUploader('selfie', 'سيلفي التحقق', photos.selfie)}
      </div>
      <div class="card">
        <h3>تعديل البيانات</h3>
        ${fieldEditor('birth_year', 'سنة الميلاد', 'number', fields.birth_year)}
        ${fieldEditor('country', 'الدولة', 'select', fields.country, REG_COUNTRY)}
        ${fieldEditor('governorate', 'المحافظة', 'select', fields.governorate, REG_GOVERNORATE)}
        ${fieldEditor('city', 'المدينة', 'text', fields.city)}
        ${fieldEditor('nationality', 'الجنسية', 'select', fields.nationality, REG_NATIONALITY)}
        ${fieldEditor('profession', 'المهنة', 'select', fields.profession, REG_PROFESSION)}
        ${fieldEditor('profession_other', 'المهنة (حدد)', 'text', fields.profession_other)}
        ${fieldEditor('education', 'المؤهل الدراسي', 'select', fields.education, REG_EDUCATION)}
        ${fieldEditor('religiosity', 'الالتزام الديني', 'select', fields.religiosity, ['ملتزم','متوسط','مرن'])}
        ${fieldEditor('lifestyle', 'نمط الحياة', 'select', fields.lifestyle, ['هادئ','منتظم','اجتماعي'])}
        ${fieldEditor('height', 'الطول (سم)', 'number', fields.height)}
        ${fieldEditor('bio', 'نبذة عني', 'textarea', fields.bio)}
        <button id="saveProfile">حفظ</button>
        <div id="error"></div>
      </div>
    `;
    bindPhotoUploader('photo', '/api/profile/photo');
    bindPhotoUploader('selfie', '/api/profile/selfie');
    const verBtn = el('requestVerification');
    if (verBtn) {
      verBtn.addEventListener('click', async () => {
        try {
          await api('/api/verification/request', 'POST', { type: 'id' });
          renderProfile();
        } catch (err) { showError(el('error'), err); }
      });
    }
    el('saveProfile').addEventListener('click', async () => {
      const keys = ['birth_year','country','governorate','city','nationality','profession','profession_other','education','religiosity','lifestyle','height','bio'];
      const updates = [];
      for (const key of keys) {
        const input = el('field-' + key);
        if (input) updates.push({ field_key: key, value: String(input.value || '') });
      }
      try {
        await api('/api/profile/me', 'PATCH', { fields: updates });
        renderProfile();
      } catch (err) { showError(el('error'), err); }
    });
  } catch (err) { showError(app, err); }
}

function verificationCard(ver) {
  if (ver.verified) {
    return `<div class="card"><h3>التوثيق</h3><p class="badge">موثق — الحساب موثوق من إدارة وصلــه</p></div>`;
  }
  const status = ver.request?.status;
  const pending = status === 'pending' ? '<p class="badge">طلبك قيد المراجعة</p>' : '';
  const rejected = status === 'rejected' ? '<p class="badge">عُدّل طلبك سابقًا — يمكنك إعادة المحاولة</p>' : '';
  return `
    <div class="card">
      <h3>التوثيق</h3>
      <p style="font-size:14px;color:var(--muted)">وثّق حسابك بطلب مراجعة من إدارة وصلــه لتحصل على شارة التوثيق وثقة أعلى.</p>
      ${pending}
      ${rejected}
      ${status !== 'pending' ? `<button id="requestVerification">طلب التوثيق</button>` : ''}
      <div id="error"></div>
    </div>
  `;
}

function photoUploader(kind, label, photo) {
  const preview = photo ? `<img src="${photo.url}" style="width:120px;height:120px;object-fit:cover;border-radius:12px;margin:8px 0" alt="${label}" />` : '';
  return `
    <div style="margin-bottom:16px">
      <label>${label}</label>
      <div id="${kind}-preview">${preview}</div>
      <input type="file" id="${kind}-input" accept="image/png,image/jpeg" style="margin-top:8px" />
      <button id="${kind}-upload" style="margin-top:8px">رفع ${label}</button>
      <div id="${kind}-error"></div>
    </div>
  `;
}

function bindPhotoUploader(kind, path) {
  const input = el(kind + '-input');
  const btn = el(kind + '-upload');
  if (!input || !btn) return;
  btn.addEventListener('click', async () => {
    const file = input.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('photo', file);
    try {
      await apiUpload(path, formData);
      renderProfile();
    } catch (err) { showError(el(kind + '-error'), err); }
  });
}

function fieldEditor(key, label, type, value, options = []) {
  let input = '';
  if (type === 'select') {
    input = `<select id="field-${key}">${options.map((o) => `<option value="${o}" ${o === value ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
  } else if (type === 'textarea') {
    input = `<textarea id="field-${key}" rows="3" placeholder="${label}">${value || ''}</textarea>`;
  } else {
    input = `<input id="field-${key}" type="${type}" value="${value || ''}" placeholder="${label}" />`;
  }
  return `<label>${label}</label>${input}`;
}

async function renderDiscovery() {
  const app = el('app');
  app.innerHTML = `<div class="card"><p>جاري البحث...</p></div>`;
  try {
    const data = await api('/api/discovery/recommendations');
    const candidates = data.recommendations || [];
    if (candidates.length === 0) {
      app.innerHTML = `<div class="card empty"><p>لا توجد مقترحات الآن. أكمل ملفك أو عد لاحقًا.</p></div>`;
      return;
    }
    const c = candidates[0];
    app.innerHTML = `
      <div class="card candidate">
        <h2>${c.name || 'عضو'}</h2>
        <p class="badge badge-${c.matchLevel}">توافق ${c.matchScore}%</p>
        <p>${c.reasons?.join(' · ') || ''}</p>
        <div class="actions">
          <button class="secondary" id="passBtn">تخطي</button>
          <button id="likeBtn">إعجاب</button>
        </div>
      </div>
    `;
    el('passBtn').addEventListener('click', async () => { await api(`/api/matches/${c.userId}/like`, 'POST', { like: false }); renderDiscovery(); });
    el('likeBtn').addEventListener('click', async () => { await api(`/api/matches/${c.userId}/like`, 'POST', { like: true }); renderDiscovery(); });
  } catch (err) { showError(app, err); }
}

async function renderMutuals() {
  const app = el('app');
  app.innerHTML = `<div class="card"><p>جاري التحميل...</p></div>`;
  try {
    const data = await api('/api/matches/mutual');
    const mutuals = data.matches || [];
    if (mutuals.length === 0) {
      app.innerHTML = `<div class="card empty"><p>لا توجد مطابقات متبادلة بعد.</p></div>`;
      return;
    }
    app.innerHTML = mutuals.map((m) => `
      <div class="card match-row">
        <div>
          <strong>${m.name}</strong>
          <p class="badge badge-${m.level}">${m.score}%</p>
        </div>
        <button class="secondary" onclick="setPage('messages');state.chatUserId=${m.userId}">راسل</button>
      </div>
    `).join('');
  } catch (err) { showError(app, err); }
}

async function renderMessages() {
  const app = el('app');
  if (state.chatUserId) return renderChat(state.chatUserId);
  app.innerHTML = `<div class="card"><p>جاري التحميل...</p></div>`;
  try {
    const data = await api('/api/conversations');
    const convs = data.conversations || [];
    if (convs.length === 0) {
      app.innerHTML = `<div class="card empty"><p>لا توجد محادثات.</p></div>`;
      return;
    }
    app.innerHTML = convs.map((c) => `
      <div class="card match-row" style="cursor:pointer" data-user="${c.other.id}">
        <div>
          <strong>${c.other.name}</strong>
          <p style="font-size:14px;color:var(--muted);margin:4px 0">${c.lastMessage || 'لا رسائل'}</p>
        </div>
        ${c.unread ? `<span class="badge">${c.unread}</span>` : ''}
      </div>
    `).join('');
    app.querySelectorAll('.match-row').forEach((row) => {
      row.addEventListener('click', () => { state.chatUserId = Number(row.dataset.user); renderChat(state.chatUserId); });
    });
  } catch (err) { showError(app, err); }
}

async function renderChat(userId) {
  const app = el('app');
  app.innerHTML = `<div class="card"><p>جاري التحميل...</p></div>`;
  try {
    const data = await api(`/api/conversations/${userId}/messages`);
    const messages = data.messages || [];
    app.innerHTML = `
      <div class="card">
        <button class="secondary" id="backChat" style="width:auto">← المحادثات</button>
        <h2>${data.other?.name || 'محادثة'}</h2>
        <div id="chatHistory" style="max-height:60vh;overflow:auto;margin:16px 0">
          ${messages.map((m) => `
            <div class="message-bubble ${m.sender_id === state.user.id ? 'me' : 'them'}">${escapeHtml(m.text)}</div>
          `).join('')}
        </div>
        <div class="message-form">
          <input id="msgText" type="text" placeholder="اكتب رسالة..." />
          <button id="sendBtn">إرسال</button>
        </div>
        <div id="error"></div>
      </div>
    `;
    el('backChat').addEventListener('click', () => { state.chatUserId = null; renderMessages(); });
    el('sendBtn').addEventListener('click', async () => {
      const text = el('msgText').value.trim();
      if (!text) return;
      try {
        await api(`/api/conversations/${userId}/messages`, 'POST', { text });
        renderChat(userId);
      } catch (err) { showError(el('error'), err); }
    });
  } catch (err) { showError(app, err); }
}

async function renderNotifications() {
  const app = el('app');
  app.innerHTML = `<div class="card"><p>جاري التحميل...</p></div>`;
  try {
    const data = await api('/api/notifications');
    const notifs = data.notifications || [];
    if (notifs.length === 0) {
      app.innerHTML = `<div class="card empty"><p>لا توجد إشعارات.</p></div>`;
      updateBadge();
      return;
    }
    app.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h2>الإشعارات</h2>
          <button class="secondary" id="markAllRead" style="width:auto">تعليم الكل مقروء</button>
        </div>
        ${notifs.map((n) => `
          <div class="match-row" data-id="${n.id}">
            <div>
              <strong>${escapeHtml(n.type)}</strong>
              <p style="font-size:14px;color:var(--muted);margin:4px 0">${escapeHtml(n.text)}</p>
              <small>${n.created_at}</small>
            </div>
            ${!n.is_read ? `<button class="secondary" data-action="read" data-id="${n.id}">تعليم مقروء</button>` : ''}
          </div>
        `).join('')}
        <div id="error"></div>
      </div>
    `;
    el('markAllRead').addEventListener('click', async () => {
      try {
        await api('/api/notifications/read', 'POST', {});
        renderNotifications();
      } catch (err) { showError(el('error'), err); }
    });
    app.querySelectorAll('button[data-action="read"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await api('/api/notifications/read', 'POST', { id: Number(btn.dataset.id) });
          renderNotifications();
        } catch (err) { showError(el('error'), err); }
      });
    });
    updateBadge();
  } catch (err) { showError(app, err); }
}

async function renderSettings() {
  const app = el('app');
  app.innerHTML = `<div class="card"><p>جاري التحميل...</p></div>`;
  try {
    const data = await api('/api/settings');
    let sub;
    try { sub = await api('/api/me/subscription'); } catch (e) {}
    const subCard = sub ? subscriptionCard(sub) : '';
    app.innerHTML = `
      <div class="card">
        <h2>إعدادات</h2>
        <label>عرض الصور</label>
        <select id="photoVisibility">
          <option value="0" ${data.photoVisibility === 0 ? 'selected' : ''}>مطابقون محتملون</option>
          <option value="1" ${data.photoVisibility === 1 ? 'selected' : ''}>الموثقون</option>
          <option value="2" ${data.photoVisibility === 2 ? 'selected' : ''}>كل المسجلين</option>
        </select>
        <label>
          <input type="checkbox" id="paused" ${data.paused ? 'checked' : ''} /> إيقاف مؤقت (لا أظهر في الاكتشاف)
        </label>
        <button id="saveSettings">حفظ</button>
        <button class="danger" id="logoutBtn">تسجيل خروج</button>
        <div id="error"></div>
      </div>
      ${subCard}
    `;
    el('saveSettings').addEventListener('click', async () => {
      const photoVisibility = Number(el('photoVisibility').value);
      const paused = el('paused').checked ? 1 : 0;
      try {
        await api('/api/settings', 'PATCH', { photoVisibility, paused });
        renderSettings();
      } catch (err) { showError(el('error'), err); }
    });
    el('logoutBtn').addEventListener('click', logout);
    renderPlans(el('plansList'));
  } catch (err) { showError(app, err); }
}

function subscriptionCard(sub) {
  const plan = sub.isPremium
    ? `<p class="badge">مشترك — ${escapeHtml(sub.plan?.name || '')} حتى ${sub.plan?.endsAt || ''}</p>`
    : `<p>أنت على الباقة المجانية — حدود يومية: ${sub.quotas?.likes?.used || 0}/${sub.quotas?.likes?.limit || 5} إعجاب، ${sub.quotas?.messages?.used || 0}/${sub.quotas?.messages?.limit || 5} رسالة.</p>`;
  return `
    <div class="card">
      <h3>الاشتراك</h3>
      ${plan}
      <div id="plansList">...</div>
      <div id="subError"></div>
    </div>
  `;
}

async function renderPlans(container) {
  if (!container) return;
  try {
    const data = await api('/api/plans');
    container.innerHTML = (data.plans || []).map((p) => `
      <div class="match-row">
        <div>
          <strong>${escapeHtml(p.name)}</strong> — ${p.priceEgp} ج.م / ${p.durationMonths} شهر
        </div>
        <button class="secondary" data-buy="${p.code}" style="width:auto">اشترك</button>
      </div>
    `).join('');
    container.querySelectorAll('button[data-buy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const r = await api('/api/me/subscription', 'POST', { planCode: btn.dataset.buy });
          if (r.checkoutUrl) {
            window.open(r.checkoutUrl, '_blank');
          }
          renderSettings();
        } catch (err) { showError(el('subError'), err); }
      });
    });
  } catch (e) { container.innerHTML = '<p style="color:var(--muted)">تعذر تحميل الخطط.</p>'; }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function adminCard(title, content) {
  return `<div class="card"><h3>${title}</h3>${content}</div>`;
}

let adminSection = 'dashboard';

async function renderAdmin() {
  if (!isStaff(state.user?.role)) return renderProfile();
  const app = el('app');
  app.innerHTML = `
    <div class="card">
      <h2>لوحة الإدارة</h2>
      <p>الدور: ${state.user.role}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="secondary" data-admin="dashboard">نظرة عامة</button>
        <button class="secondary" data-admin="verification">التوثيق</button>
        <button class="secondary" data-admin="reports">البلاغات</button>
        <button class="secondary" data-admin="moderation">الإشراف</button>
        <button class="secondary" data-admin="subscriptions">الاشتراكات</button>
        <button class="secondary" data-admin="users">المستخدمين</button>
        <button class="secondary" data-admin="audit">سجل المراجعة</button>
      </div>
    </div>
    <div id="admin-content"></div>
  `;
  app.querySelectorAll('button[data-admin]').forEach((btn) => {
    btn.addEventListener('click', () => { adminSection = btn.dataset.admin; renderAdminSection(); });
  });
  renderAdminSection();
}

async function renderAdminSection() {
  const container = el('admin-content');
  if (!container) return;
  container.innerHTML = '<div class="card"><p>جاري التحميل...</p></div>';
  try {
    if (adminSection === 'dashboard') await renderAdminDashboard(container);
    else if (adminSection === 'verification') await renderAdminVerification(container);
    else if (adminSection === 'reports') await renderAdminReports(container);
    else if (adminSection === 'moderation') await renderAdminModeration(container);
    else if (adminSection === 'subscriptions') await renderAdminSubscriptions(container);
    else if (adminSection === 'users') await renderAdminUsers(container);
    else if (adminSection === 'audit') await renderAdminAudit(container);
  } catch (err) { showError(container, err); }
}

async function renderAdminDashboard(container) {
  const data = await api('/admin/dashboard');
  container.innerHTML = adminCard('نظرة عامة', `
    <p>الأعضاء النشطون: <strong>${data.users}</strong></p>
    <p>البلاغات المعلقة: <strong>${data.pendingReports}</strong></p>
    <p>الإيرادات (ج.م): <strong>${data.revenueEgp}</strong></p>
    <p>الاشتراكات النشطة: <strong>${data.activeSubscriptions}</strong></p>
  `);
}

async function renderAdminVerification(container) {
  const data = await api('/api/admin/verification?status=all');
  const rows = data.requests || [];
  if (rows.length === 0) { container.innerHTML = adminCard('التوثيق', '<p>لا توجد طلبات توثيق.</p>'); return; }
  container.innerHTML = adminCard('طلبات التوثيق', `
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button class="secondary" data-vf-status="pending" style="width:auto">قيد المراجعة</button>
      <button class="secondary" data-vf-status="all" style="width:auto">الكل</button>
    </div>
    ${rows.map((v) => `
      <div class="match-row">
        <div>
          <strong>${escapeHtml(v.user_name)}</strong> — ${v.user_phone}<br>
          <small>#${v.id} · ${v.type} · ${v.status} · ${v.created_at}${v.note ? ' · ' + escapeHtml(v.note) : ''}</small>
        </div>
        <div>
          ${v.status === 'pending' ? `
            <button class="secondary" data-action="vf-approve" data-id="${v.id}">موافقة</button>
            <button class="danger" data-action="vf-reject" data-id="${v.id}">رفض</button>
          ` : ''}
        </div>
      </div>
    `).join('')}
  `);
  container.querySelectorAll('button[data-vf-status]').forEach((btn) => {
    btn.addEventListener('click', () => renderAdminVerificationWithStatus(container, btn.dataset.vfStatus));
  });
  container.querySelectorAll('button[data-action^="vf-"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const approve = btn.dataset.action === 'vf-approve';
      const reason = window.prompt('سبب القرار (اختياري):', '');
      try {
        await api(`/api/admin/verification/${btn.dataset.id}/decision`, 'POST', { approve, reason: reason || null });
        renderAdminSection();
      } catch (err) { showError(container, err); }
    });
  });
}

async function renderAdminVerificationWithStatus(container, status) {
  try {
    const data = await api('/api/admin/verification?status=' + status);
    const rows = data.requests || [];
    container.innerHTML = adminCard('طلبات التوثيق', rows.length === 0 ? '<p>لا توجد طلبات.</p>' : rows.map((v) => `
      <div class="match-row">
        <div>
          <strong>${escapeHtml(v.user_name)}</strong> — ${v.user_phone}<br>
          <small>#${v.id} · ${v.type} · ${v.status} · ${v.created_at}</small>
        </div>
        <div>
          ${v.status === 'pending' ? `
            <button class="secondary" data-action="vf-approve" data-id="${v.id}">موافقة</button>
            <button class="danger" data-action="vf-reject" data-id="${v.id}">رفض</button>
          ` : ''}
        </div>
      </div>
    `).join(''));
    container.querySelectorAll('button[data-action^="vf-"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const approve = btn.dataset.action === 'vf-approve';
        try {
          await api(`/api/admin/verification/${btn.dataset.id}/decision`, 'POST', { approve });
          renderAdminVerificationWithStatus(container, status);
        } catch (err) { showError(container, err); }
      });
    });
  } catch (err) { showError(container, err); }
}

async function renderAdminSubscriptions(container) {
  const [payments, subs] = await Promise.all([
    api('/admin/payments'),
    api('/admin/subscriptions'),
  ]);
  container.innerHTML = `
    ${adminCard('الاشتراكات', (subs.subscriptions || []).slice(0, 30).map((s) => `
      <div class="match-row">
        <div>
          <strong>${escapeHtml(s.name || 'عضو')}</strong> — ${s.plan_code}<br>
          <small>${s.status} · ${s.starts_at} → ${s.ends_at}${s.auto_renew ? ' · تجديد تلقائي' : ''}</small>
        </div>
      </div>
    `).join('') || '<p>لا توجد اشتراكات.</p>')}
    ${adminCard('المدفوعات', (payments.payments || []).slice(0, 30).map((p) => `
      <div class="match-row">
        <div>
          <strong>${escapeHtml(p.name || 'عضو')}</strong> — ${p.amount_egp} ج.م<br>
          <small>${p.provider || 'mock'} · ${p.status} · ${p.created_at}${p.provider_ref ? ' · ' + escapeHtml(p.provider_ref) : ''}</small>
        </div>
      </div>
    `).join('') || '<p>لا توجد مدفوعات.</p>')}
  `;
}

async function renderAdminReports(container) {
  const data = await api('/admin/reports');
  const rows = data.reports || [];
  if (rows.length === 0) { container.innerHTML = adminCard('البلاغات', '<p>لا توجد بلاغات.</p>'); return; }
  container.innerHTML = adminCard('البلاغات', rows.map((r) => `
    <div class="match-row">
      <div>
        <strong>#${r.id}</strong> — ${escapeHtml(r.reason || 'بدون سبب')}<br>
        <small>بواسطة ${r.reporter_name} ضد ${r.reported_name} — ${r.status}</small>
      </div>
      ${r.status === 'pending' ? `<button class="secondary" data-action="resolve-report" data-id="${r.id}">حلّ</button>` : ''}
    </div>
  `).join(''));
  container.querySelectorAll('button[data-action="resolve-report"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await api(`/admin/reports/${btn.dataset.id}/resolve`, 'POST', { status: 'resolved', reason: 'تم الحل من لوحة الإدارة' });
        renderAdminSection();
      } catch (err) { showError(container, err); }
    });
  });
}

async function renderAdminModeration(container) {
  const data = await api('/admin/moderation?status=pending');
  const rows = data.items || [];
  if (rows.length === 0) { container.innerHTML = adminCard('قائمة الإشراف', '<p>لا توجد عناصر معلقة.</p>'); return; }
  container.innerHTML = adminCard('قائمة الإشراف', rows.map((m) => `
    <div class="match-row">
      <div>
        <strong>#${m.id}</strong> — ${m.kind}<br>
        <small>المستخدم ${m.user_id} — درجة المخاطرة ${m.risk_score}</small>
        <p style="font-size:13px;color:var(--muted);margin:4px 0">${escapeHtml(m.originalText || '')}</p>
      </div>
      <div>
        <button class="secondary" data-action="mod-approve" data-id="${m.id}">موافقة</button>
        <button class="danger" data-action="mod-reject" data-id="${m.id}">رفض</button>
      </div>
    </div>
  `).join(''));
  container.querySelectorAll('button[data-action^="mod-"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action === 'mod-approve' ? 'approve' : 'reject';
      try {
        await api(`/admin/moderation/${btn.dataset.id}/resolve`, 'POST', { action, reason: 'تم من لوحة الإدارة' });
        renderAdminSection();
      } catch (err) { showError(container, err); }
    });
  });
}

async function renderAdminUsers(container) {
  const data = await api('/admin/users');
  const rows = data.users || [];
  container.innerHTML = adminCard('المستخدمين', rows.slice(0, 30).map((u) => `
    <div class="match-row">
      <div>
        <strong>${escapeHtml(u.name)}</strong> — ${u.role}<br>
        <small>${u.phone} — ${u.status}</small>
      </div>
      <div>
        ${u.status === 'active' ? `<button class="danger" data-action="suspend" data-id="${u.id}">إيقاف</button>` : ''}
        ${u.status === 'suspended' ? `<button class="secondary" data-action="unsuspend" data-id="${u.id}">تفعيل</button>` : ''}
      </div>
    </div>
  `).join(''));
  container.querySelectorAll('button[data-action="suspend"], button[data-action="unsuspend"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      const path = action === 'suspend' ? `/admin/users/${btn.dataset.id}/suspend` : `/admin/users/${btn.dataset.id}/unsuspend`;
      try {
        await api(path, 'POST', { reason: 'من لوحة الإدارة' });
        renderAdminSection();
      } catch (err) { showError(container, err); }
    });
  });
}

async function renderAdminAudit(container) {
  const data = await api('/admin/audit-log');
  const rows = data.actions || [];
  container.innerHTML = adminCard('سجل المراجعة', rows.slice(0, 30).map((a) => `
    <div class="match-row">
      <div>
        <strong>${a.action}</strong> — ${a.target_type} #${a.target_id}<br>
        <small>بواسطة ${a.actor_role} — ${a.created_at}</small>
      </div>
    </div>
  `).join(''));
}

function init() {
  document.querySelectorAll('#nav button').forEach((btn) => {
    btn.addEventListener('click', () => setPage(btn.dataset.page));
  });
  if (state.token) {
    document.getElementById('nav').classList.remove('hidden');
    const adminBtn = document.getElementById('nav-admin');
    if (adminBtn) adminBtn.classList.toggle('hidden', !isStaff(state.user?.role));
    updateBadge();
    registerPushToken();
    connectRealtime();
    renderProfile();
  } else {
    renderLogin();
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
  }
}

loadConfig().then((base) => {
  API_BASE = base;
  init();
});
