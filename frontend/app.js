// ─────────────────────────────────────────────────────────────
//  EduAI Studio  –  app.js (Ultra Premium Engine v3)
// ─────────────────────────────────────────────────────────────

const API = (window.location.protocol.startsWith('http') && window.location.origin)
  ? `${window.location.origin}/api`
  : 'http://127.0.0.1:5000/api';

// ── Application State ─────────────────────────────────────────
const state = {
  currentView:     'dashboard',
  learningMode:    'comprehensive', // 'comprehensive' | 'summary' | 'stepbystep' | 'quiz'
  historyPage:     1,
  historyFilter:   '',
  historySearch:   '',
  historyTotal:    0,
  historyPages:    1,
  historyLimit:    10,
  bulkItems:       [],
  bulkResults:     [],
  voiceActive:     false,
  recognition:     null,
  speechSynth:     window.speechSynthesis || null,
  currentUtterance:null,
  isSpeaking:      false,
  lastAskQuestion: '',
  lastAskResponse: '',
  activeModel:     'GPT-4o',
};

// ── Lifecycle Initialization ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  initTheme();
  initTextareaCounters();
  initVoice();
  initBulk();
  initShortcuts();
  updateGreeting();
  checkHealth();
  setInterval(checkHealth, 30_000);
  loadDashboard();
});

// ─────────────────────────────────────────────────────────────
//  NAVIGATION & ROUTING
// ─────────────────────────────────────────────────────────────
function navigate(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

  const viewEl = document.getElementById(`view-${view}`);
  const navBtn = document.querySelector(`.nav-item[data-view="${view}"]`);

  if (viewEl) viewEl.classList.add('active');
  if (navBtn) navBtn.classList.add('active');
  state.currentView = view;

  // Update top sticky header breadcrumb
  const headerTitle = document.getElementById('header-current-view');
  if (headerTitle) {
    const titles = {
      dashboard: 'Dashboard Overview',
      ask:       'Ask AI Studio',
      bulk:      'Bulk Coroutine Runner',
      history:   'Learning History Archives',
      prompt:    'Prompt Engineering Studio',
    };
    headerTitle.textContent = titles[view] || view;
  }

  // Close mobile navigation drawer if open
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('open');

  // Stop any active speech readout when switching views
  stopSpeech();

  // Lazy-load view specific resources
  if (view === 'history')   { state.historyPage = 1; loadHistory(); }
  if (view === 'prompt')    { loadPrompt(); }
  if (view === 'dashboard') { loadDashboard(); }
}

function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
  document.getElementById('sidebar-overlay')?.classList.toggle('open');
}

// ─────────────────────────────────────────────────────────────
//  COLOR THEME SYSTEM
// ─────────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('eduai-theme') || 'dark';
  applyTheme(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('eduai-theme', theme);
  const badge = document.getElementById('theme-badge-text');
  if (badge) badge.textContent = theme === 'dark' ? 'Dark' : 'Light';
  initParticles();
}

