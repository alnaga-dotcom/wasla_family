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
  renderWelcome();
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
  const fieldErr = err?.field === true;
  let msg = err?.data?.message || err?.message || 'حدث خطأ';
  if (!err?.status && !fieldErr) msg = 'تعذر الاتصال بالخادم — حاول مرة أخرى بعد لحظات';
  const cls = fieldErr ? 'error-field' : 'error';
  container.innerHTML = `<div class="${cls}">${msg}</div>`;
}

function brandHeader() {
  return `<img class="app-logo" src="logo.png" alt="وصلــه WASLA" />`;
}

function renderWelcome() {
  const app = el('app');
  app.innerHTML = `
    <div class="auth-screen">
      <header class="auth-hero welcome-hero">
        ${brandHeader()}
        <h1 class="welcome-title">نربط القلوب<br><em>لنبني أسرًا مستقرة</em></h1>
        <p class="auth-hero-tag">منصة زواج جاد وآمنة — أفراد حقيقيون، تحقق موثوق، وخصوصية محمية</p>
      </header>
      <div class="auth-body">
        <ul class="welcome-features">
          <li><span class="w-feature-icon">✓</span><span>أعضاء موثّقون بتحقق متعدد المستويات</span></li>
          <li><span class="w-feature-icon">◆</span><span>توافق ذكي بناءً على معاييرك</span></li>
          <li><span class="w-feature-icon">⌁</span><span>تواصل آمن مع حظر وإبلاغ ومراجعة</span></li>
        </ul>
        <button class="btn-primary" id="welcomeLogin">تسجيل الدخول</button>
        <button class="btn-ghost" id="welcomeRegister">إنشاء حساب جديد</button>
        <p class="welcome-note">
          بتسجيلك أنت توافق على <a href="https://wasla.family/terms.html">الشروط</a> و
          <a href="https://wasla.family/privacy.html">سياسة الخصوصية</a>
        </p>
      </div>
    </div>
  `;
  el('welcomeLogin').addEventListener('click', renderLogin);
  el('welcomeRegister').addEventListener('click', renderRegister);
}

