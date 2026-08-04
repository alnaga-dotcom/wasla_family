(function () {
  'use strict';

  function toLocalizedDigits(value) { return window.toLocalizedDigits(value); }
  const t = function (key, vars) { return window.t(key, vars); };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  // ---------- View switching ----------
  function showView(name) {
    $$('.view').forEach(function (v) { v.classList.remove('active'); });
    const view = $('#view-' + name);
    if (view) view.classList.add('active');
    $$('.app-nav button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.view === name);
    });
    if (name === 'matches') renderMatches();
    if (name === 'messages') renderMessages();
    if (name === 'discovery') renderDiscovery();
    if (name === 'search') renderSearch();
    if (name === 'settings') renderSettings();
  }

  // ============================================================
  // AUTH — live API with demo fallback
  // ============================================================
  const API_BASE = 'http://127.0.0.1:4000';
  let token = null;
  let pendingAuth = { phone: '', otp: null, demo: false };

  function storeToken(t) { token = t; try { localStorage.setItem('wasla_token', t); } catch (e) {} }
  function clearToken() { token = null; try { localStorage.removeItem('wasla_token'); } catch (e) {} }

  async function apiFetch(path, options) {
    try {
      const res = await fetch(API_BASE + path, {
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        ...(options || {})
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      return null; // network error → demo mode
    }
  }

  (function restoreSession() {
    let saved = null;
    try { saved = localStorage.getItem('wasla_token'); } catch (e) {}
    if (!saved) return;
    apiFetch('/api/auth/me').then(function (r) {
      if (r && r.ok) { storeToken(saved); startSession(); toast(t('auth.welcomeBack')); }
      else if (r && r.data && r.data.code === 'ACCOUNT_DELETED') {
        storeToken(saved);
        $('#app-shell').hidden = false;
        showView('settings');
        maybeShowRestore();
      }
      else clearToken();
    });
  })();

  function maybeShowRestore() {
    if (!token) return;
    apiFetch('/api/me/account/status').then(function (r) {
      if (r && r.ok && r.data.deleted) {
        $('#restore-by').textContent = t('restore.deadline', { date: toLocalizedDigits(r.data.restoreBy) });
        $('#restore-modal').hidden = false;
      }
    });
  }

  $('#btn-restore-account').addEventListener('click', function () {
    apiFetch('/api/me/account/restore', { method: 'POST', body: '{}' }).then(function (r) {
      if (r && r.ok && r.data.restored) {
        $('#restore-modal').hidden = true;
        toast(t('restore.restored'));
        location.reload();
      } else {
        toast((r && r.data && r.data.message) || t('restore.restoreFail'));
      }
    });
  });

  $('#btn-confirm-delete').addEventListener('click', function () {
    $('#restore-modal').hidden = true;
    toast(t('restore.logout'));
    clearToken();
    $('#app-shell').hidden = true;
    $('#view-login').hidden = false;
    $('#form-login').hidden = false;
    $('#form-register').hidden = true;
    $('#form-otp').hidden = true;
  });

  function startSession() {
    $('#view-login').hidden = true;
    $('#app-shell').hidden = false;
    showView('onboarding');
    if (token) {
      renderNotifications();
      clearInterval(window.__notifTimer);
      window.__notifTimer = setInterval(renderNotifications, 8000);
    }
    toast(t('auth.welcome'));
  }

  function showOtp(hint) {
    $('#form-login').hidden = true;
    $('#form-register').hidden = true;
    $('#form-otp').hidden = false;
    const hintEl = $('#otp-hint');
    if (hintEl) hintEl.textContent = hint;
    $('#otp-code').focus();
  }

  const authTabs = $$('.auth-tab');
  authTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      authTabs.forEach(function (t) {
        const active = t === tab;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', String(active));
      });
      $('#form-login').hidden = tab.dataset.atab !== 'login';
      $('#form-register').hidden = tab.dataset.atab !== 'register';
    });
  });

  $('#form-login').addEventListener('submit', async function (e) {
    e.preventDefault();
    const phone = $('#li-phone').value.trim();
    const btn = $('#form-login button[type="submit"]');
    btn.disabled = true; btn.textContent = t('common.loading');
    const r = await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone }) });
    btn.disabled = false; btn.textContent = t('auth.loginBtn');
    if (r === null) { pendingAuth = { phone: phone, otp: null, demo: true }; showOtp(t('auth.otpDemo')); return; }
    if (!r.ok) { toast(r.data.message || t('auth.errorLogin')); return; }
    pendingAuth = { phone: phone, otp: r.data.dev ? r.data.dev.otp : null, demo: false };
    showOtp(r.data.dev ? (t('auth.otpDev') + ' ' + toLocalizedDigits(r.data.dev.otp)) : t('auth.otpReal'));
  });

  $('#form-register').addEventListener('submit', async function (e) {
    e.preventDefault();
    const name = $('#re-name').value.trim();
    const phone = $('#re-phone').value.trim();
    const gender = $('#re-gender').value;
    const btn = $('#form-register button[type="submit"]');
    btn.disabled = true; btn.textContent = t('common.loading');
    const r = await apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ name: name, phone: phone, gender: gender }) });
    btn.disabled = false; btn.textContent = t('auth.registerBtn');
    if (r === null) { pendingAuth = { phone: phone, otp: null, demo: true }; showOtp(t('auth.otpDemo')); return; }
    if (!r.ok) { toast(r.data.message || t('auth.errorRegister')); return; }
    pendingAuth = { phone: phone, otp: r.data.dev ? r.data.dev.otp : null, demo: false };
    showOtp(r.data.dev ? (t('auth.otpDev') + ' ' + toLocalizedDigits(r.data.dev.otp)) : t('auth.otpReal'));
  });

  $('#form-otp').addEventListener('submit', async function (e) {
    e.preventDefault();
    const code = $('#otp-code').value.trim();
    if (pendingAuth.demo) {
      if (code.length < 4) { toast(t('auth.otpLabel')); return; }
      $('#view-login').querySelectorAll('.auth-form').forEach(function (f) { f.hidden = true; });
      startSession();
      return;
    }
    if (!/^\d{6}$/.test(code)) { toast(t('auth.otpLabel')); return; }
    const r = await apiFetch('/api/auth/otp/verify', { method: 'POST', body: JSON.stringify({ phone: pendingAuth.phone, code: code }) });
    if (r && r.ok) {
      storeToken(r.data.token);
      $('#view-login').querySelectorAll('.auth-form').forEach(function (f) { f.hidden = true; });
      startSession();
      maybeShowRestore();
    } else if (r) {
      toast(r.data.message || t('auth.otpLabel'));
    } else {
      $('#view-login').querySelectorAll('.auth-form').forEach(function (f) { f.hidden = true; });
      startSession();
    }
  });

  function logout() {
    if (token) apiFetch('/api/auth/logout', { method: 'POST' });
    clearToken();
    $('#app-shell').hidden = true;
    $('#view-login').hidden = false;
    $('#form-login').hidden = false;
    $('#form-register').hidden = true;
    $('#form-otp').hidden = true;
    $$('.auth-tab').forEach(function (t) {
      t.classList.toggle('is-active', t.dataset.atab === 'login');
    });
  }

  $('#btn-logout').addEventListener('click', logout);

  $('#btn-settings').addEventListener('click', function () { showView('settings'); });

  $('#btn-lang').addEventListener('click', function () {
    const next = (window.I18n && window.I18n.current === 'ar') ? 'en' : 'ar';
    window.I18n.set(next);
  });

  // ---------- Notifications (Wasla_16) ----------
  const notifPanel = $('#notif-panel');
  const notifBadge = $('#notif-badge');

  function renderNotifications() {
    if (!token) return;
    apiFetch('/api/notifications').then(function (r) {
      if (!r || !r.ok) return;
      const unread = r.data.unread || 0;
      notifBadge.hidden = unread === 0;
      notifBadge.textContent = toLocalizedDigits(unread);
      if (!notifPanel.hidden) {
        const list = $('#notif-list');
        if (r.data.notifications.length === 0) {
          list.innerHTML = '<p class="notif-empty">' + t('nav.notificationsEmpty') + '</p>';
          return;
        }
        list.innerHTML = r.data.notifications.map(function (n) {
          return '<button class="notif-item' + (n.is_read ? '' : ' unread') + '" type="button" data-id="' + n.id + '">' +
            '<span class="row">' + n.text + '<span class="when">' + t('messages.justNow') + '</span></span>' +
          '</button>';
        }).join('');
        $$('.notif-item', list).forEach(function (el) {
          el.addEventListener('click', function () {
            apiFetch('/api/notifications/read', { method: 'POST', body: JSON.stringify({ id: el.dataset.id }) });
            renderNotifications();
          });
        });
      }
    });
  }

  $('#btn-notifications').addEventListener('click', function () {
    if (!token) { toast(t('nav.notificationsLoginRequired')); return; }
    notifPanel.hidden = !notifPanel.hidden;
    renderNotifications();
  });

  $('#notif-read-all').addEventListener('click', function () {
    apiFetch('/api/notifications/read', { method: 'POST', body: '{}' }).then(function () {
      renderNotifications();
      toast(t('nav.notificationsReadAllDone'));
    });
  });

  document.addEventListener('click', function (e) {
    if (!notifPanel.hidden && !e.target.closest('.notif-wrap')) notifPanel.hidden = true;
  });

  $$('.app-nav button').forEach(function (btn) {
    btn.addEventListener('click', function () { showView(btn.dataset.view); });
  });

  // ============================================================
  // ONBOARDING
  // ============================================================
  const SYNC_KEYS = ['age', 'city', 'profession', 'education', 'religiosity', 'lifestyle', 'nationality', 'height', 'health', 'photo_done', 'selfie_done'];
  function syncField(key, value) {
    if (!token || SYNC_KEYS.indexOf(key) === -1) return;
    apiFetch('/api/profile/me', { method: 'PATCH', body: JSON.stringify({ field_key: key, value: value }) });
  }

  const nationalityOptions = ['مصري', 'سعودي', 'إماراتي', 'كويتي', 'قطري', 'بحريني', 'عُماني', 'أردني', 'لبناني', 'سوري', 'عراقي', 'مغربي', 'جزائري', 'تونسي', 'ليبي', 'سوداني', 'يمني', 'تركي', 'أخرى'];

  const steps = [
    {
      id: 'basic', title: t('onboarding.group1'), tag: t('onboarding.group1Tag'), weight: 25,
      desc: 'معلومات تحدد مطابقتك الأولى — سرية وأساسية للانطلاق (Wasla_05).',
      fields: [
        { key: 'age', label: t('onboarding.field.age'), type: 'number', placeholder: '28', required: true },
        { key: 'city', label: t('onboarding.field.city'), type: 'select', options: ['القاهرة', 'الجيزة', 'الإسكندرية', 'المنصورة', 'طنطا'], required: true },
        { key: 'nationality', label: t('onboarding.field.nationality'), type: 'select', options: nationalityOptions, required: true }
      ]
    },
    {
      id: 'physical', title: t('onboarding.field.height'), tag: t('onboarding.group1Tag'), weight: 10,
      desc: 'بيانات تسهم في التوافق — تعديلها لا يعاقب (Wasla_05).',
      fields: [
        { key: 'height', label: t('onboarding.field.height'), type: 'number', placeholder: '175', required: true }
      ]
    },
    {
      id: 'career', title: t('onboarding.group2'), tag: t('onboarding.group2Tag'), weight: 15,
      desc: 'إضافتها تحسّن اقتراحاتك — التعليم تفضيل لا قاعدة صارمة أبدًا (Wasla_05).',
      fields: [
        { key: 'profession', label: t('onboarding.field.profession'), type: 'select', options: ['هندسة', 'تعليم', 'طب', 'تجارة', 'محاسبة', 'تقنية'], required: true },
        { key: 'education', label: t('onboarding.field.education'), type: 'select', options: ['ثانوية', 'دبلوم', 'بكالوريوس', 'ماجستير', 'دكتوراه'], required: true }
      ]
    },
    {
      id: 'values', title: t('onboarding.group4'), tag: t('onboarding.group2Tag'), weight: 15,
      desc: 'أهم أسس التوافق — لا تُذكر بيانات محمية في أي تلميح (Wasla_16).',
      fields: [
        { key: 'religiosity', label: t('onboarding.field.religiosity'), type: 'select', options: ['ملتزم', 'متوسط', 'مرن'], required: true },
        { key: 'lifestyle', label: t('onboarding.field.lifestyle'), type: 'select', options: ['هادئ', 'منتظم', 'اجتماعي'], required: true }
      ]
    },
    {
      id: 'verify', title: t('onboarding.selfie'), tag: t('onboarding.group4Tag'), weight: 0,
      desc: t('onboarding.selfieHint'),
      actions: true
    },
    {
      id: 'sensitive', title: t('onboarding.group3'), tag: t('onboarding.group3Tag'), weight: 5,
      desc: 'هذا المستوى اختياري تمامًا ولا يمنع شيئًا؛ يمكنك الإجابة لاحقًا أو تجاوز السؤال (TELL_LATER).',
      optional: true,
      fields: [
        { key: 'health', label: t('onboarding.field.health'), type: 'select', options: ['لا أفضّل الإفصاح الآن (سؤال لاحق)', 'لا توجد', 'أفضّل أن أوضح لاحقًا مع المطابقة'] }
      ]
    }
  ];

  let currentStepIndex = 0;
  let completedWeights = 0;
  const completedSteps = new Set();
  const stepWeights = { verify: { photo: 10, selfie: 15 } };

  const pct = function (n) { return '+' + toLocalizedDigits(String(n)) + t('profile.completionPercent'); };
  const checklistOrder = [
    { id: 'verify', label: t('onboarding.field.photo_done'), bonus: pct(10) },
    { id: 'verify-s', label: t('onboarding.field.selfie_done'), bonus: pct(15) },
    { id: 'career', label: t('onboarding.field.profession'), bonus: pct(15) },
    { id: 'values', label: t('onboarding.field.lifestyle'), bonus: pct(15) },
    { id: 'sensitive', label: t('onboarding.field.health'), bonus: pct(5) + ' ' + t('onboarding.group3Tag').split(' — ')[1] }
  ];

  function checklistItem(id, label, bonus, done) {
    return '<li class="' + (done ? 'done' : 'muted') + '"><span class="step-num">' + (done ? '✓' : '·') + '</span><span>' + label + '</span><span style="margin-inline-start:auto;font-size:11px;color:var(--gold-antique)">' + bonus + '</span></li>';
  }

  function renderChecklist() {
    $('#checklist').innerHTML = checklistOrder.map(function (s) {
      const done = s.id === 'verify-s' ? (selfieDone) : completedSteps.has(s.id);
      return checklistItem(s.id, s.label, s.bonus, done);
    }).join('');
  }

  let photoDone = false;
  let selfieDone = false;

  function updateProgress() {
    const ring = $('#progress-ring');
    ring.style.setProperty('--p', Math.min(completedWeights, 100));
    $('#progress-num').textContent = toLocalizedDigits(Math.min(completedWeights, 100)) + t('profile.completionPercent');
    renderChecklist();
  }

  function addWeight(w) {
    completedWeights += w;
    updateProgress();
  }

  function buildField(f) {
    if (f.type === 'select') {
      const opts = f.options.map(function (o) {
        return '<option value="' + o + '">' + o + '</option>';
      }).join('');
      return '<div class="field"><label for="f-' + f.key + '">' + f.label + '</label><select id="f-' + f.key + '" ' + (f.required ? 'required' : '') + '>' + opts + '</select></div>';
    }
    return '<div class="field"><label for="f-' + f.key + '">' + f.label + '</label><input id="f-' + f.key + '" type="' + f.type + '" placeholder="' + (f.placeholder || '') + '" ' + (f.required ? 'required' : '') + '></div>';
  }

  function renderStep() {
    const step = steps[currentStepIndex];
    $('#group-title').textContent = step.title;
    $('#group-tag').textContent = step.tag;
    $('#group-desc').textContent = step.desc;

    const form = $('#group-form');
    form.innerHTML = '';

    if (step.actions) {
      form.innerHTML =
        '<div class="field"><label>' + t('onboarding.field.photo_done') + '</label>' +
        '<button class="btn btn-outline btn-block" type="button" id="act-photo">' + t('onboarding.field.photo_done') + '</button></div>' +
        '<div class="field"><label>' + t('onboarding.field.selfie_done') + '</label>' +
        '<button class="btn btn-gold btn-block" type="button" id="act-selfie">' + t('onboarding.field.selfie_done') + '</button></div>';
      const photoBtn = $('#act-photo');
      const selfieBtn = $('#act-selfie');
      photoBtn.addEventListener('click', function () {
        if (photoDone) { toast(t('onboarding.field.photo_done')); return; }
        photoDone = true;
        addWeight(stepWeights.verify.photo);
        photoBtn.textContent = '✓ ' + t('onboarding.field.photo_done');
        photoBtn.disabled = true;
        syncField('photo_done', 1);
        toast(t('onboarding.photoHint'));
      });
      selfieBtn.addEventListener('click', function () {
        if (selfieDone) { toast(t('onboarding.field.selfie_done')); return; }
        selfieDone = true;
        addWeight(stepWeights.verify.selfie);
        selfieBtn.textContent = '✓ ' + t('onboarding.field.selfie_done');
        selfieBtn.disabled = true;
        syncField('selfie_done', 1);
        toast(t('onboarding.selfieHint'));
      });
    } else {
      form.innerHTML = step.fields.map(buildField).join('');
    }

    let actionsHtml = '';
    if (step.optional) {
      actionsHtml = '<div class="group-actions"><button class="btn btn-outline" type="button" id="btn-skip">' + t('onboarding.skip') + '</button><button class="btn btn-gold" type="submit">' + t('common.save') + '</button></div>';
    } else if (step.actions) {
      actionsHtml = '<div class="group-actions"><button class="btn btn-gold" type="button" id="btn-next">' + t('common.next') + '</button></div>';
    } else {
      actionsHtml = '<div class="group-actions"><button class="btn btn-gold" type="submit">' + t('common.save') + '</button></div>';
    }
    const actions = document.createElement('div');
    actions.innerHTML = actionsHtml;
    form.appendChild(actions);

    if (step.optional) {
      $('#btn-skip').addEventListener('click', function () {
        completedSteps.add(step.id);
        currentStepIndex += 1;
        if (currentStepIndex >= steps.length) finishOnboarding(); else renderStep();
        updateProgress();
      });
    }
    if (step.actions) {
      $('#btn-next').addEventListener('click', function () {
        completedSteps.add(step.id);
        currentStepIndex += 1;
        if (currentStepIndex >= steps.length) finishOnboarding(); else renderStep();
        updateProgress();
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { toast(t('onboarding.required')); return; }
      if (!step.actions) {
        completedSteps.add(step.id);
        addWeight(step.weight);
      }
      step.fields.forEach(function (f) {
        const el = $('#f-' + f.key);
        if (el) syncField(f.key, el.value);
      });
      currentStepIndex += 1;
      if (currentStepIndex >= steps.length) finishOnboarding(); else renderStep();
      updateProgress();
    });
  }

  function finishOnboarding() {
    showView('discovery');
    toast(token ? t('onboarding.profileReady') : t('onboarding.profileReadyDemo'));
  }

  renderStep();
  updateProgress();

  // ============================================================
  // DISCOVERY
  // ============================================================
  const demoProfiles = [
    { id: 'hind', name: 'هند', age: '٢٥', city: 'القاهرة', job: 'محاسبة', emoji: '🌸', verified: 'L2',
      reasons: ['نفس المدينة', 'توافق تعليمي', 'أهداف متشابهة'], mutual: true },
    { id: 'sara', name: 'سارة', age: '٢٧', city: 'الجيزة', job: 'مهندسة', emoji: '🌿', verified: 'L2',
      reasons: ['توافق ديني', 'نفس نمط الحياة'], mutual: false },
    { id: 'mariam', name: 'مريم', age: '٢٩', city: 'القاهرة', job: 'معلّمة', emoji: '🌙', verified: 'L3',
      reasons: ['مدينة واحدة', 'توافق قيم'], mutual: true }
  ];

  let deck = [];
  let matches = [];       // mutual matches
  let lastDecision = null;

  function initDeck() {
    deck = demoProfiles.map(function (p) { return { profile: p, state: 'pending' }; });
  }

  let liveLoaded = false;

  function mapLiveCard(c) {
    const reasons = [t('discovery.completion') + ' ' + toLocalizedDigits(c.completion || 0) + t('profile.completionPercent')];
    if (c.isVerified) reasons.push(t('discovery.verified') + ' ✓');
    if (c.hasPhoto) reasons.push(t('discovery.hasPhoto'));
    return {
      id: c.userId,
      userId: c.userId,
      name: c.name,
      emoji: c.gender === 'female' ? '🌷' : '🌿',
      age: toLocalizedDigits(c.age || '—'),
      city: c.city || t('common.city'),
      job: c.profession || t('common.none'),
      reasons: reasons,
      mutual: false,
      verified: c.isVerified,
      trustLevel: c.trustLevel || 1,
      live: true
    };
  }

  function levelOf(p) {
    if (typeof p.trustLevel === 'number') return p.trustLevel;
    if (p.verified === 'L2') return 2;
    if (p.verified === 'L3') return 3;
    if (p.verified === true) return 2;
    return 1;
  }

  function trustTitle(lv) {
    if (lv === 3) return t('profile.trustL3');
    if (lv === 2) return t('profile.trustL2');
    return t('profile.trustL1');
  }

  function levelBadge(p) {
    const lv = levelOf(p);
    return '<span class="badge" title="Trust level L' + lv + ' — ' + trustTitle(lv) + '">L' + lv + '</span>';
  }

  function loadLiveDeck() {
    if (liveLoaded) { renderDiscovery(); return; }
    apiFetch('/api/discovery/recommendations').then(function (r) {
      liveLoaded = true;
      if (r && r.ok && r.data.recommendations.length > 0) {
        deck = r.data.recommendations.map(function (c) {
          return { profile: mapLiveCard(c), state: 'pending' };
        });
        toast(t('discovery.liveToast'));
      } else {
        deck = demoProfiles.map(function (p) { return { profile: p, state: 'pending' }; });
        if (r && r.ok && r.data.recommendations.length === 0) toast(t('discovery.demoToast'));
      }
      renderDiscovery();
    });
  }

  function loadLiveMatches() {
    apiFetch('/api/matches/mutual').then(function (r) {
      if (!r || !r.ok) return;
      r.data.matches.forEach(function (m) {
        if (matches.some(function (x) { return String(x.id) === String(m.userId); })) return;
        matches.push({
          id: m.userId,
          name: m.name,
          emoji: m.gender === 'female' ? '🌷' : '🌿',
          verified: true,
          trustLevel: m.trustLevel || 2,
          city: '—',
          job: '—',
          archived: false,
          unread: 1,
          live: true,
          messages: [{ from: 'them', text: 'أهلًا بك! الإعجاب المتبادل فتح المحادثة (Wasla_18).', t: 'قبل قليل' }]
        });
      });
      if ($('#view-matches').classList.contains('active')) renderMatches();
    });
  }

  function renderDiscovery() {
    if (token && !liveLoaded) { loadLiveDeck(); return; }
    $('#disco-count').textContent = toLocalizedDigits(deck.filter(function (d) { return d.state === 'pending'; }).length) + ' ' + t('discovery.suggestions');
    const stack = $('#swipe-stack');
    $$('.swipe-card', stack).forEach(function (c) { c.remove(); });
    const pending = deck.filter(function (d) { return d.state === 'pending'; });
    if (pending.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'card swipe-card';
      empty.style.display = 'grid';
      empty.style.placeItems = 'center';
      empty.style.textAlign = 'center';
      empty.innerHTML = '<div><p style="font-size:40px;margin:0">🕊️</p><h3>' + t('discovery.emptyTitle') + '</h3><p style="opacity:.8">' + t('discovery.emptyBody') + '</p></div>';
      stack.prepend(empty);
      return;
    }
    pending.forEach(function (item) {
      const card = buildSwipeCard(item.profile);
      stack.insertBefore(card, $('.swipe-undo', stack));
    });
    const topCard = $('.swipe-card', stack);
    if (topCard) {
      topCard.classList.add('top');
      attachSwipe(topCard, deck.find(function (d) { return d.state === 'pending'; }).profile);
    }
  }

  function buildSwipeCard(p) {
    const card = document.createElement('article');
    card.className = 'swipe-card';
    const reasons = p.reasons.map(function (r) { return '<span>' + r + '</span>'; }).join('');
    card.innerHTML =
      '<span class="demo-ribbon">' + (p.live ? t('discovery.liveRibbon') : t('discovery.demoRibbon')) + '</span>' +
      '<div class="photo">' + p.emoji + '</div>' +
      '<div class="info">' +
        '<h3 class="name">' + p.name + ' ' + levelBadge(p) + '</h3>' +
        '<p class="meta">' + p.age + ' ' + t('common.years') + ' · ' + p.city + ' · ' + p.job + '</p>' +
        '<div class="reason-chips">' + reasons + '</div>' +
      '</div>' +
      '<div class="swipe-actions">' +
        '<button class="swipe-btn btn-pass" type="button" aria-label="' + t('discovery.pass') + '">✕</button>' +
        '<button class="swipe-btn btn-view" type="button" aria-label="' + t('discovery.view') + '">👁</button>' +
        '<button class="swipe-btn btn-like" type="button" aria-label="' + t('discovery.like') + '">♥</button>' +
      '</div>';
    card.querySelector('.btn-pass').addEventListener('click', function () { decide(p.id, 'pass'); });
    card.querySelector('.btn-like').addEventListener('click', function () { decide(p.id, 'like'); });
    card.querySelector('.btn-view').addEventListener('click', function () {
      if (p.live && p.userId) openProfile(p.userId, 'discovery');
      else toast(t('discovery.demoProfile'));
    });
    return card;
  }

  function attachSwipe(card, profile) {
    if (!card) return;
    let startX = null, startY = null;
    const drag = function (dx) {
      card.style.transform = 'translateX(' + dx + 'px) rotate(' + dx / 22 + 'deg)';
      card.style.opacity = Math.max(0.35, 1 - Math.abs(dx) / 320);
    };
    card.addEventListener('pointerdown', function (e) {
      startX = e.clientX; startY = e.clientY;
      card.classList.add('anim');
      card.setPointerCapture(e.pointerId);
    });
    card.addEventListener('pointermove', function (e) {
      if (startX === null) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > Math.abs(dy)) { e.preventDefault(); drag(dx); }
    });
    card.addEventListener('pointerup', function (e) {
      if (startX === null) return;
      const dx = e.clientX - startX;
      startX = null;
      if (dx > 110) decide(profile.id, 'like');
      else if (dx < -110) decide(profile.id, 'pass');
      else {
        card.style.transform = '';
        card.style.opacity = '';
        setTimeout(function () { card.classList.remove('anim'); }, 300);
      }
    });
    card.addEventListener('pointercancel', function () {
      startX = null;
      card.style.transform = '';
      card.style.opacity = '';
    });
  }

  function setState(profileId, state) {
    const item = deck.find(function (d) { return d.profile.id === profileId; });
    if (item) item.state = state;
  }

  function decide(profileId, action) {
    const card = $('.swipe-card.top') || $('.swipe-card:first-of-type');
    const item = deck.find(function (d) { return d.profile.id === profileId; });
    const profile = item ? item.profile : demoProfiles.find(function (p) { return p.id === profileId; });
    if (!profile) return;
    const fromRight = action === 'like';
    if (card) {
      card.style.transform = 'translateX(' + (fromRight ? 520 : -520) + 'px) rotate(' + (fromRight ? 24 : -24) + 'deg)';
      card.style.opacity = '0';
    }
    lastDecision = { profileId: profileId, action: action };
    setTimeout(function () {
      if (action === 'like') {
        setState(profileId, 'liked');
        toast('أُرسل إعجابك إلى ' + profile.name + ' — سيصلها إشعار هادئ');
        if (token) {
          apiFetch('/api/matches/' + profile.userId + '/like', { method: 'POST', body: JSON.stringify({ like: true }) })
            .then(function (r) {
              if (r && r.ok && r.data.mutual) {
                setTimeout(function () { createMutual(profile); loadLiveMatches(); renderNotifications(); }, 700);
              }
            });
        } else if (profile.mutual) {
          setTimeout(function () { createMutual(profile); }, 700);
        }
      } else {
        setState(profileId, 'passed');
        toast('تم التخطي — لا يتم إخبار أحد بالتخطي');
        if (token) apiFetch('/api/matches/' + profile.userId + '/like', { method: 'POST', body: JSON.stringify({ like: false }) });
      }
      renderDiscovery();
    }, 320);
  }

  $('#btn-undo').addEventListener('click', function () {
    if (!lastDecision) { toast('لا يوجد قرار للتراجع عنه'); return; }
    if (token) { toast(t('discovery.serverDecision')); return; }
    const d = lastDecision;
    if (d.action === 'like') {
      const mIdx = matches.findIndex(function (m) { return m.id === d.profileId; });
      if (mIdx >= 0) matches.splice(mIdx, 1);
    }
    setState(d.profileId, 'pending');
    lastDecision = null;
    renderDiscovery();
    toast(t('discovery.undoToast'));
  });

  let celebrationId = null;

  function createMutual(profile) {
    if (matches.some(function (m) { return String(m.id) === String(profile.id); })) return;
    const live = !!(token && profile.live);
    const m = {
      id: profile.id, name: profile.name, emoji: profile.emoji, verified: profile.verified,
      city: profile.city, job: profile.job, archived: false, unread: 1, live: live,
      messages: live ? [] : [
        { from: 'them', text: t('messages.welcome'), t: t('messages.justNow') }
      ]
    };
    matches.push(m);
    celebrationId = m.id;
    $('#celeb-name').textContent = profile.name;
    $('#celebration').classList.add('show');
  }

  $('#celeb-go').addEventListener('click', function () {
    $('#celebration').classList.remove('show');
    if (celebrationId) { openConversation(celebrationId); showView('messages'); }
    else showView('messages');
  });

  // ============================================================
  // MATCHES
  // ============================================================
  function renderMatches() {
    if (token) loadLiveMatches();
    $('#matches-count').textContent = toLocalizedDigits(matches.length);
    const grid = $('#matches-grid');
    if (matches.length === 0) {
      grid.innerHTML = '<div class="card match-card" style="grid-column:1/-1;text-align:center"><p style="font-size:36px;margin:0 0 6px">💛</p><p style="opacity:.8">' + t('matches.empty') + '</p></div>';
      return;
    }
    grid.innerHTML = matches.map(function (m) {
      return '<article class="card match-card' + (m.archived ? ' archived' : '') + '" data-id="' + m.id + '">' +
        '<div class="ph">' + m.emoji + '</div>' +
        '<h4>' + m.name + ' ' + levelBadge(m) + '</h4>' +
        '<p class="sub">' + m.city + ' · ' + m.job + '</p>' +
        '<div class="actions">' +
          '<button class="msg" type="button" data-act="open">' + (m.archived ? t('matches.restore') : t('matches.message')) + '</button>' +
          (m.archived ? '' : '<button class="arch" type="button" data-act="archive">' + t('matches.archive') + '</button>') +
        '</div>' +
      '</article>';
    }).join('');

    $$('#matches-grid .match-card').forEach(function (card) {
      const m = matches.find(function (x) { return String(x.id) === String(card.dataset.id); });
      if (m && m.live) {
        card.addEventListener('click', function (e) {
          if (!e.target.closest('.actions')) openProfile(m.id, 'matches');
        });
      }
      card.querySelector('[data-act="open"]').addEventListener('click', function () {
        if (m.archived) { m.archived = false; renderMatches(); toast(t('matches.restore')); return; }
        openConversation(m.id);
      });
      const archBtn = card.querySelector('[data-act="archive"]');
      if (archBtn) archBtn.addEventListener('click', function () {
        m.archived = true;
        if (token && m.live) apiFetch('/api/matches/' + m.id + '/archive', { method: 'POST', body: '{}' });
        renderMatches();
        toast(t('matches.archived'));
      });
    });
  }

  // ============================================================
  // MESSAGES
  // ============================================================
  let activeConversationId = null;

  function loadLiveConversations() {
    apiFetch('/api/conversations').then(function (r) {
      if (!r || !r.ok) return;
      let changed = false;
      r.data.conversations.forEach(function (c) {
        if (matches.some(function (x) { return String(x.id) === String(c.userId); })) return;
        changed = true;
        matches.push({
          id: c.userId,
          name: c.name,
          emoji: c.gender === 'female' ? '🌷' : '🌿',
          verified: true,
          trustLevel: c.trustLevel || 2,
          city: '—',
          job: '—',
          archived: false,
          unread: c.unread || 0,
          preview: c.lastMessage ? c.lastMessage.text : '',
          blocked: c.blocked,
          live: true,
          messages: []
        });
      });
      if (changed) renderMessages();
    });
  }

  function renderMessages() {
    if (token) loadLiveConversations();
    const list = $('#msg-list');
    const active = matches.filter(function (m) { return !m.archived; });
    if (active.length === 0) {
      list.innerHTML = '<p style="text-align:center;opacity:.6;font-size:14px;padding:20px">' + t('messages.empty') + '</p>';
      return;
    }
    list.innerHTML = active.map(function (m) {
      const last = m.messages[m.messages.length - 1];
      const preview = last ? last.text : (m.preview || t('messages.openMatch'));
      return '<div class="msg-thread' + (m.id === activeConversationId ? ' active' : '') + '" data-id="' + m.id + '">' +
        '<div class="row"><b>' + m.name + '</b>' + (m.unread ? '<span style="background:var(--burgundy);color:var(--gold-light);border-radius:999px;font-size:11px;padding:2px 8px;font-weight:800">' + toLocalizedDigits(m.unread) + '</span>' : '') + '</div>' +
        '<p class="pre">' + preview + '</p>' +
      '</div>';
    }).join('');
    $$('.msg-thread', list).forEach(function (th) {
      th.addEventListener('click', function () { openConversation(th.dataset.id); });
    });
  }

  function openConversation(id) {
    activeConversationId = id;
    const m = matches.find(function (x) { return String(x.id) === String(id); });
    if (!m) return;
    m.unread = 0;
    renderMessages();
    if (m.live) {
      apiFetch('/api/conversations/' + id + '/messages').then(function (r) {
        if (!r || !r.ok) return;
        m.messages = r.data.messages.map(function (msg) {
          return {
            from: msg.fromMe ? 'me' : 'them',
            text: msg.kind === 'ephemeral' ? t('messages.ephemeralLabel') : msg.text,
            ephemeral: msg.kind === 'ephemeral',
            t: t('messages.now')
          };
        });
        apiFetch('/api/conversations/' + id + '/messages/0/read', { method: 'POST', body: '{}' });
        renderChatPanel(m);
        apiFetch('/api/matches/' + id + '/reasons').then(function (rr) {
          if (rr && rr.ok && rr.data.reasons && rr.data.reasons.length) {
            m.reasons = rr.data.reasons;
            renderChatPanel(m);
          }
        });
      });
      return;
    }
    renderChatPanel(m);
  }

  function renderChatPanel(m) {
    const panel = $('#chat-panel');
    const reasonsHtml = (m.reasons && m.reasons.length)
      ? '<div class="chat-reasons"><span style="opacity:.7;margin-inline-end:6px">' + t('messages.reasons') + ':</span>' + m.reasons.map(function (r) { return '<span>' + r + '</span>'; }).join('') + '</div>'
      : '';
    panel.innerHTML =
      '<div class="chat-head"><div class="who"><span class="av">' + m.emoji + '</span><span>' + m.name + ' ' + levelBadge(m) + ' <small style="opacity:.7">' + (m.live ? t('messages.registered') : t('messages.demo')) + '</small></span></div>' +
      '<button class="btn-logout" id="chat-more" type="button" style="font-size:12px">' + t('messages.blockReport') + '</button></div>' +
      (reasonsHtml ? reasonsHtml : '') +
      '<div class="chat-body" id="chat-body"></div>' +
      '<div class="chat-input">' +
        '<button class="eph" type="button" id="btn-ephemeral" title="' + t('messages.ephemeral') + '">👁</button>' +
        '<input id="chat-text" type="text" placeholder="' + t('messages.typing') + '">' +
        '<button class="send" type="button" id="btn-send">' + t('messages.send') + '</button>' +
      '</div>';

    const body = $('#chat-body');
    m.messages.forEach(function (msg) { appendBubble(body, msg); });
    body.scrollTop = body.scrollHeight;

    $('#chat-more').addEventListener('click', function () {
      if (!m.live) { toast(t('messages.blockDemo')); return; }
      const reason = prompt(t('messages.blockPrompt'));
      apiFetch('/api/report/' + m.id, { method: 'POST', body: JSON.stringify({ reason: reason || '—' }) });
      if (confirm(t('messages.blockConfirm', { name: m.name }))) {
        apiFetch('/api/block/' + m.id, { method: 'POST', body: '{}' });
        toast(t('messages.blocked'));
      } else {
        toast(t('messages.reported'));
      }
    });
    $('#btn-send').addEventListener('click', sendCurrent);
    $('#chat-text').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') sendCurrent();
    });
    $('#btn-ephemeral').addEventListener('click', function () {
      if (m.live) {
        apiFetch('/api/conversations/' + m.id + '/photo-ephemeral', { method: 'POST', body: '{}' });
      }
      m.messages.push({ from: 'me', ephemeral: true, text: t('messages.ephemeralLabel'), t: t('messages.now') });
      renderMessages(); renderChatPanel(m);
      toast(t('messages.ephemeralSent'));
    });

    function sendCurrent() {
      const input = $('#chat-text');
      const text = input.value.trim();
      if (!text) return;
      if (m.live) {
        apiFetch('/api/conversations/' + m.id + '/messages', { method: 'POST', body: JSON.stringify({ text: text }) })
          .then(function (r) {
            if (r && r.ok) {
              m.messages.push({ from: 'me', text: text, t: t('messages.now') });
              renderMessages(); renderChatPanel(m);
            } else {
              toast((r && r.data.message) || t('messages.cantSend'));
            }
          });
      } else {
        m.messages.push({ from: 'me', text: text, t: t('messages.now') });
        renderMessages(); renderChatPanel(m);
      }
      input.value = '';
    }
  }

  function appendBubble(body, msg) {
    const div = document.createElement('div');
    if (msg.from === 'day') { div.className = 'day-divider'; div.textContent = msg.text; body.appendChild(div); return; }
    div.className = 'bubble ' + (msg.ephemeral ? 'ephemeral' : msg.from === 'me' ? 'me' : 'them');
    div.innerHTML = msg.text + '<span class="t">' + msg.t + '</span>';
    body.appendChild(div);
  }

  // ============================================================
  // SEARCH (text-first, Wasla_19)
  // ============================================================
  const searchPool = [
    { name: 'نور', city: 'القاهرة', edu: 'بكالوريوس', job: 'هندسة', religiosity: 'ملتزم', lifestyle: 'هادئ', nationality: 'مصري', height: 165, chips: ['نفس المدينة', 'توافق تعليمي'], emoji: '🌷' },
    { name: 'آية', city: 'الإسكندرية', edu: 'ماجستير', job: 'طب', religiosity: 'متوسط', lifestyle: 'منتظم', nationality: 'مصري', height: 170, chips: ['تعليم مرتفع'], emoji: '🌼' },
    { name: 'ريم', city: 'الجيزة', edu: 'بكالوريوس', job: 'تقنية', religiosity: 'مرن', lifestyle: 'اجتماعي', nationality: 'مصري', height: 162, chips: ['نفس نمط الحياة'], emoji: '🕊️' },
    { name: 'لمى', city: 'القاهرة', edu: 'دكتوراه', job: 'تعليم', religiosity: 'ملتزم', lifestyle: 'هادئ', nationality: 'مصري', height: 168, chips: ['توافق قيم'], emoji: '🌙' },
    { name: 'جنى', city: 'الإسكندرية', edu: 'بكالوريوس', job: 'محاسبة', religiosity: 'متوسط', lifestyle: 'منتظم', nationality: 'مصري', height: 164, chips: ['مدينة واحدة'], emoji: '🌻' }
  ];

  let searchTimer = null;

  function renderSearch() {
    const q = ($('#search-q').value || '').trim();
    const city = $('#search-city').value;
    const edu = $('#search-edu').value;
    const prof = $('#search-prof').value;
    const rel = $('#search-rel').value;
    const life = $('#search-life').value;
    const nationality = $('#search-nationality').value;
    const ageMin = $('#search-age-min').value;
    const ageMax = $('#search-age-max').value;
    const heightMin = $('#search-height-min').value;
    const heightMax = $('#search-height-max').value;
    if (token) {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { liveSearch({ q: q, city: city, edu: edu, prof: prof, rel: rel, life: life, nationality: nationality, ageMin: ageMin, ageMax: ageMax, heightMin: heightMin, heightMax: heightMax }); }, 300);
      return;
    }
    const results = searchPool.filter(function (r) {
      const hay = (r.name + ' ' + r.city + ' ' + r.job + ' ' + r.religiosity + ' ' + r.lifestyle + ' ' + r.nationality).toLowerCase();
      const okQ = !q || hay.indexOf(q.toLowerCase()) !== -1;
      const okCity = !city || r.city === city;
      const okEdu = !edu || r.edu === edu;
      const okProf = !prof || r.job === prof;
      const okRel = !rel || r.religiosity === rel;
      const okLife = !life || r.lifestyle === life;
      const okNat = !nationality || r.nationality === nationality;
      const okHeight = (!heightMin || r.height >= Number(heightMin)) && (!heightMax || r.height <= Number(heightMax));
      return okQ && okCity && okEdu && okProf && okRel && okLife && okNat && okHeight;
    });
    $('#search-count').textContent = toLocalizedDigits(results.length) + ' ' + t('search.results');
    const box = $('#search-results');
    if (results.length === 0) {
      box.innerHTML = '<div class="card result-row"><p style="opacity:.7;margin:0">' + t('search.noResults') + '</p></div>';
      return;
    }
    box.innerHTML = results.map(function (r) {
      const chips = r.chips.map(function (c) { return '<span>' + c + '</span>'; }).join('');
      return '<div class="card result-row">' +
        '<span class="av">' + r.emoji + '</span>' +
        '<div class="rc"><b>' + r.name + ' <span class="demo-tag">' + t('search.demoTag') + '</span></b>' +
        '<div class="meta">' + r.city + ' · ' + r.job + ' · ' + t('search.educationLabel') + ' ' + r.edu + '</div>' +
        '<div class="chips">' + chips + '</div></div>' +
      '</div>';
    }).join('');
  }

  function liveSearch(f) {
    const params = [];
    if (f.q) params.push('q=' + encodeURIComponent(f.q));
    if (f.city) params.push('city=' + encodeURIComponent(f.city));
    if (f.edu) params.push('education=' + encodeURIComponent(f.edu));
    if (f.prof) params.push('profession=' + encodeURIComponent(f.prof));
    if (f.rel) params.push('religiosity=' + encodeURIComponent(f.rel));
    if (f.life) params.push('lifestyle=' + encodeURIComponent(f.life));
    if (f.nationality) params.push('nationality=' + encodeURIComponent(f.nationality));
    if (f.ageMin) params.push('ageMin=' + f.ageMin);
    if (f.ageMax) params.push('ageMax=' + f.ageMax);
    if (f.heightMin) params.push('heightMin=' + f.heightMin);
    if (f.heightMax) params.push('heightMax=' + f.heightMax);
    const box = $('#search-results');
    box.innerHTML = '<div class="card result-row"><p style="opacity:.7;margin:0">' + t('search.loading') + '</p></div>';
    apiFetch('/api/search?' + params.join('&')).then(function (r) {
      if (!r || !r.ok) { box.innerHTML = '<div class="card result-row"><p style="opacity:.7;margin:0">' + t('search.error') + '</p></div>'; return; }
      const items = r.data.items || [];
      $('#search-count').textContent = toLocalizedDigits(items.length) + ' ' + t('search.results');
      if (items.length === 0) {
        box.innerHTML = '<div class="card result-row"><p style="opacity:.7;margin:0">' + t('search.noResults') + '</p></div>';
        return;
      }
      box.innerHTML = items.map(function (it) {
        const chips = [];
        if (it.religiosity) chips.push(it.religiosity);
        if (it.lifestyle) chips.push(it.lifestyle);
        if (it.nationality) chips.push(it.nationality);
        if (it.isVerified) chips.push(t('discovery.verified') + ' ✓');
        chips.push('L' + (it.trustLevel || 1));
        const chipsHtml = chips.map(function (c) { return '<span>' + c + '</span>'; }).join('');
        const meta = (it.age ? it.age + ' ' + t('search.years') + ' · ' : '') +
          (it.city || t('common.none')) + ' · ' + (it.profession || t('common.none')) + ' · ' + t('search.educationLabel') + ' ' + (it.education || t('common.none')) +
          (it.nationality ? ' · ' + t('search.nationalityLabel') + ' ' + it.nationality : '') +
          (it.height ? ' · ' + t('search.heightLabel') + ' ' + it.height : '');
        return '<div class="card result-row" data-id="' + it.userId + '" role="button" title="' + t('discovery.view') + '">' +
          '<span class="av">' + (it.gender === 'female' ? '🌷' : '🌿') + '</span>' +
          '<div class="rc"><b>' + it.name + ' <span class="demo-tag">' + t('search.registered') + '</span></b>' +
          '<div class="meta">' + meta + '</div>' +
          '<div class="chips">' + chipsHtml + '</div></div>' +
        '</div>';
      }).join('');
      $$('#search-results .result-row').forEach(function (row) {
        row.addEventListener('click', function () { openProfile(row.dataset.id, 'search'); });
      });
    });
  }

  $('#btn-search').addEventListener('click', renderSearch);
  ['search-q', 'search-city', 'search-edu', 'search-prof', 'search-rel', 'search-life', 'search-nationality', 'search-age-min', 'search-age-max', 'search-height-min', 'search-height-max'].forEach(function (id) {
    $('#' + id).addEventListener('change', renderSearch);
    $('#' + id).addEventListener('input', renderSearch);
  });

  // ============================================================
  // SETTINGS (privacy, Wasla_04/05)
  // ============================================================
  const settings = { photoVis: 0, lastSeen: true, paused: false };

  function renderSettings() {
    if (token) {
      apiFetch('/api/settings').then(function (r) {
        if (!r || !r.ok) return;
        settings.photoVis = r.data.settings.photo_visibility;
        settings.lastSeen = !!r.data.settings.last_seen_on;
        settings.paused = !!r.data.settings.paused;
        applySettingsUI();
      });
      return;
    }
    applySettingsUI();
  }

  function applySettingsUI() {
    $('#set-photo-vis').selectedIndex = settings.photoVis;
    $('#set-lastseen').checked = settings.lastSeen;
    $('#set-pause').checked = settings.paused;
  }

  $('#set-photo-vis').addEventListener('change', function () { settings.photoVis = this.selectedIndex; });
  $('#set-lastseen').addEventListener('change', function () { settings.lastSeen = this.checked; });
  $('#set-pause').addEventListener('change', function () { settings.paused = this.checked; });

  $('#btn-save-settings').addEventListener('click', function () {
    if (token) {
      apiFetch('/api/settings', { method: 'PATCH', body: JSON.stringify({
        photo_visibility: settings.photoVis,
        last_seen_on: settings.lastSeen,
        paused: settings.paused
      }) }).then(function (r) {
        toast((r && r.ok)
          ? (settings.paused ? t('settings.paused') : t('settings.saved'))
          : t('common.error'));
      });
    } else {
      toast(settings.paused ? t('settings.paused') : t('settings.savedLocal'));
    }
    renderDiscovery();
  });

  // — تصدير بياناتي (JSON) — تحكم كامل في بياناتك (Wasla_22)
  $('#btn-export-data').addEventListener('click', function () {
    if (!token) { toast(t('settings.exportLogin')); return; }
    apiFetch('/api/me/data').then(function (r) {
      if (!r || !r.ok) { toast((r && r.data.message) || t('settings.exportFail')); return; }
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'wasla-data-' + r.data.user.id + '.json';
      a.click();
      URL.revokeObjectURL(url);
      toast(t('settings.exported'));
    });
  });

  // — حذف الحساب مع مهلة ٣٠ يومًا للتراجع (Wasla_22)
  $('#btn-delete-account').addEventListener('click', function () {
    if (!token) { toast(t('settings.deleteLogin')); return; }
    if (!confirm(t('settings.deleteConfirm'))) return;
    apiFetch('/api/me/account', { method: 'DELETE', body: '{}' }).then(function (r) {
      if (!r || !r.ok) { toast((r && r.data.message) || t('settings.deleteFail')); return; }
      toast(t('settings.deleted', { date: r.data.restoreBy }));
      logout();
    });
  });

  // ============================================================
  // PROFILE VIEW (modal, Wasla_05/21)
  // ============================================================
  const profileModal = $('#profile-modal');

  function openProfile(userId, fromView) {
    apiFetch('/api/users/' + userId + '/profile').then(function (r) {
      if (!r || !r.ok) { toast((r && r.data.message) || t('profile.openFail')); return; }
      renderProfileModal(r.data, fromView);
    });
  }

  function pmRow(label, value) {
    if (value === undefined || value === null || value === '') return '';
    return '<div class="pm-row"><b>' + label + '</b><span>' + value + '</span></div>';
  }

  function renderProfileModal(d, fromView) {
    const p = d.profile;
    const body = $('#profile-modal-body');
    let rows = '';
    rows += pmRow(t('profile.age'), p.age ? toLocalizedDigits(p.age) + ' ' + t('profile.years') : '');
    rows += pmRow(t('profile.city'), p.city);
    rows += pmRow(t('profile.nationality'), p.nationality);
    rows += pmRow(t('profile.height'), p.height ? toLocalizedDigits(p.height) + ' ' + t('profile.cm') : '');
    rows += pmRow(t('profile.profession'), p.profession);
    rows += pmRow(t('profile.education'), p.education);
    rows += pmRow(t('profile.religiosity'), p.religiosity);
    rows += pmRow(t('profile.lifestyle'), p.lifestyle);
    rows += pmRow(t('profile.completion'), toLocalizedDigits(p.completion) + t('profile.completionPercent'));
    const lv = levelOf(p);
    rows += pmRow(t('profile.trustLevel'), 'L' + lv + ' — ' + trustTitle(lv));

    const liked = d.viewerLiked;
    const showLike = fromView === 'discovery' && !liked && !d.viewerPassed;
    const likeHtml = showLike
      ? '<button class="btn btn-gold btn-block" id="pm-like" type="button">' + t('profile.like') + '</button>'
      : (liked ? '<button class="btn btn-outline btn-block" type="button" disabled>' + t('profile.liked') + '</button>' : '');

    body.innerHTML =
      '<div class="pm-head">' +
        '<span class="pm-av">' + (p.gender === 'female' ? '🌷' : '🌿') + '</span>' +
        '<div><h3>' + p.name + ' ' + levelBadge(p) + '</h3>' +
        '<div class="pm-sub">' + (p.city || '') + ' · ' + (p.profession || '') + '</div></div>' +
        '<button class="pm-close" id="pm-close" type="button" aria-label="' + t('profile.close') + '">✕</button>' +
      '</div>' +
      '<div class="pm-body">' + (rows || '<p style="opacity:.7;margin:0">' + t('profile.empty') + '</p>') + '</div>' +
      '<div class="pm-actions">' +
        likeHtml +
        '<button class="btn btn-outline btn-block" id="pm-fav" type="button">' + (d.isFavorite ? t('profile.favoriteRemove') : t('profile.favoriteAdd')) + '</button>' +
      '</div>';

    profileModal.hidden = false;

    $('#pm-close').addEventListener('click', closeProfileModal);
    profileModal.addEventListener('click', function (e) { if (e.target === profileModal) closeProfileModal(); });

    $('#pm-fav').addEventListener('click', function () {
      if (d.isFavorite) {
        apiFetch('/api/favorites/' + p.userId, { method: 'DELETE' });
        d.isFavorite = false;
      } else {
        apiFetch('/api/favorites/' + p.userId, { method: 'POST', body: '{}' });
        d.isFavorite = true;
      }
      this.textContent = d.isFavorite ? t('profile.favoriteRemove') : t('profile.favoriteAdd');
      toast(d.isFavorite ? t('profile.favoriteAdded') : t('profile.favoriteRemoved'));
    });

    const likeBtn = $('#pm-like');
    if (likeBtn) likeBtn.addEventListener('click', function () {
      closeProfileModal();
      decide(p.userId, 'like');
    });
  }

  function closeProfileModal() { profileModal.hidden = true; }

  // ============================================================
  // Boot
  // ============================================================
  initDeck();
  renderDiscovery();
  renderMatches();
  renderMessages();
})();