// ─────────────────────────────────────────────────────────────
//  AMBIENT CANVAS PARTICLES
// ─────────────────────────────────────────────────────────────
function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W = canvas.width  = window.innerWidth;
  let H = canvas.height = window.innerHeight;
  let raf;

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const COLORS = isDark
    ? ['rgba(79,128,255,0.4)', 'rgba(168,85,247,0.35)', 'rgba(6,214,160,0.3)']
    : ['rgba(79,128,255,0.18)', 'rgba(168,85,247,0.15)', 'rgba(6,214,160,0.12)'];

  const COUNT = Math.min(65, Math.floor((W * H) / 16000));
  const particles = Array.from({length: COUNT}, () => ({
    x:  Math.random() * W,
    y:  Math.random() * H,
    r:  Math.random() * 1.8 + 0.5,
    vx: (Math.random() - 0.5) * 0.32,
    vy: (Math.random() - 0.5) * 0.32,
    clr: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));

  if (raf) cancelAnimationFrame(raf);

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.clr;
      ctx.fill();
    }
    // Draw subtle neural network style connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 110) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          const alpha = 0.08 * (1 - dist / 110);
          ctx.strokeStyle = isDark
            ? `rgba(79,128,255,${alpha})`
            : `rgba(79,128,255,${alpha * 0.6})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }
    raf = requestAnimationFrame(draw);
  }
  draw();

  window.addEventListener('resize', () => {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  });
}

// ─────────────────────────────────────────────────────────────
//  TELEMETRY & HEALTH CHECK
// ─────────────────────────────────────────────────────────────
async function checkHealth() {
  const dot    = document.getElementById('status-dot');
  const text   = document.getElementById('status-text');
  const sub    = document.getElementById('status-sub');
  const banner = document.getElementById('offline-banner');

  try {
    const res  = await fetch(`${API}/health`, {signal: AbortSignal.timeout(4000)});
    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      if (dot)  dot.className   = 'status-dot online';
      if (text) text.textContent = 'Systems Online';
      if (sub)  sub.textContent  = data.model || 'OpenAI Active';
      state.activeModel = data.model || state.activeModel;
      banner?.classList.add('hidden');
    } else {
      throw new Error();
    }
  } catch {
    if (dot)  dot.className   = 'status-dot offline';
    if (text) text.textContent = 'System Offline';
    if (sub)  sub.textContent  = 'run.py not reachable';
    banner?.classList.remove('hidden');
  }
}

function updateGreeting() {
  const el = document.getElementById('greeting-title');
  if (!el) return;
  const hour = new Date().getHours();
  let greet = 'Good day';
  if (hour < 12) greet = 'Good morning';
  else if (hour < 18) greet = 'Good afternoon';
  else greet = 'Good evening';
  el.textContent = `${greet}, Scholar. Ready to Learn?`;
}

// ─────────────────────────────────────────────────────────────
//  DASHBOARD CONTROLLER
// ─────────────────────────────────────────────────────────────
async function loadDashboard() {
  await Promise.all([loadStats(), loadRecentHistory()]);
}

async function loadStats() {
  try {
    const res  = await fetch(`${API}/stats`);
    const data = await res.json();
    if (!res.ok) return;

    animateCount('stat-total',  data.total  ?? 0);
    animateCount('stat-today',  data.today  ?? 0);
    animateCount('stat-bulk',   data.bulk   ?? 0);
    animateCount('stat-single', data.single ?? 0);

    const countBadge = document.getElementById('nav-history-count');
    if (countBadge) countBadge.textContent = data.total ?? '0';
  } catch {
    // Offline mode: gracefully maintain static indicators
  }
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  const diff  = target - start;
  const dur   = 650;
  const t0    = performance.now();

  function step(t) {
    const prog = Math.min((t - t0) / dur, 1);
    const ease = 1 - Math.pow(1 - prog, 3);
    el.textContent = Math.round(start + diff * ease);
    if (prog < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

async function loadRecentHistory() {
  const el = document.getElementById('recent-list');
  if (!el) return;
  try {
    const res  = await fetch(`${API}/history?limit=5`);
    const data = await res.json();
    if (!res.ok || !data.history) {
      el.innerHTML = '<div class="history-empty">No queries logged yet.</div>';
      return;
    }
    if (data.history.length === 0) {
      el.innerHTML = '<div class="history-empty">No questions asked yet. Try Quick Studio Ask above!</div>';
      return;
    }
    el.innerHTML = data.history.map(h => `
      <div class="recent-item" onclick="navigate('history')">
        <span class="recent-q">${escHtml(h.userInput)}</span>
        <span class="recent-badge recent-badge--${h.type ?? 'single'}">${h.type ?? 'single'}</span>
        <span class="recent-time">${fmtTime(h.createdAt)}</span>
      </div>
    `).join('');
  } catch {
    el.innerHTML = '<div class="history-empty">Could not connect to history store.</div>';
  }
}

function refreshDashboard() {
  ['stat-total', 'stat-today', 'stat-bulk', 'stat-single'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '—';
  });
  const recentEl = document.getElementById('recent-list');
  if (recentEl) {
    recentEl.innerHTML = `<div class="skeleton-list"><div class="skeleton-item"></div><div class="skeleton-item"></div><div class="skeleton-item"></div></div>`;
  }
  loadDashboard();
  checkHealth();
  showToast('Telemetry refreshed');
}

// ─────────────────────────────────────────────────────────────
//  LEARNING MODES (PEDAGOGY)
// ─────────────────────────────────────────────────────────────
function setLearningMode(mode) {
  state.learningMode = mode;
  document.querySelectorAll('.mode-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.mode === mode);
  });
}

function formatQueryWithMode(text) {
  if (state.learningMode === 'summary') {
    return `[Format: Concise Summary & Key Takeaways]\n${text}`;
  }
  if (state.learningMode === 'stepbystep') {
    return `[Format: Step-by-Step Pedagogical Walkthrough]\n${text}`;
  }
  if (state.learningMode === 'quiz') {
    return `[Format: Concept Explanation followed by 3 Practice Self-Test Questions with hints]\n${text}`;
  }
  return text; // Default comprehensive
}

// ─────────────────────────────────────────────────────────────
//  DASHBOARD QUICK ASK
// ─────────────────────────────────────────────────────────────
async function dashboardAsk() {
  const inputEl = document.getElementById('dash-input');
  const rawInput = inputEl.value.trim();
  if (!rawInput) { shakeEl('dash-input'); return; }

  const formattedInput = formatQueryWithMode(rawInput);
  const respArea = document.getElementById('dash-response');
  const rText    = document.getElementById('dash-response-text');
  const err      = document.getElementById('dash-error');

  respArea.classList.add('hidden');
  err.classList.add('hidden');
  showLoading('Analyzing Query…', 'EduAI is generating your solution');

  try {
    const res = await apiFetch('/ask', {userInput: formattedInput});
    hideLoading();
    if (!res.ok) {
      showErr('dash-error', 'dash-error-text', res.data.error);
      return;
    }
    respArea.classList.remove('hidden');
    renderMarkdown(rText, res.data.response);
    loadStats();
    loadRecentHistory();
  } catch {
    hideLoading();
    showErr('dash-error', 'dash-error-text', networkErr());
  }
}

// ─────────────────────────────────────────────────────────────
//  ASK AI STUDIO (SINGLE)
// ─────────────────────────────────────────────────────────────
function initTextareaCounters() {
  const askTa = document.getElementById('ask-input');
  const count = document.getElementById('ask-count');
  if (askTa && count) {
    askTa.addEventListener('input', () => {
      const len = askTa.value.length;
      count.textContent = `${len} / 1000`;
      count.style.color = len > 900 ? 'var(--amber)' : '';
    });
  }

  // Ctrl+Enter keyboard submission
  askTa?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) askSingle();
  });
  document.getElementById('dash-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) dashboardAsk();
  });
}

function setSubject(subjectName) {
  const ta = document.getElementById('ask-input');
  if (!ta) return;
  const prefix = `[${subjectName}] `;
  if (ta.value.startsWith(prefix)) {
    ta.value = ta.value.slice(prefix.length);
  } else {
    // Strip any other subject tag if present
    ta.value = prefix + ta.value.replace(/^\[.*?\]\s*/, '');
  }
  ta.dispatchEvent(new Event('input'));

  document.querySelectorAll('.subject-tag').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.includes(subjectName.split(' ')[0]));
  });
}

function setAskExample(text) {
  const ta = document.getElementById('ask-input');
  if (!ta) return;
  ta.value = text;
  ta.dispatchEvent(new Event('input'));
  ta.focus();
}

function clearAsk() {
  const ta = document.getElementById('ask-input');
  if (ta) {
    ta.value = '';
    ta.dispatchEvent(new Event('input'));
  }
  document.getElementById('ask-response')?.classList.add('hidden');
  document.getElementById('ask-empty-state')?.classList.remove('hidden');
  document.getElementById('ask-error')?.classList.add('hidden');
  document.querySelectorAll('.subject-tag').forEach(t => t.classList.remove('active'));
  stopSpeech();
}

async function askSingle() {
  const inputEl = document.getElementById('ask-input');
  const rawInput = inputEl.value.trim();
  if (!rawInput) { shakeEl('ask-input'); return; }

  const formattedInput = formatQueryWithMode(rawInput);
  state.lastAskQuestion = rawInput;

  const btn      = document.getElementById('ask-btn');
  const respArea = document.getElementById('ask-response');
  const rText    = document.getElementById('ask-response-text');
  const empty    = document.getElementById('ask-empty-state');
  const err      = document.getElementById('ask-error');

  respArea.classList.add('hidden');
  empty.classList.add('hidden');
  err.classList.add('hidden');
  btn.disabled = true;
  stopSpeech();

  showLoading('Synthesizing Solution…', 'Computing pedagogical steps with OpenAI');

  try {
    const res = await apiFetch('/ask', {userInput: formattedInput});
    hideLoading();

    if (!res.ok) {
      empty.classList.remove('hidden');
      showErr('ask-error', 'ask-error-text', res.data.error);
      btn.disabled = false;
      return;
    }

    state.lastAskResponse = res.data.response;
    respArea.classList.remove('hidden');
    renderMarkdown(rText, res.data.response);
    buildFollowups(rawInput);
    loadStats();
  } catch {
    hideLoading();
    empty.classList.remove('hidden');
    showErr('ask-error', 'ask-error-text', networkErr());
  } finally {
    btn.disabled = false;
  }
}

function buildFollowups(question) {
  const container = document.getElementById('followup-chips');
  const section   = document.getElementById('followup-section');
  if (!container || !section) return;

  const clean = question.replace(/^\[.*?\]\s*/, '').toLowerCase();
  const suggestions = [
    `Can you provide a practical, real-world case study for this?`,
    `What are the most common pitfalls or misconceptions students have with this?`,
    `Can you give me a formula or cheat-sheet summary of this topic?`,
    `What related advanced concept should I study next?`,
  ].slice(0, 3);

  container.innerHTML = suggestions.map(s =>
    `<button class="followup-chip" onclick="setAskExample(${JSON.stringify(s)})">${escHtml(s)}</button>`
  ).join('');

  section.style.display = suggestions.length ? '' : 'none';
}

function downloadCurrentResponse() {
  if (!state.lastAskResponse) return;
  const content = `# Educational Solution\n**Question:** ${state.lastAskQuestion}\n**Date:** ${new Date().toLocaleString()}\n\n---\n\n${state.lastAskResponse}`;
  downloadFile(`eduai-solution-${Date.now()}.md`, content, 'text/markdown');
  showToast('Downloaded Solution (.md)!');
}