function renderLogin() {
  const app = el('app');
  app.innerHTML = `
    <div class="auth-screen">
      <header class="auth-hero">
        ${brandHeader()}
        <p class="auth-hero-tag">منصة زواج جاد وآمنة — تبدأ رحلتك بخطوة</p>
      </header>
      <div class="auth-body">
        <div class="card auth-card">
          <h1 class="auth-title">تسجيل الدخول</h1>
          <p class="auth-sub">أدخل رقم هاتفك وسنرسل رمز التحقق إلى بريدك الإلكتروني</p>
          <label>رقم الهاتف</label>
          <input id="phone" type="tel" placeholder="01xxxxxxxx" />
          <button class="btn-primary" id="loginBtn">إرسال رمز التحقق</button>
          <div id="error"></div>
        </div>
        <p class="auth-switch">ليس لديك حساب؟ <a href="#" id="toRegister">سجّل الآن</a></p>
      </div>
    </div>
  `;
  el('toRegister').addEventListener('click', (e) => { e.preventDefault(); renderRegister(); });
  el('loginBtn').addEventListener('click', async () => {
    const phone = el('phone').value.trim();
    if (!phone) { showError(el('error'), { field: true, message: 'أدخل رقم الهاتف' }); return; }
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
        <p class="auth-sub">من نحن؟</p>
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
        <p class="auth-sub">من أين أنت؟</p>
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
        <p class="auth-sub">عملك وتواصلك</p>
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
        <input id="email" type="email" placeholder="example@domain.com" required />
      `;
    }
    app.innerHTML = `
      <div class="auth-screen">
        <header class="auth-hero auth-hero-compact">${brandHeader()}</header>
        <div class="auth-body">
          <div class="card auth-card">
            <h1 class="auth-title">إنشاء حساب</h1>
            <div class="step-dots">
              ${[1, 2, 3].map((s) => `<div class="step-dot ${s <= step ? 'is-active' : ''}"><span>${s}</span></div>`).join('')}
            </div>
            ${body}
            <div class="auth-nav">
              ${step > 1 ? `<button class="btn-ghost" id="backBtn">السابق</button>` : ''}
              ${step < 3 ? `<button class="btn-primary" id="nextBtn">التالي</button>` : `<button class="btn-primary" id="registerBtn">إنشاء حسابي</button>`}
            </div>
            <div id="error"></div>
          </div>
          <p class="auth-switch">لديك حساب؟ <a href="#" id="toLogin">ادخل</a></p>
        </div>
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
        if (!el('name').value.trim()) { showError(el('error'), { field: true, message: 'أكمل حقول التسجيل — اكتب اسم الظهور' }); return; }
        const by = el('birthYear').value.trim();
        if (!by) { showError(el('error'), { field: true, message: 'أكمل حقول التسجيل — اكتب سنة الميلاد' }); return; }
        const byN = Number(by);
        if (byN < 1948 || byN > 2008) { showError(el('error'), { field: true, message: 'سنة الميلاد يجب أن تكون بين ١٩٤٨ و ٢٠٠٨' }); return; }
        reg.name = el('name').value.trim();
        reg.gender = el('gender').value;
        reg.firstName = el('firstName').value.trim();
        reg.familyName = el('familyName').value.trim();
        reg.birthYear = by;
      } else if (step === 2) {
        if (!el('city').value.trim()) { showError(el('error'), { field: true, message: 'أكمل حقول التسجيل — اكتب اسم المدينة' }); return; }
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
        showError(el('error'), { field: true, message: 'أكمل حقول التسجيل: ' + missing.join('، ') });
        return;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError(el('error'), { field: true, message: 'البريد الإلكتروني غير صالح' });
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
        setToken(data.token, data.user);
        renderProfile();
      } catch (err) { showError(el('error'), err); }
    });
  }
  draw();
}

function renderVerify(hint) {
  const app = el('app');
  app.innerHTML = `
    <div class="auth-screen">
      <header class="auth-hero auth-hero-compact">${brandHeader()}</header>
      <div class="auth-body">
        <div class="card auth-card">
          <h1 class="auth-title">رمز التحقق</h1>
          <p class="auth-sub">أدخل الرمز المرسل إلى بريدك الإلكتروني (تحقق من البريد المزعج أيضًا)</p>
          ${hint ? `<p class="badge">رمز التجربة: ${hint}</p>` : ''}
          <input id="code" type="text" placeholder="الرمز" />
          <button class="btn-primary" id="verifyBtn">تحقق</button>
          <div id="error"></div>
        </div>
      </div>
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
    const profilePhoto = photos.profile ? { ...photos.profile, src: await authImageUrl(photos.profile.url) } : null;
    const privatePhotos = await Promise.all((photos.private || []).map(async (p) => ({ ...p, src: await authImageUrl(p.url) })));
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
      ${emailVerificationCard(me.user)}
      ${verCard}
      <div class="card">
        <h3>صورة الظهور</h3>
        <p class="auth-sub">هذه الصورة ستظهر للجميع — يمكنك استخدام صورتك الشخصية أو صورة رمزية (إلزامية)</p>
        ${photoUploader('photo', 'صورة الظهور', profilePhoto)}
      </div>
      <div class="card">
        <h3>قسم الصور الخاصة</h3>
        <p class="auth-sub">فقط صور تظهر لمن أعجبت بهم — صور حقيقية (حتى ٦)</p>
        ${privateGallery(privatePhotos)}
      </div>
      <div class="card">
        <h3>بيانات إضافية</h3>
        ${fieldEditor('height', 'الطول (سم)', 'number', fields.height)}
        ${fieldEditor('weight', 'الوزن (كجم)', 'number', fields.weight)}
        <p class="auth-sub">اكتب نبذة جيدة عن نفسك — تُظهر للجميع وتُحسّن توافقك</p>
        ${fieldEditor('bio', 'نبذة عني', 'textarea', fields.bio)}
        <button id="saveProfile">حفظ</button>
        <div id="error"></div>
      </div>
    `;
    bindPhotoUploader('photo', '/api/profile/photo');
    bindPrivateGallery();
    const verBtn = el('requestVerification');
    if (verBtn) {
      verBtn.addEventListener('click', async () => {
        try {
          await api('/api/verification/request', 'POST', { type: 'id' });
          renderProfile();
        } catch (err) { showError(el('error'), err); }
      });
    }
    const evBtn = el('goEmailVerify');
    if (evBtn) evBtn.addEventListener('click', () => renderEmailVerify(() => renderProfile()));
    el('saveProfile').addEventListener('click', async () => {
      const keys = ['height', 'weight', 'bio'];
      const updates = [];
      for (const key of keys) {
        const input = el('field-' + key);
        if (input) updates.push({ field_key: key, value: String(input.value || '') });
      }
      const saveBtn = el('saveProfile');
      const errBox = el('error');
      saveBtn.disabled = true;
      saveBtn.textContent = 'جاري الحفظ...';
      try {
        await api('/api/profile/me', 'PATCH', { fields: updates });
        errBox.innerHTML = `<div class="success-msg">تم الحفظ بنجاح ✓</div>`;
        saveBtn.disabled = false;
        saveBtn.textContent = 'حفظ';
        setTimeout(() => setPage('discovery'), 900);
      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'حفظ';
        showError(errBox, err);
      }
    });
  } catch (err) { showError(app, err); }
}

