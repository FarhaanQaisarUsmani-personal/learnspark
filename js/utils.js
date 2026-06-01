// js/utils.js
// Shared helpers used across all pages

// ── Toast notification ──
function toast(msg, duration = 3000) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', duration);
}

// ── Loading overlay ──
function showLoading(msg = 'Loading…') {
  const el = document.getElementById('loading');
  if (el) {
    el.querySelector('.loading-text').textContent = msg;
    el.style.display = 'flex';
  }
}
function hideLoading() {
  const el = document.getElementById('loading');
  if (el) el.style.display = 'none';
}

// ── Build sidebar based on user role ──
function buildSidebar(user, activePage) {
  const sb = document.getElementById('sidebar');
  if (!sb || !user) return;

  const item = (page, icon, label, isActive) => `
    <div class="sb-item ${isActive ? 'active' : ''}" data-page="${page}">
      <span class="sb-icon">${icon}</span>
      <span>${label}</span>
    </div>`;

  const subjectItem = (slug, icon, label) => `
    <div class="sb-item ${activePage === 'subject' && getParam('subj') === slug ? 'active' : ''}" data-subj="${slug}">
      <span class="sb-icon">${icon}</span>
      <span>${label}</span>
    </div>`;

  let nav = '';

  if (user.role === 'student') {
    nav += item('dashboard', '🏠', 'Dashboard', activePage === 'dashboard');
    nav += '<div class="sb-section">Subjects</div>';
    nav += subjectItem('math', '🔢', 'Mathematics');
    nav += subjectItem('sci', '🔬', 'Science');
    nav += subjectItem('eng', '📖', 'English');
    nav += '<div class="sb-section">My Learning</div>';
    nav += item('progress', '📊', 'My Progress', activePage === 'progress');
    nav += item('achievements', '🏆', 'Achievements', activePage === 'achievements');
  }

  if (user.role === 'teacher') {
    nav += item('dashboard', '🏠', 'Dashboard', activePage === 'dashboard');
    nav += '<div class="sb-section">Manage</div>';
    nav += item('teacher', '📚', 'Content', activePage === 'teacher');
    nav += item('students-view', '👥', 'Students', activePage === 'students-view');
  }

  if (user.role === 'admin') {
    nav += item('dashboard', '🏠', 'Dashboard', activePage === 'dashboard');
    nav += item('admin', '🛡️', 'User Roles', activePage === 'admin');
  }

  sb.innerHTML = `
    <div class="sb-logo">
      <div class="sb-spark">✦</div>
      <div class="sb-name">LearnSpark<small>Grade 6 Portal</small></div>
    </div>
    <div class="sb-role-badge">${user.role}</div>
    ${nav}
    <div class="sb-divider"></div>
    <div class="sb-user">
      <div class="sb-avatar">${user.display_name ? user.display_name[0].toUpperCase() : '?'}</div>
      <div>
        <div class="sb-username">${user.username}</div>
        <div class="sb-userrole">${user.role}</div>
      </div>
    </div>
  `;

  // Bind sidebar navigation
  sb.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', () => {
      const pageMap = {
        dashboard: 'dashboard.html',
        progress: 'progress.html',
        achievements: 'achievements.html',
        teacher: 'teacher.html',
        'students-view': 'students.html',
        admin: 'admin.html',
      };
      const dest = pageMap[el.dataset.page];
      if (dest) window.location.href = dest;
    });
  });

  sb.querySelectorAll('[data-subj]').forEach(el => {
    el.addEventListener('click', () => {
      window.location.href = `subject.html?subj=${el.dataset.subj}`;
    });
  });
}

// ── Build topbar ──
function buildTopbar(title) {
  const tb = document.getElementById('topbar');
  if (!tb) return;
  tb.innerHTML = `
    <h1>${title}</h1>
    <div class="topbar-right">
      <span style="font-size:12px;color:var(--tx3)">📅 Summer 2025</span>
      <button class="btn btn-outline btn-sm" id="logout-btn">Sign Out</button>
    </div>
  `;
  tb.querySelector('#logout-btn').addEventListener('click', logout);
}

// ── URL helpers ──
function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

// ── Subject display helpers ──
const SUBJECT_META = {
  math: { name: 'Mathematics', icon: '🔢', color: 'math', bgVar: '--math-bg', colorVar: '--math' },
  sci:  { name: 'Science',     icon: '🔬', color: 'sci',  bgVar: '--sci-bg',  colorVar: '--sci'  },
  eng:  { name: 'English',     icon: '📖', color: 'eng',  bgVar: '--eng-bg',  colorVar: '--eng'  },
};

const BADGE_DEFS = [
  { id: 'first_quiz',    name: 'Quiz Taker',       icon: '🎯', desc: 'Complete your first quiz' },
  { id: 'week_warrior',  name: 'Week Warrior',      icon: '🏆', desc: 'Score 60%+ on any quiz' },
  { id: 'math_star',     name: 'Math Star',         icon: '⭐', desc: 'Score 80%+ in Mathematics' },
  { id: 'sci_explorer',  name: 'Science Explorer',  icon: '🔬', desc: 'Complete all Science lessons' },
  { id: 'bookworm',      name: 'Bookworm',          icon: '📚', desc: 'Complete all English lessons' },
  { id: 'perfect_score', name: 'Perfect Score',     icon: '💯', desc: 'Get 100% on any quiz' },
  { id: 'diligent',      name: 'Diligent Learner',  icon: '🌟', desc: 'Log in 5 days in a row' },
];

// ── Progress bar helper ──
function renderProgBar(label, pct, colorClass) {
  return `
    <div class="prog-wrap">
      <div class="prog-labels"><span>${label}</span><span>${pct}%</span></div>
      <div class="prog-bar"><div class="prog-fill ${colorClass}" style="width:${pct}%"></div></div>
    </div>`;
}

// ── Tag helper ──
function subjTag(slug) {
  const m = { math: 'tag-math', sci: 'tag-sci', eng: 'tag-eng' };
  const n = { math: 'Math', sci: 'Science', eng: 'English' };
  return `<span class="tag ${m[slug] || ''}">${n[slug] || slug}</span>`;
}

// ── Shared page skeleton ──
function pageSkeleton() {
  return `
    <div id="toast"></div>
    <div id="loading">
      <div class="spinner"></div>
      <div class="loading-text">Loading…</div>
    </div>
  `;
}