// ─────────────────────────────────────────────────────────────
//  TEXT-TO-SPEECH (TTS) & VOICE INPUT
// ─────────────────────────────────────────────────────────────
function initVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    const vBtn = document.getElementById('voice-btn');
    if (vBtn) {
      vBtn.title = 'Voice recognition not supported in this browser';
      vBtn.style.opacity = '0.5';
    }
    return;
  }

  const rec = new SpeechRecognition();
  rec.continuous     = false;
  rec.interimResults = true;
  rec.lang           = 'en-US';

  rec.onresult = e => {
    const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
    const input = document.getElementById('ask-input');
    if (input) {
      input.value = transcript;
      input.dispatchEvent(new Event('input'));
    }
  };
  rec.onend   = () => stopVoice();
  rec.onerror = () => stopVoice();
  state.recognition = rec;
}

function toggleVoice() {
  if (state.voiceActive) { stopVoice(); return; }
  state.voiceActive = true;
  document.getElementById('voice-btn')?.classList.add('listening');
  document.getElementById('voice-status')?.classList.remove('hidden');
  try { state.recognition?.start(); } catch {}
}

function stopVoice() {
  state.voiceActive = false;
  document.getElementById('voice-btn')?.classList.remove('listening');
  document.getElementById('voice-status')?.classList.add('hidden');
  try { state.recognition?.stop(); } catch {}
}