function emailVerificationCard(user) {
  if (user.emailVerified) {
    return `<div class="card"><h3>البريد الإلكتروني</h3><p class="badge">مفعّل ✓ — ${escapeHtml(user.email || '')}</p></div>`;
  }
  return `
    <div class="card">
      <h3>تفعيل البريد الإلكتروني</h3>
      <p style="font-size:14px;color:var(--muted)">فعّل بريدك الإلكتروني للوصول إلى البحث والمراسلة.</p>
      <button id="goEmailVerify">تفعيل الآن</button>
    </div>
  `;
}

function isEmailGate(err) {
  return err?.status === 403 && err?.data?.code === 'EMAIL_VERIFICATION_REQUIRED';
}

async function authImageUrl(url) {
  if (!url) return null;
  try {
    const res = await fetch(API_BASE + url, { headers: { Authorization: 'Bearer ' + state.token } });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch { return null; }
}

function renderEmailVerify(onVerified) {
  const app = el('app');
  app.innerHTML = `
    <div class="card">
      ${brandHeader()}
      <h1>تفعيل البريد الإلكتروني</h1>
      <p>فعّل بريدك الإلكتروني للوصول إلى البحث والمراسلة.</p>
      <label>البريد الإلكتروني</label>
      <input id="evEmail" type="email" placeholder="example@domain.com" value="${escapeHtml(state.user?.email || '')}" />
      <button id="evRequest">إرسال رمز التحقق</button>
      <div id="evCodeWrap" style="display:none;margin-top:12px">
        <label>رمز التحقق</label>
        <input id="evCode" type="text" placeholder="123456" />
        <button id="evVerify">تحقق</button>
      </div>
      <div id="error"></div>
      <p style="text-align:center;margin-top:16px"><a href="#" id="evBack">عودة</a></p>
    </div>
  `;
  el('evBack').addEventListener('click', (e) => { e.preventDefault(); renderProfile(); });
  el('evRequest').addEventListener('click', async () => {
    const email = el('evEmail').value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError(el('error'), { message: 'أدخل بريدًا إلكترونيًا صحيحًا' });
      return;
    }
    try {
      const data = await api('/api/auth/email/request', 'POST', { email });
      state.user.email = email;
      localStorage.setItem('wasla_user', JSON.stringify(state.user));
      el('evCodeWrap').style.display = 'block';
      el('evRequest').style.display = 'none';
      if (data.dev?.otp) el('evCode').placeholder = 'رمز التجربة: ' + data.dev.otp;
    } catch (err) { showError(el('error'), err); }
  });
  el('evVerify').addEventListener('click', async () => {
    const code = el('evCode').value.trim();
    if (!code) { showError(el('error'), { message: 'أدخل رمز التحقق' }); return; }
    try {
      const data = await api('/api/auth/email/verify', 'POST', { code });
      state.user = data.user;
      localStorage.setItem('wasla_user', JSON.stringify(data.user));
      if (onVerified) onVerified(); else renderProfile();
    } catch (err) { showError(el('error'), err); }
  });
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
  const pending = photo && photo.reviewStatus === 'pending' ? '<p class="badge">قيد المراجعة — سيظهر بعد موافقة الإدارة</p>' : '';
  const preview = photo && photo.src ? `<img src="${photo.src}" style="width:120px;height:120px;object-fit:cover;border-radius:12px;margin:8px 0" alt="${label}" />` : '';
  return `
    <div style="margin-bottom:16px">
      <label>${label}</label>
      ${pending}
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

function privateGallery(items) {
  const thumbs = items.map((p) => `
    <div style="position:relative;display:inline-block;margin:4px">
      <img src="${p.src}" style="width:100px;height:100px;object-fit:cover;border-radius:12px" alt="صورة خاصة" />
      <button data-del="${p.id}" style="position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;background:#C0392B;color:#fff;border:none;font-size:12px;cursor:pointer;line-height:1">×</button>
    </div>`).join('');
  const remaining = 6 - items.length;
  const addBtn = remaining > 0
    ? `<div style="margin-top:8px"><input type="file" id="private-input" accept="image/png,image/jpeg" style="display:block;margin-bottom:8px" /><button id="private-upload">رفع صورة خاصة</button></div>`
    : '<p class="badge">وصلت للحد الأقصى (٦ صور)</p>';
  return `
    <div id="private-grid">${thumbs || '<p class="badge" style="margin:0">لا توجد صور خاصة بعد</p>'}</div>
    ${addBtn}
    <div id="private-error"></div>
  `;
}

function bindPrivateGallery() {
  const uploadBtn = el('private-upload');
  if (uploadBtn) {
    uploadBtn.addEventListener('click', async () => {
      const input = el('private-input');
      const file = input && input.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('photo', file);
      try {
        await apiUpload('/api/profile/private', formData);
        renderProfile();
      } catch (err) { showError(el('private-error'), err); }
    });
  }
  document.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await api('/api/profile/private/' + btn.dataset.del, 'DELETE');
        renderProfile();
      } catch (err) { showError(el('private-error'), err); }
    });
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
    const avatar = await authImageUrl(c.photo);
    app.innerHTML = `
      <div class="card candidate">
        ${avatar ? `<img src="${avatar}" style="width:120px;height:120px;object-fit:cover;border-radius:50%;margin:0 auto 8px;display:block" alt="صورة رمزية" />` : ''}
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
  } catch (err) {
    if (isEmailGate(err)) { renderEmailVerify(() => renderDiscovery()); return; }
    showError(app, err);
  }
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
      } catch (err) {
        if (isEmailGate(err)) { renderEmailVerify(() => renderChat(userId)); return; }
        showError(el('error'), err);
      }
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
        <button class="secondary" data-admin="photos">الصور</button>
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
    else if (adminSection === 'photos') await renderAdminPhotos(container);
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

