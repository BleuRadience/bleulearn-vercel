/* BleuLearn Sovereign Curriculum — Core JavaScript */
/* AvaBleu House HQ | 2026 */
/* VeriAbyss-grade: all fact, no hallucination */
/*
 * ARCHITECTURE NOTE (added when the server-side database layer was built):
 * This file has TWO separate point systems that intentionally do NOT merge
 * into each other, and a developer extending this should not "fix" that by
 * combining them without thinking it through first:
 *
 *   1. LOCAL COSMETIC POINTS (addPoints, below) -- instant-feedback browser-only
 *      gamification (streaks, click animations, badge unlocks). Stored in
 *      localStorage. Never touches the server. Works with zero setup, even
 *      with no database connected at all -- this is intentional so the
 *      front end degrades gracefully rather than breaking.
 *
 *   2. SERVER-SIDE OFFICIAL POINTS (awardPointsServer / fetchMyPoints,
 *      further down) -- the real, transcript-adjacent record in the
 *      points_ledger table (see lib/schema.sql). Awarding requires a
 *      logged-in teacher or admin and is enforced server-side in
 *      /api/points.js -- a scholar can never award points to themselves
 *      through this path, by design, matching the documented House System
 *      rule that points are earned through teacher-witnessed achievement.
 *
 * If a future developer wants the on-screen "⭐ 0" badge to show the real
 * server total instead of the local cosmetic count for logged-in scholars,
 * call fetchMyPoints() on page load and use ITS result for the display,
 * rather than rewiring addPoints() itself.
 */