function toggleSpeech(targetElId) {
  if (state.isSpeaking) {
    stopSpeech();
    return;
  }
  const el = document.getElementById(targetElId);
  const text = el?.innerText || el?.textContent || '';
  if (!text || !window.speechSynthesis) return;

  stopSpeech();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.0;
  utter.pitch = 1.0;
  utter.onend = () => setSpeechActive(false);
  utter.onerror = () => setSpeechActive(false);

  state.currentUtterance = utter;
  window.speechSynthesis.speak(utter);
  setSpeechActive(true);
}

function stopSpeech() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  setSpeechActive(false);
}

function setSpeechActive(active) {
  state.isSpeaking = active;
  const ttsBtn   = document.getElementById('tts-btn');
  const ttsLabel = document.getElementById('tts-label');
  if (ttsBtn) ttsBtn.classList.toggle('active', active);
  if (ttsLabel) ttsLabel.textContent = active ? 'Stop' : 'Listen';
}

// ─────────────────────────────────────────────────────────────
//  BULK QUERY COROUTINE MANAGER
// ─────────────────────────────────────────────────────────────
const MAX_BULK = 10;

function initBulk() {
  state.bulkItems = [];
  addBulkQuestion();
}

function addBulkQuestion(initialVal = '') {
  if (state.bulkItems.length >= MAX_BULK) {
    showToast('Maximum 10 questions allowed');
    return;
  }
  const id = Date.now() + Math.floor(Math.random() * 1000);
  state.bulkItems.push({id, value: initialVal, status: 'pending', answer: ''});
  renderBulkQuestions();
}

function renderBulkQuestions() {
  const container = document.getElementById('bulk-questions');
  const badge     = document.getElementById('bulk-count-badge');
  if (!container || !badge) return;

  const count = state.bulkItems.length;
  badge.textContent = `${count} question${count !== 1 ? 's' : ''}`;

  container.innerHTML = state.bulkItems.map((item, i) => `
    <div class="bulk-q-item ${item.status === 'done' ? 'done' : ''}"
         id="bqi-${item.id}"
         draggable="true"
         ondragstart="bulkDragStart(event, ${i})"
         ondragover="bulkDragOver(event, ${i})"
         ondrop="bulkDrop(event, ${i})"
         ondragend="bulkDragEnd()">
      <div class="bulk-q-header">
        <div class="bulk-q-label">
          <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
          <span>Question ${i + 1}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <span class="bulk-q-status bulk-q-status--${item.status}">
            ${item.status === 'pending' ? 'Pending' : item.status === 'loading' ? '⏳ Processing' : item.status === 'done' ? '✓ Completed' : '✗ Failed'}
          </span>
          ${count > 1 ? `
            <button class="bulk-q-remove" onclick="removeBulkQ(${item.id})" title="Remove question">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          ` : ''}
        </div>
      </div>
      <textarea
        class="textarea"
        placeholder="Enter academic question ${i + 1}…"
        rows="2"
        oninput="updateBulkValue(${item.id}, this.value)"
      >${escHtml(item.value)}</textarea>
      ${item.answer ? `
        <div class="bulk-q-answer markdown-body">
          <div style="display:flex;justify-content:flex-end;margin-bottom:6px;">
            <button class="action-pill-btn" onclick="copyText('bqa-content-${item.id}')" title="Copy answer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Copy</span>
            </button>
          </div>
          <div id="bqa-content-${item.id}">${markdownToHtml(item.answer)}</div>
        </div>
      ` : ''}
    </div>
  `).join('');
}

function updateBulkValue(id, val) {
  const item = state.bulkItems.find(i => i.id === id);
  if (item) item.value = val;
}

function removeBulkQ(id) {
  state.bulkItems = state.bulkItems.filter(i => i.id !== id);
  renderBulkQuestions();
}

function clearBulk() {
  state.bulkItems = [];
  state.bulkResults = [];
  document.getElementById('bulk-progress')?.classList.add('hidden');
  document.getElementById('bulk-progress-text')?.classList.add('hidden');
  document.getElementById('bulk-export-group')?.classList.add('hidden');
  document.getElementById('bulk-error')?.classList.add('hidden');
  addBulkQuestion();
}

