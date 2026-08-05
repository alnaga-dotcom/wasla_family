(function () {
  let API_BASE = 'https://wasla-family.onrender.com';
  let APP_URL = 'https://app.wasla.family';

  async function loadConfig() {
    try {
      const res = await fetch('/config.json?v=8');
      if (res.ok) {
        const cfg = await res.json();
        if (cfg.apiBase) API_BASE = cfg.apiBase;
        if (cfg.appUrl) APP_URL = cfg.appUrl;
      }
    } catch (e) { /* fall back to defaults */ }
    document.querySelectorAll('a.data-app-link').forEach((a) => { a.href = APP_URL; });
  }

  const navToggle = document.querySelector('.nav-toggle');
  const mainNav = document.querySelector('.main-nav');
  navToggle?.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
  document.querySelectorAll('.main-nav a').forEach((link) => {
    link.addEventListener('click', () => {
      mainNav.classList.remove('open');
      navToggle?.setAttribute('aria-expanded', 'false');
    });
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

  const CATEGORY_NAMES = { story: 'قصص', announcement: 'إعلانات', thread: 'مواضيع ونقاشات' };

  function toArabicDate(value) {
    if (!value) return '';
    try {
      return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'long' }).format(new Date(value));
    } catch (e) {
      return value;
    }
  }

  function renderPosts(posts, listEl) {
    if (!listEl) return;
    if (!posts.length) {
      listEl.innerHTML = '<div class="blog-empty">لا توجد مقالات بعد — تابعونا قريبًا.</div>';
      return;
    }
    listEl.innerHTML = posts.map((post) => `
      <a class="blog-card reveal" href="blog.html?post=${encodeURIComponent(post.slug)}">
        <span class="cat">${CATEGORY_NAMES[post.category] || post.category}</span>
        <h3>${escapeHtml(post.title)}</h3>
        <p>${escapeHtml(post.excerpt || '')}</p>
        <span class="meta">${escapeHtml(post.author || 'فريق وصلــه')} · ${toArabicDate(post.publishedAt)}</span>
      </a>
    `).join('');
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
  }

  function renderArticle(post) {
    const view = document.getElementById('post-view');
    if (!view) return;
    document.getElementById('blog-list')?.classList.add('hidden');
    document.getElementById('blog-filters')?.classList.add('hidden');
    view.classList.remove('hidden');
    view.innerHTML = `
      <a class="back-link" href="blog.html">← العودة إلى المدونة</a>
      <span class="cat">${CATEGORY_NAMES[post.category] || post.category}</span>
      <h1>${escapeHtml(post.title)}</h1>
      <div class="post-meta">
        <span>${escapeHtml(post.author || 'فريق وصلــه')}</span>
        <span>${toArabicDate(post.publishedAt)}</span>
      </div>
      ${post.coverUrl ? `<img class="post-cover" src="${escapeAttr(post.coverUrl)}" alt="" loading="lazy">` : ''}
      <div class="post-body">${renderBody(post.body)}</div>
    `;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderBody(text) {
    return String(text || '').split(/\n\s*\n/).map((para) => `<p>${escapeHtml(para.trim())}</p>`).join('');
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  function escapeAttr(value) {
    return String(value || '').replace(/"/g, '&quot;');
  }

  async function initBlog() {
    const listEl = document.getElementById('blog-list');
    const filters = document.getElementById('blog-filters');
    if (!listEl) return;
    let allPosts = [];
    try {
      const res = await fetch(API_BASE + '/api/public/posts');
      allPosts = res.ok ? (await res.json()).posts || [] : [];
    } catch (e) { /* offline fallback */ }

    const params = new URLSearchParams(window.location.search);
    const slug = params.get('post');
    if (slug) {
      const match = allPosts.find((p) => p.slug === slug);
      if (match) { renderArticle(match); return; }
      try {
        const res = await fetch(API_BASE + '/api/public/posts/' + encodeURIComponent(slug));
        if (res.ok) { const { post } = await res.json(); if (post) { renderArticle(post); return; } }
      } catch (e) { /* fall through */ }
      document.getElementById('post-view')?.classList.remove('hidden');
      document.getElementById('post-view').innerHTML = '<a class="back-link" href="blog.html">← العودة إلى المدونة</a><div class="blog-empty">المقال غير موجود.</div>';
      return;
    }

    filters?.addEventListener('click', (event) => {
      const btn = event.target.closest('button');
      if (!btn) return;
      filters.querySelectorAll('button').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const cat = btn.dataset.cat;
      renderPosts(cat && cat !== 'all' ? allPosts.filter((p) => p.category === cat) : allPosts, listEl);
    });

    renderPosts(allPosts, listEl);
  }

  async function initFeedback() {
    const form = document.getElementById('feedback-form');
    if (!form) return;
    const msgBox = document.getElementById('form-msg');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      msgBox.classList.remove('show', 'ok', 'err');
      const data = {
        name: form.name.value,
        contact: form.contact.value,
        category: form.category.value,
        message: form.message.value,
      };
      const button = form.querySelector('button[type="submit"]');
      const original = button.textContent;
      button.disabled = true;
      button.textContent = 'جارٍ الإرسال…';
      try {
        const res = await fetch(API_BASE + '/api/public/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          msgBox.textContent = 'تم استلام رسالتك بنجاح — شكرًا لمساهمتك، وسنوافيك بالرد قريبًا.';
          msgBox.classList.add('show', 'ok');
          form.reset();
        } else {
          const err = await res.json().catch(() => ({}));
          msgBox.textContent = err.message || 'حدث خطأ أثناء الإرسال، جرّب مرة أخرى.';
          msgBox.classList.add('show', 'err');
        }
      } catch (e) {
        msgBox.textContent = 'تعذر الاتصال بالخادم الآن، جرّب لاحقًا.';
        msgBox.classList.add('show', 'err');
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    initBlog();
    initFeedback();
  });
})();
