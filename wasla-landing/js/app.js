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
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

const sections = [...document.querySelectorAll('main section[id]')];
const navLinks = [...document.querySelectorAll('.main-nav a')];

window.addEventListener('scroll', () => {
  const y = window.scrollY + 140;
  let current = sections[0]?.id;

  sections.forEach((section) => {
    if (section.offsetTop <= y) current = section.id;
  });

  navLinks.forEach((link) => {
    link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
  });
});


document.querySelector('.newsletter')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  const original = button.textContent;
  button.textContent = 'تم الاشتراك';
  setTimeout(() => button.textContent = original, 1800);
});


const faqItems = [...document.querySelectorAll('.faq-item')];
faqItems.forEach((item) => {
  item.addEventListener('toggle', () => {
    if (!item.open) return;
    faqItems.forEach((otherItem) => {
      if (otherItem !== item) otherItem.open = false;
    });
  });
});

const statCounters = [...document.querySelectorAll('.stat-counter')];
const counterDuration = 1800;

function toArabicDigits(value) {
  return String(value).replace(/[0-9]/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[digit]);
}

function animateCounter(counter) {
  const target = Number(counter.dataset.count || 0);
  const suffix = counter.dataset.suffix || '';
  const startedAt = performance.now();

  function tick(now) {
    const progress = Math.min((now - startedAt) / counterDuration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    counter.textContent = toArabicDigits(Math.round(target * eased)) + suffix;

    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    animateCounter(entry.target);
    counterObserver.unobserve(entry.target);
  });
}, { threshold: 0.5 });

statCounters.forEach((counter) => counterObserver.observe(counter));


// Premium scroll progress
const progressBar = document.querySelector('.scroll-progress span');
function updateScrollProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const progress = max > 0 ? (window.scrollY / max) * 100 : 0;
  if (progressBar) progressBar.style.width = `${Math.min(progress, 100)}%`;
}
window.addEventListener('scroll', updateScrollProgress, { passive: true });
updateScrollProgress();

// Matching journey reveal
const journeySection = document.querySelector('.journey-section');
if (journeySection) {
  const journeyObserver = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      journeySection.classList.add('is-active');
      journeyObserver.disconnect();
    }
  }, { threshold: .35 });
  journeyObserver.observe(journeySection);
}

// Interactive suitability checklist
const fitInputs = [...document.querySelectorAll('.fit-checklist input')];
const fitResult = document.querySelector('.fit-result');
function updateFitResult() {
  if (!fitResult) return;
  const selected = fitInputs.filter((input) => input.checked).length;
  const title = fitResult.querySelector('strong');
  const text = fitResult.querySelector('span');
  if (selected >= 3) {
    title.textContent = 'وصلــه صُممت من أجلك';
    text.textContent = 'أنت قريب جدًا من فلسفة وصلــه وتجربتها الجادة.';
  } else if (selected === 2) {
    title.textContent = 'هناك توافق واضح';
    text.textContent = 'استكشف المنصة وتعرّف أكثر على الخصوصية والتوافق.';
  } else {
    title.textContent = 'اختر ما يعبّر عنك';
    text.textContent = 'كل اختيار يساعدك على معرفة مدى مناسبة وصلــه لك.';
  }
}
fitInputs.forEach((input) => input.addEventListener('change', updateFitResult));
updateFitResult();

// Auth modal
const authModal = document.getElementById('authModal');
const authTabs = [...document.querySelectorAll('.auth-tab')];
const authForms = [...document.querySelectorAll('.auth-form')];

function setAuthTab(name) {
  authTabs.forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  authForms.forEach((form) => {
    form.hidden = form.dataset.form !== name;
  });
}

function openAuthModal(name) {
  setAuthTab(name || 'login');
  authModal.hidden = false;
  document.body.style.overflow = 'hidden';
  const firstField = authModal.querySelector(`[data-form="${name || 'login'}"] input`);
  firstField?.focus();
}

function closeAuthModal() {
  authModal.hidden = true;
  document.body.style.overflow = '';
}

document.querySelectorAll('[data-open]').forEach((trigger) => {
  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    openAuthModal(trigger.dataset.open);
  });
});

authTabs.forEach((tab) => {
  tab.addEventListener('click', () => setAuthTab(tab.dataset.tab));
});

authModal.querySelectorAll('[data-close]').forEach((el) => {
  el.addEventListener('click', closeAuthModal);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !authModal.hidden) closeAuthModal();
});

authForms.forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const original = button.textContent;
    button.textContent = form.dataset.form === 'login' ? 'جارٍ تسجيل الدخول…' : 'جارٍ إنشاء الحساب…';
    setTimeout(() => {
      button.textContent = 'تم — سنتواصل معك عند الإطلاق';
      setTimeout(() => {
        button.textContent = original;
        closeAuthModal();
      }, 1600);
    }, 900);
  });
});