// Drag & drop reordering
let dragIndex = null;
function bulkDragStart(e, i) { dragIndex = i; e.currentTarget.classList.add('dragging'); }
function bulkDragOver(e, i)  { e.preventDefault(); }
function bulkDrop(e, i) {
  e.preventDefault();
  if (dragIndex === null || dragIndex === i) return;
  const moved = state.bulkItems.splice(dragIndex, 1)[0];
  state.bulkItems.splice(i, 0, moved);
  renderBulkQuestions();
}
function bulkDragEnd() { dragIndex = null; }

// Bulk Execution
async function askBulk() {
  // Sync textarea content
  state.bulkItems.forEach(item => {
    const ta = document.querySelector(`#bqi-${item.id} textarea`);
    if (ta) item.value = ta.value.trim();
  });

  const nonEmpty = state.bulkItems.filter(i => i.value);
  if (nonEmpty.length === 0) {
    showToast('Please enter at least one question');
    return;
  }

  const btn   = document.getElementById('bulk-btn');
  const prog  = document.getElementById('bulk-progress');
  const bar   = document.getElementById('bulk-progress-bar');
  const pTxt  = document.getElementById('bulk-progress-text');
  const err   = document.getElementById('bulk-error');
  const expG  = document.getElementById('bulk-export-group');

  err?.classList.add('hidden');
  expG?.classList.add('hidden');
  prog?.classList.remove('hidden');
  pTxt?.classList.remove('hidden');
  btn.disabled = true;

  nonEmpty.forEach(i => { i.status = 'loading'; i.answer = ''; });
  renderBulkQuestions();

  if (bar) bar.style.width = '0%';
  if (pTxt) pTxt.textContent = `0 / ${nonEmpty.length} coroutines executing`;

  showLoading(`Processing ${nonEmpty.length} concurrent coroutines…`, 'Asyncio gather in Python ensures ordered returns');

  try {
    const res = await apiFetch('/ask-bulk', {userInputs: nonEmpty.map(i => i.value)});
    hideLoading();

    if (!res.ok) {
      nonEmpty.forEach(i => { i.status = 'error'; });
      renderBulkQuestions();
      showErr('bulk-error', 'bulk-error-text', res.data.error);
      btn.disabled = false;
      return;
    }

    const responses = res.data.responses;
    for (let i = 0; i < nonEmpty.length; i++) {
      nonEmpty[i].status = 'done';
      nonEmpty[i].answer = responses[i] || '';
      const pct = Math.round(((i + 1) / nonEmpty.length) * 100);
      if (bar) bar.style.width = `${pct}%`;
      if (pTxt) pTxt.textContent = `${i + 1} / ${nonEmpty.length} completed`;
      renderBulkQuestions();
      await sleep(60);
    }

    state.bulkResults = nonEmpty.map((item, i) => ({q: item.value, a: responses[i] || ''}));
    expG?.classList.remove('hidden');
    loadStats();
    showToast('Bulk query complete!');
  } catch {
    hideLoading();
    nonEmpty.forEach(i => { i.status = 'error'; });
    renderBulkQuestions();
    showErr('bulk-error', 'bulk-error-text', networkErr());
  } finally {
    btn.disabled = false;
  }
}

// Bulk Paste Modal
function openBulkPasteModal() {
  document.getElementById('modal-bulk-paste')?.classList.remove('hidden');
  document.getElementById('bulk-paste-input')?.focus();
}

function closeBulkPasteModal() {
  document.getElementById('modal-bulk-paste')?.classList.add('hidden');
}

function confirmBulkPaste() {
  const ta = document.getElementById('bulk-paste-input');
  if (!ta) return;
  const lines = ta.value.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    closeBulkPasteModal();
    return;
  }

  state.bulkItems = [];
  lines.slice(0, MAX_BULK).forEach(line => addBulkQuestion(line));
  closeBulkPasteModal();
  ta.value = '';
  showToast(`Imported ${Math.min(lines.length, MAX_BULK)} questions`);
}

function loadSampleQuiz() {
  state.bulkItems = [];
  const samples = [
    "What is the mathematical definition of a limit in calculus?",
    "Explain Newton's third law of motion with rocket propulsion example.",
    "What is the difference between TCP and UDP networking protocols?",
    "Explain the concept of inflation and how central banks manage it."
  ];
  samples.forEach(s => addBulkQuestion(s));
  showToast('Loaded Sample Academic Exam!');
}

function downloadAnswers(format = 'md') {
  if (!state.bulkResults.length) return;
  const stamp = new Date().toLocaleString();

  if (format === 'json') {
    const jsonStr = JSON.stringify({generatedAt: stamp, queries: state.bulkResults}, null, 2);
    downloadFile(`eduai-bulk-${Date.now()}.json`, jsonStr, 'application/json');
  } else if (format === 'txt') {
    const txt = state.bulkResults.map((r, i) => `Q${i + 1}: ${r.q}\n${'-'.repeat(50)}\n${r.a}\n`).join('\n\n');
    downloadFile(`eduai-bulk-${Date.now()}.txt`, `EduAI Bulk Inquiries\nGenerated: ${stamp}\n\n${txt}`, 'text/plain');
  } else {
    // Markdown
    const md = state.bulkResults.map((r, i) => `## Question ${i + 1}\n> ${r.q}\n\n### Solution\n${r.a}\n\n---`).join('\n\n');
    downloadFile(`eduai-bulk-${Date.now()}.md`, `# EduAI Batch Assessment\n**Generated:** ${stamp}\n\n${md}`, 'text/markdown');
  }
  showToast(`Exported as .${format.toUpperCase()}`);
}