async function renderAdminPhotos(container) {
  const data = await api('/admin/photos?status=pending');
  const rows = data.items || [];
  if (rows.length === 0) { container.innerHTML = adminCard('مراجعة الصور', '<p>لا توجد صور بانتظار المراجعة.</p>'); return; }
  container.innerHTML = adminCard('مراجعة الصور', rows.map((p) => `
    <div class="match-row" style="align-items:flex-start">
      <div style="text-align:center">
        <img id="pimg-${p.id}" src="/svg-loader.svg" style="width:90px;height:90px;object-fit:cover;border-radius:12px" alt="صورة" />
        <br><small>#${p.id} — ${p.userName} (${p.userPhone})</small>
      </div>
      <div>
        <button class="secondary" data-paction="approve" data-id="${p.id}">موافقة</button>
        <button class="danger" data-paction="reject" data-id="${p.id}">رفض</button>
      </div>
    </div>
  `).join(''));
  for (const p of rows) {
    const src = await authImageUrl(p.url);
    const img = el('pimg-' + p.id);
    if (img && src) img.src = src;
  }
  container.querySelectorAll('button[data-paction]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.paction;
      const reason = action === 'reject' ? (prompt('سبب الرفض (اختياري)') || '') : '';
      try {
        await api(`/admin/photos/${btn.dataset.id}/decision`, 'POST', { action, reason });
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

/* --- PWA install prompt --- */
function isStandaloneApp() {
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.navigator && window.navigator.standalone === true) return true;
  return false;
}

function isNativeApp() {
  return typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
}

function hideInstallBanner() {
  const b = document.getElementById('install-banner');
  if (b) b.remove();
}

function initInstallPrompt() {
  if (isNativeApp() || isStandaloneApp()) return;
  const hiddenUntil = Number(localStorage.getItem('wasla_install_hidden_until') || 0);
  if (hiddenUntil > Date.now()) return;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  let deferred = null;

  const showBanner = (onInstall) => {
    if (document.getElementById('install-banner')) return;
    const div = document.createElement('div');
    div.id = 'install-banner';
    div.className = 'install-banner';
    div.innerHTML = `
      <div class="install-card">
        <img class="install-icon" src="logo.png" alt="وصلــه" />
        <div class="install-text">
          <strong>ثبّت تطبيق وصلــه</strong>
          <span>أضِفه إلى شاشتك الرئيسية لفتح أسرع مثل التطبيقات</span>
        </div>
        <button class="btn-primary install-cta">${isIOS ? 'طريقة التثبيت' : 'تثبيت الآن'}</button>
        <button class="install-close" aria-label="إغلاق">×</button>
      </div>
    `;
    div.querySelector('.install-close').addEventListener('click', () => {
      localStorage.setItem('wasla_install_hidden_until', String(Date.now() + 7 * 24 * 60 * 60 * 1000));
      hideInstallBanner();
    });
    div.querySelector('.install-cta').addEventListener('click', () => {
      if (isIOS) {
        const span = div.querySelector('.install-text span');
        span.textContent = 'افتح قائمة ⋯ ثم اختر "إضافة إلى الشاشة الرئيسية"';
        div.querySelector('.install-cta').style.display = 'none';
        return;
      }
      if (deferred) {
        const p = deferred;
        deferred = null;
        p.prompt();
        p.userChoice.then((choice) => {
          if (choice.outcome === 'accepted') {
            localStorage.removeItem('wasla_install_hidden_until');
            hideInstallBanner();
          }
        }).catch(() => {});
      }
    });
    document.body.appendChild(div);
  };

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    showBanner();
  });

  window.addEventListener('appinstalled', () => {
    hideInstallBanner();
    localStorage.setItem('wasla_install_hidden_until', String(Date.now() + 7 * 24 * 60 * 60 * 1000));
  });

  if (isIOS) showBanner();
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
    renderWelcome();
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
  }
  initInstallPrompt();
}

loadConfig().then((base) => {
  API_BASE = base;
  init();
});