const BleuLearn = (() => {
  'use strict';

  // ─── Storage ───────────────────────────────────────────────────
  const STORAGE_KEY = 'bleulearn_v2';

  function getState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
        points: 0, streak: 0, lastVisit: null,
        completed: {}, badges: [], grade: null, name: ''
      };
    } catch { return { points: 0, streak: 0, lastVisit: null, completed: {}, badges: [], grade: null, name: '' }; }
  }

  function saveState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  // ─── Points ────────────────────────────────────────────────────
  function addPoints(amount, reason = '') {
    const state = getState();
    state.points += amount;
    saveState(state);
    updatePointsDisplays();
    if (amount > 0) showNotification(`+${amount} ⭐  ${reason}`, 'success');
    return state.points;
  }

  function getPoints() { return getState().points; }

  function getCompletedCount(subject) {
    const state = getState();
    return Object.keys(state.completed).filter(k => k.startsWith(subject + '_')).length;
  }

  function markComplete(subject, lessonId) {
    const state = getState();
    state.completed[`${subject}_${lessonId}`] = Date.now();
    saveState(state);
  }

  function updatePointsDisplays() {
    const pts = getPoints();
    document.querySelectorAll('.points-display').forEach(el => { el.textContent = `⭐ ${pts.toLocaleString()}`; });
  }

  // ─── Notifications ──────────────────────────────────────────────
  function showNotification(message, type = 'info') {
    let note = document.getElementById('bl-notification');
    if (!note) {
      note = document.createElement('div');
      note.id = 'bl-notification';
      note.className = 'notification';
      document.body.appendChild(note);
    }
    note.textContent = message;
    note.className = `notification ${type}`;
    setTimeout(() => note.classList.add('show'), 10);
    setTimeout(() => { note.classList.remove('show'); }, 3400);
  }

  // ─── AI Chat ────────────────────────────────────────────────────
  const AI_TUTORS = {
    'Prof. Polyglot':  { subject: 'Mathematics', greeting: 'I am Prof. Polyglot. I teach Singapore Math. Bar models, CPA approach, 5,200 lessons. What shall we solve?' },
    'Dr. Soul':        { subject: 'Science', greeting: 'I am Dr. Soul. I teach science through inquiry and documented evidence. What phenomenon do you want to explore?' },
    'Ms. Scriptura':   { subject: 'BleuHistory', greeting: 'I am Ms. Scriptura. I teach documented history using primary sources. Who? When? What? Why does it matter?' },
    'Ms. PolyNova':    { subject: 'Language Arts', greeting: 'I am Ms. PolyNova. I teach reading, writing, oral tradition, and media literacy. What shall we read or write?' },
    'Ms. Wealth':      { subject: 'Financial Architecture', greeting: 'I am Ms. Wealth. I teach financial literacy, the racial wealth gap, and generational wealth. What is your financial question?' },
    'Mr. Debate':      { subject: 'Computer Science', greeting: 'I am Mr. Debate. I teach coding, AI literacy, and digital citizenship. What shall we build?' },
    'Ms. Astoria':     { subject: 'Geography', greeting: 'I am Ms. Astoria. I teach world geography, Indigenous territories, and climate systems. Where shall we explore?' },
    'Judge Logic':     { subject: 'Civics', greeting: 'I am Judge Logic. I teach government, voting rights, and civic action. What is your civic question?' },
    'Coach Move':      { subject: 'Health & Wellness', greeting: 'I am Coach Move. I teach mental health, nutrition, movement, and healthy relationships. How can I help?' },
    'Elder Speaks':    { subject: 'Indigenous Peoples Studies', greeting: 'I am Elder Speaks. I teach the documented histories of the Indigenous nations of the Americas and their contemporary sovereignty. What would you like to learn?' },
    'Dr. Afrika':      { subject: 'Black World Studies', greeting: 'I am Dr. Afrika. I teach the documented global history of Black people from Africa to the Americas to the present. Where shall we begin?' },
    'Prof. Merchant':  { subject: 'Cooperative Economics', greeting: 'I am Prof. Merchant. I teach cooperative business, community economics, and the documented path to generational wealth. What is your question?' },
  };

  function chatWithAI(tutorName, subject) {
    let panel = document.getElementById('bl-ai-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'bl-ai-panel';
      panel.className = 'ai-panel';
      panel.innerHTML = `
        <div class="ai-panel-header">
          <span id="bl-ai-name">AI Tutor</span>
          <button onclick="document.getElementById('bl-ai-panel').classList.remove('open')"
            style="background:none;border:none;color:white;font-size:20px;cursor:pointer">✕</button>
        </div>
        <div class="ai-panel-messages" id="bl-ai-messages"></div>
        <div class="ai-panel-input">
          <input type="text" id="bl-ai-input" placeholder="Ask a question..." 
            onkeydown="if(event.key==='Enter')BleuLearn.sendAIMessage()">
          <button class="btn-primary" onclick="BleuLearn.sendAIMessage()">Send</button>
        </div>`;
      document.body.appendChild(panel);
    }
    const tutor = AI_TUTORS[tutorName] || { greeting: `I am your ${subject} tutor. How can I help?` };
    document.getElementById('bl-ai-name').textContent = tutorName;
    document.getElementById('bl-ai-messages').innerHTML = '';
    panel.classList.add('open');
    addAIMessage(tutor.greeting, 'bot');
    panel._tutor = tutorName;
  }

  function addAIMessage(text, sender) {
    const msgs = document.getElementById('bl-ai-messages');
    if (!msgs) return;
    const div = document.createElement('div');
    div.className = `ai-message ${sender}`;
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function sendAIMessage() {
    const input = document.getElementById('bl-ai-input');
    if (!input || !input.value.trim()) return;
    const msg = input.value.trim();
    input.value = '';
    addAIMessage(msg, 'user');
    // Documented responses - no hallucination (VeriAbyss standard)
    setTimeout(() => {
      addAIMessage('That is a documented question. The BleuLearn curriculum addresses this through primary source evidence. Ask your teacher to open the relevant chapter, or access the archive listed in your Archive Guide.', 'bot');
    }, 600);
  }

  // ─── Navigation ─────────────────────────────────────────────────
  const SUBJECT_MAP = {
    math: '/math/', science: '/science/', history: '/history/',
    english: '/language-arts/', finance: '/finance/', compsci: '/compsci/',
    geography: '/geography/', civics: '/civics/', health: '/health/',
    indigenous: '/indigenous/', blackworld: '/black-world/', arabic: '/arabic/',
    french: '/french/', swahili: '/swahili/', yoruba: '/yoruba/', spanish: '/spanish/',
    economics: '/cooperative-economics/', rhetoric: '/rhetoric/',
    sourcelit: '/source-literacy/', performing: '/performing-arts/',
    visual: '/visual-arts/', physical: '/physical-ed/', civic: '/civic-leadership/',
    wellness: '/wellness/', bleuhistory: '/bleuhistory/', finarch: '/financial-architecture/'
  };

  function goTo(path) { window.location.href = path; }
  function goSubject(id) { goTo(SUBJECT_MAP[id] || '/'); }

  // ─── Streak / Daily ─────────────────────────────────────────────
  function checkStreak() {
    const state = getState();
    const today = new Date().toDateString();
    if (state.lastVisit !== today) {
      if (state.lastVisit === new Date(Date.now() - 86400000).toDateString()) {
        state.streak = (state.streak || 0) + 1;
        if (state.streak > 0 && state.streak % 7 === 0) {
          addPoints(100, `🔥 ${state.streak}-day streak bonus!`);
        }
      } else if (state.lastVisit && state.lastVisit !== today) {
        state.streak = 1;
      } else {
        state.streak = 1;
      }
      state.lastVisit = today;
      saveState(state);
    }
    return state.streak;
  }

  // ─── Init ────────────────────────────────────────────────────────
  function init() {
    updatePointsDisplays();
    checkStreak();
    // Keyboard shortcut: Alt+P = points display
    document.addEventListener('keydown', e => {
      if (e.altKey && e.key === 'p') showNotification(`Total: ⭐ ${getPoints().toLocaleString()}`, 'info');
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  // ─── Public API ──────────────────────────────────────────────────
  // ─── Server-Backed Auth and Official Records ──────────────────
  // These hit the real API built in /api/*.js. Every one of them fails
  // gracefully (returns null / false, never throws uncaught) if no one is
  // logged in or no database is connected yet -- callers should check the
  // return value, not assume success.

  let _cachedUser = undefined; // undefined = not checked yet this page load; null = checked, logged out

  async function getCurrentUser() {
    if (_cachedUser !== undefined) return _cachedUser;
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      _cachedUser = data.user || null;
    } catch {
      _cachedUser = null;
    }
    return _cachedUser;
  }

  async function loginUser(email, password) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error };
      _cachedUser = data.user;
      return { ok: true, user: data.user };
    } catch (err) {
      return { ok: false, error: 'Network error: ' + err.message };
    }
  }

  async function logoutUser() {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
    _cachedUser = null;
  }

  // Real, server-recorded points. Only succeeds for a logged-in teacher/admin
  // awarding to a scholar -- see /api/points.js for the enforced rule.
  async function awardPointsServer(scholarId, points, reason, strand) {
    try {
      const res = await fetch('/api/points', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scholar_id: scholarId, points, reason, strand })
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error };
      return { ok: true, awarded: data.awarded };
    } catch (err) {
      return { ok: false, error: 'Network error: ' + err.message };
    }
  }

  // Fetches a scholar's REAL point total and ledger from the server.
  // Returns null if not logged in or the database isn't connected --
  // callers should fall back to getPoints() (the local cosmetic count) in that case.
  async function fetchMyPoints() {
    try {
      const res = await fetch('/api/points');
      if (!res.ok) return null;
      return await res.json(); // { total, ledger }
    } catch {
      return null;
    }
  }

  // ─── Output Escaping (XSS prevention) ─────────────────────────
  // SECURITY: every page that builds innerHTML from API data (course
  // titles, full names, feedback text, forum posts, etc.) must pass that
  // data through escapeHtml() first. Before this was added, course/
  // and gradebook/ built innerHTML directly from template literals with
  // unescaped API data -- a course title or feedback string containing
  // <script> or an onerror handler would execute in the browser of
  // whoever viewed that page, including a teacher or admin. This is the
  // same vulnerability class as the real Moodle CVE-2025-26529 admin
  // account takeover (stored XSS rendered unescaped in a privileged
  // view). See SECURITY_AUDIT.md.
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return {
    addPoints, getPoints, getCompletedCount, markComplete, escapeHtml,
    getCurrentUser, loginUser, logoutUser, awardPointsServer, fetchMyPoints,
    showNotification, chatWithAI, sendAIMessage, addAIMessage,
    goTo, goSubject, checkStreak, getState, saveState,
    AI_TUTORS
  };
})();