// ─────────────────────────────────────────────────────────────
//  LEARNING HISTORY ARCHIVE
// ─────────────────────────────────────────────────────────────
let historyDebounceTimer = null;
function historySearchDebounced() {
  clearTimeout(historyDebounceTimer);
  const val = document.getElementById('history-search')?.value || '';
  document.getElementById('search-clear')?.classList.toggle('hidden', !val);
  historyDebounceTimer = setTimeout(() => {
    state.historySearch = val;
    state.historyPage   = 1;
    loadHistory();
  }, 350);
}

function clearHistorySearch() {
  const input = document.getElementById('history-search');
  if (input) input.value = '';
  document.getElementById('search-clear')?.classList.add('hidden');
  state.historySearch = '';
  state.historyPage   = 1;
  loadHistory();
}

function setHistoryFilter(filterVal) {
  state.historyFilter = filterVal;
  state.historyPage   = 1;
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filterVal);
  });
  loadHistory();
}

function historyPage(delta) {
  state.historyPage = Math.max(1, Math.min(state.historyPages, state.historyPage + delta));
  loadHistory();
}

async function loadHistory() {
  const list = document.getElementById('history-list');
  if (!list) return;

  list.innerHTML = `<div class="skeleton-list"><div class="skeleton-item skeleton-item--lg"></div><div class="skeleton-item skeleton-item--lg"></div><div class="skeleton-item skeleton-item--lg"></div></div>`;

  const params = new URLSearchParams({
    page:  state.historyPage,
    limit: state.historyLimit,
    ...(state.historySearch ? {search: state.historySearch} : {}),
    ...(state.historyFilter ? {type:   state.historyFilter} : {}),
  });

  try {
    const res  = await fetch(`${API}/history?${params}`);
    const data = await res.json();
    if (!res.ok) {
      list.innerHTML = `<div class="history-empty">${escHtml(data.error || 'Failed to load history')}</div>`;
      return;
    }

    state.historyTotal = data.total;
    state.historyPages = data.pages;

    if (!data.history || data.history.length === 0) {
      list.innerHTML = `<div class="history-empty">${state.historySearch ? `No records found for "${escHtml(state.historySearch)}"` : 'No learning history saved yet. Ask your first question!'}</div>`;
      document.getElementById('pagination')?.classList.add('hidden');
      return;
    }

    list.innerHTML = data.history.map(h => `
      <div class="history-item" id="hist-${h._id}">
        <div class="history-item-header" onclick="toggleHistItem('${h._id}')">
          <span class="history-q">${escHtml(h.userInput)}</span>
          <div class="history-meta">
            <span class="history-type history-type--${h.type ?? 'single'}">${h.type ?? 'single'}</span>
            <span class="history-time">${fmtTime(h.createdAt)}</span>
            <button class="history-delete" onclick="deleteHistItem(event, '${h._id}')" title="Delete record">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
            <span class="history-chevron">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
          </div>
        </div>
        <div class="history-item-body">
          <div class="history-item-actions">
            <button class="action-pill-btn" onclick="toggleSpeech('hist-ans-${h._id}')" title="Listen to response">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
              <span>Listen</span>
            </button>
            <button class="action-pill-btn" onclick="copyText('hist-ans-${h._id}')" title="Copy solution">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Copy</span>
            </button>
            <button class="action-pill-btn" onclick="downloadSingleHistory('${h._id}', ${JSON.stringify(h.userInput).replace(/"/g, '&quot;')})" title="Export markdown">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Export</span>
            </button>
          </div>
          <div class="history-answer markdown-body" id="hist-ans-${h._id}">${markdownToHtml(h.response)}</div>
        </div>
      </div>
    `).join('');

    // Pagination controls
    const pg = document.getElementById('pagination');
    if (pg) {
      pg.classList.toggle('hidden', state.historyPages <= 1);
      document.getElementById('page-info').textContent  = `${state.historyPage} / ${state.historyPages}`;
      document.getElementById('page-prev').disabled     = state.historyPage <= 1;
      document.getElementById('page-next').disabled     = state.historyPage >= state.historyPages;
    }
  } catch {
    list.innerHTML = `<div class="history-empty">Could not load history database.</div>`;
  }
}

function toggleHistItem(id) {
  document.getElementById(`hist-${id}`)?.classList.toggle('open');
}

async function deleteHistItem(e, id) {
  e.stopPropagation();
  const item = document.getElementById(`hist-${id}`);
  if (item) item.style.opacity = '0.4';

  try {
    const res = await fetch(`${API}/history/${id}`, {method: 'DELETE'});
    if (res.ok) {
      if (item) {
        item.style.transition = 'all 0.3s ease';
        item.style.transform  = 'translateX(-30px)';
        item.style.opacity    = '0';
      }
      setTimeout(() => { loadHistory(); loadStats(); }, 320);
      showToast('Record deleted from MongoDB');
    } else {
      if (item) item.style.opacity = '1';
      showToast('Delete failed');
    }
  } catch {
    if (item) item.style.opacity = '1';
  }
}

function downloadSingleHistory(id, question) {
  const ansEl = document.getElementById(`hist-ans-${id}`);
  const ansText = ansEl?.innerText || '';
  const md = `# Question\n${question}\n\n---\n\n# Solution\n${ansText}`;
  downloadFile(`history-${id}.md`, md, 'text/markdown');
  showToast('Downloaded Record (.md)!');
}

async function exportFullHistory() {
  try {
    const res  = await fetch(`${API}/history?limit=100`);
    const data = await res.json();
    if (!res.ok || !data.history) return;
    const jsonStr = JSON.stringify(data.history, null, 2);
    downloadFile(`eduai-database-export-${Date.now()}.json`, jsonStr, 'application/json');
    showToast('Database Export Downloaded!');
  } catch {
    showToast('Export failed');
  }
}

// ─────────────────────────────────────────────────────────────
//  PROMPT ENGINEERING STUDIO
// ─────────────────────────────────────────────────────────────
const DEFAULT_SYSTEM_PROMPT = `You are a supportive, knowledgeable educational AI tutor.
Break down complex topics using intuitive analogies, step-by-step reasoning, and concise summaries.
Respond clearly to the following student inquiry:
{{userInput}}`;

const PROMPT_PRESETS = {
  academic: DEFAULT_SYSTEM_PROMPT,
  socratic: `You are a world-class Socratic mentor.
Do not simply give away direct answers; instead, ask guiding questions, suggest logical deductions, and help the student discover the solution themselves:
{{userInput}}`,
  exam: `You are an exacting academic exam maker and grader.
Provide rigorous, structured grading criteria, accurate mathematical proofs or definitions, and test the student's mastery:
{{userInput}}`,
  stem: `You are a senior computer science and mathematics professor.
Provide high-performance, well-commented code, algorithmic complexity analysis (Big-O time & space), and step-by-step proofs:
{{userInput}}`,
};

async function loadPrompt() {
  const ta  = document.getElementById('prompt-editor');
  const err = document.getElementById('prompt-error');
  if (!ta) return;
  ta.value  = 'Loading template from MongoDB…';
  err?.classList.add('hidden');

  try {
    const res  = await fetch(`${API}/prompt`);
    const data = await res.json();
    ta.value = res.ok ? data.template : 'Error loading prompt.';
    validatePromptEditor();
    updatePromptSandbox();
  } catch {
    ta.value = DEFAULT_SYSTEM_PROMPT;
    validatePromptEditor();
    updatePromptSandbox();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const ta = document.getElementById('prompt-editor');
  if (ta) {
    ta.addEventListener('input', () => {
      validatePromptEditor();
      updatePromptSandbox();
    });
  }
});

function validatePromptEditor() {
  const ta    = document.getElementById('prompt-editor');
  const badge = document.getElementById('prompt-validator-badge');
  const btn   = document.getElementById('save-prompt-btn');
  if (!ta || !badge || !btn) return;

  const valid = ta.value.includes('{{userInput}}');
  if (valid) {
    badge.textContent = '✓ Valid placeholder {{userInput}} present';
    badge.style.color = 'var(--cyan)';
    btn.disabled = false;
  } else {
    badge.textContent = '✗ Missing required {{userInput}} placeholder';
    badge.style.color = 'var(--rose)';
    btn.disabled = true;
  }
}

function updatePromptSandbox() {
  const ta = document.getElementById('prompt-editor');
  const preview = document.getElementById('sandbox-preview');
  if (!ta || !preview) return;

  const sample = "How does Newton's third law apply to rocket launches?";
  const rendered = ta.value.replace('{{userInput}}', sample);
  preview.textContent = rendered;
}

function applyPromptPreset(presetKey) {
  const ta = document.getElementById('prompt-editor');
  if (!ta || !PROMPT_PRESETS[presetKey]) return;
  ta.value = PROMPT_PRESETS[presetKey];
  validatePromptEditor();
  updatePromptSandbox();
  showToast('Preset loaded! Remember to Save to DB.');
}

function resetToDefaultPrompt() {
  applyPromptPreset('academic');
}

async function savePrompt() {
  const ta  = document.getElementById('prompt-editor');
  const err = document.getElementById('prompt-error');
  err?.classList.add('hidden');

  const template = ta?.value.trim() || '';
  if (!template.includes('{{userInput}}')) {
    showErr('prompt-error', 'prompt-error-text', 'Template must include {{userInput}} placeholder');
    return;
  }

  const btn = document.getElementById('save-prompt-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const res  = await fetch(`${API}/prompt`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({template}),
    });
    const data = await res.json();
    if (res.ok) {
      showToast('System prompt successfully saved to MongoDB!');
    } else {
      showErr('prompt-error', 'prompt-error-text', data.error || 'Save failed');
    }
  } catch {
    showErr('prompt-error', 'prompt-error-text', networkErr());
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
      </svg>
      Save to MongoDB
    `;
  }
}

// ─────────────────────────────────────────────────────────────
//  KEYBOARD SHORTCUTS & MODALS
// ─────────────────────────────────────────────────────────────
function initShortcuts() {
  window.addEventListener('keydown', e => {
    // Ctrl+K or Cmd+K -> open shortcuts
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      toggleShortcutsModal();
    }
    // Ctrl+/ -> toggle theme
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      toggleTheme();
    }
    // Alt + 1-5 -> navigate tabs
    if (e.altKey && ['1','2','3','4','5'].includes(e.key)) {
      e.preventDefault();
      const views = ['dashboard', 'ask', 'bulk', 'history', 'prompt'];
      navigate(views[parseInt(e.key) - 1]);
    }
    // Escape -> close modals
    if (e.key === 'Escape') {
      closeShortcutsModal();
      closeBulkPasteModal();
      stopSpeech();
      stopVoice();
    }
  });
}

function openShortcutsModal() {
  document.getElementById('modal-shortcuts')?.classList.remove('hidden');
}

function closeShortcutsModal() {
  document.getElementById('modal-shortcuts')?.classList.add('hidden');
}

function toggleShortcutsModal() {
  const m = document.getElementById('modal-shortcuts');
  if (m) m.classList.toggle('hidden');
}

// ─────────────────────────────────────────────────────────────
//  SHARED UTILITIES
// ─────────────────────────────────────────────────────────────
async function apiFetch(endpoint, body) {
  const res  = await fetch(`${API}${endpoint}`, {
    method:  'POST',
    headers: {'Content-Type': 'application/json'},
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  return {ok: res.ok, status: res.status, data};
}

function showLoading(text = 'Thinking…', sub = 'EduAI is generating your solution') {
  const t = document.getElementById('loading-text');
  const s = document.getElementById('loading-sub');
  const o = document.getElementById('loading-overlay');
  if (t) t.textContent = text;
  if (s) s.textContent = sub;
  o?.classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading-overlay')?.classList.add('hidden');
}

function showToast(msg = 'Action completed') {
  const t = document.getElementById('toast');
  const txt = document.getElementById('toast-text');
  if (!t || !txt) return;
  txt.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2800);
}

function showErr(areaId, textId, msg) {
  document.getElementById(areaId)?.classList.remove('hidden');
  const txt = document.getElementById(textId);
  if (txt) txt.textContent = msg || 'An unexpected error occurred';
}

function networkErr() {
  return 'Cannot reach the API server. Ensure python run.py is active on port 5000.';
}

function shakeEl(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = 'rgba(244,63,94,0.7)';
  el.classList.add('shake');
  setTimeout(() => {
    el.style.borderColor = '';
    el.classList.remove('shake');
  }, 600);
}

function copyText(idOrContent) {
  const el = document.getElementById(idOrContent);
  const text = el ? (el.innerText || el.textContent) : idOrContent;
  navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!'));
}

function downloadFile(filename, content, type = 'text/plain') {
  const blob = new Blob([content], {type});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function markdownToHtml(text = '') {
  if (typeof marked === 'undefined') return escHtml(text).replace(/\n/g, '<br>');
  try {
    let html = marked.parse(text);
    return enhanceCodeBlocks(html);
  } catch {
    return escHtml(text);
  }
}

function enhanceCodeBlocks(html) {
  // Post-process HTML to wrap <pre><code> into stylish code block containers with copy buttons
  const temp = document.createElement('div');
  temp.innerHTML = html;
  temp.querySelectorAll('pre').forEach((pre, i) => {
    const code = pre.querySelector('code');
    const langMatch = code?.className.match(/language-(\w+)/);
    const lang = langMatch ? langMatch[1] : 'code';

    const container = document.createElement('div');
    container.className = 'code-block-container';

    const header = document.createElement('div');
    header.className = 'code-block-header';
    header.innerHTML = `
      <span class="code-block-lang">${lang}</span>
      <button class="code-block-copy" onclick="copyCodeSnippet(this)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copy
      </button>
    `;

    pre.parentNode.insertBefore(container, pre);
    container.appendChild(header);
    container.appendChild(pre);
  });
  return temp.innerHTML;
}

function copyCodeSnippet(button) {
  const container = button.closest('.code-block-container');
  const code = container?.querySelector('pre code')?.innerText || '';
  navigator.clipboard.writeText(code).then(() => {
    button.innerHTML = '✓ Copied';
    setTimeout(() => {
      button.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copy
      `;
    }, 1800);
  });
}

function renderMarkdown(el, text) {
  if (el) el.innerHTML = markdownToHtml(text);
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const now  = new Date();
  const diff = now - d;
  if (diff < 60_000)    return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Inject shake animation CSS
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
.shake{animation:shake 0.45s ease;}
`;
document.head.appendChild(shakeStyle);
