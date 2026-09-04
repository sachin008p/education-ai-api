// ─────────────────────────────────────────────────────────────
//  EduAI Frontend  –  app.js  (Full Rebuild v2)
// ─────────────────────────────────────────────────────────────

const API = 'http://127.0.0.1:5000/api';

// ── State ─────────────────────────────────────────────────────
const state = {
  currentView:     'dashboard',
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
  lastAskQuestion: '',
};

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  initTheme();
  initTextareaCounters();
  initVoice();
  initBulk();          // seed first question
  checkHealth();
  setInterval(checkHealth, 30_000);
  loadDashboard();
});

// ─────────────────────────────────────────────────────────────
//  NAVIGATION
// ─────────────────────────────────────────────────────────────
function navigate(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

  document.getElementById(`view-${view}`).classList.add('active');
  document.querySelector(`.nav-item[data-view="${view}"]`).classList.add('active');
  state.currentView = view;

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');

  // Lazy-load per view
  if (view === 'history')   { state.historyPage = 1; loadHistory(); }
  if (view === 'prompt')    { loadPrompt(); }
  if (view === 'dashboard') { loadDashboard(); }
}

// ─────────────────────────────────────────────────────────────
//  SIDEBAR MOBILE
// ─────────────────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}

// ─────────────────────────────────────────────────────────────
//  THEME
// ─────────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('eduai-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('eduai-theme', next);
  initParticles(); // re-init particles for theme color change
}

// ─────────────────────────────────────────────────────────────
//  PARTICLES
// ─────────────────────────────────────────────────────────────
function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  const ctx    = canvas.getContext('2d');
  let W = canvas.width  = window.innerWidth;
  let H = canvas.height = window.innerHeight;
  let raf;

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const COLORS = isDark
    ? ['rgba(79,142,247,0.35)', 'rgba(168,85,247,0.3)', 'rgba(34,211,165,0.25)']
    : ['rgba(79,142,247,0.15)', 'rgba(168,85,247,0.12)', 'rgba(34,211,165,0.1)'];

  const COUNT = Math.min(60, Math.floor(W * H / 18000));
  const particles = Array.from({length: COUNT}, () => ({
    x:  Math.random() * W,
    y:  Math.random() * H,
    r:  Math.random() * 1.6 + 0.4,
    vx: (Math.random() - 0.5) * 0.28,
    vy: (Math.random() - 0.5) * 0.28,
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
    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = isDark
            ? `rgba(79,142,247,${0.08 * (1 - dist/100)})`
            : `rgba(79,142,247,${0.04 * (1 - dist/100)})`;
          ctx.lineWidth = 0.5;
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
//  HEALTH CHECK
// ─────────────────────────────────────────────────────────────
async function checkHealth() {
  const dot  = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  const banner = document.getElementById('offline-banner');
  try {
    const res  = await fetch(`${API}/health`, {signal: AbortSignal.timeout(4000)});
    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      dot.className  = 'status-dot online';
      text.textContent = `Online · ${data.model}`;
      banner.classList.add('hidden');
    } else throw new Error();
  } catch {
    dot.className  = 'status-dot offline';
    text.textContent = 'Offline';
    banner.classList.remove('hidden');
  }
}

// ─────────────────────────────────────────────────────────────
//  DASHBOARD
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
  } catch { /* silently skip if offline */ }
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  const diff  = target - start;
  const dur   = 600;
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
  try {
    const res  = await fetch(`${API}/history?limit=5`);
    const data = await res.json();
    if (!res.ok || !data.history) { el.innerHTML = '<div class="history-empty">No history yet.</div>'; return; }
    if (data.history.length === 0) { el.innerHTML = '<div class="history-empty">No questions asked yet. Start with Quick Ask!</div>'; return; }
    el.innerHTML = data.history.map(h => `
      <div class="recent-item" onclick="navigate('history')">
        <span class="recent-q">${escHtml(h.userInput)}</span>
        <span class="recent-badge recent-badge--${h.type ?? 'single'}">${h.type ?? 'single'}</span>
        <span class="recent-time">${fmtTime(h.createdAt)}</span>
      </div>
    `).join('');
  } catch {
    el.innerHTML = '<div class="history-empty">Could not load — is the API running?</div>';
  }
}

function refreshDashboard() {
  document.getElementById('stat-total').textContent  = '—';
  document.getElementById('stat-today').textContent  = '—';
  document.getElementById('stat-bulk').textContent   = '—';
  document.getElementById('stat-single').textContent = '—';
  document.getElementById('recent-list').innerHTML = `<div class="skeleton-list"><div class="skeleton-item"></div><div class="skeleton-item"></div><div class="skeleton-item"></div></div>`;
  loadDashboard();
}

// Dashboard quick-ask
async function dashboardAsk() {
  const input = document.getElementById('dash-input').value.trim();
  if (!input) { shakeEl('dash-input'); return; }
  const resp  = document.getElementById('dash-response');
  const rText = document.getElementById('dash-response-text');
  const err   = document.getElementById('dash-error');
  resp.classList.add('hidden');
  err.classList.add('hidden');
  showLoading('Thinking…');

  try {
    const res  = await apiFetch('/ask', {userInput: input});
    hideLoading();
    if (!res.ok) { showErr('dash-error', 'dash-error-text', res.data.error); return; }
    resp.classList.remove('hidden');
    await renderMarkdown(rText, res.data.response);
    loadStats(); loadRecentHistory();
  } catch (e) {
    hideLoading();
    showErr('dash-error', 'dash-error-text', networkErr());
  }
}

// ─────────────────────────────────────────────────────────────
//  ASK (SINGLE)
// ─────────────────────────────────────────────────────────────
function initTextareaCounters() {
  const askTa = document.getElementById('ask-input');
  const count  = document.getElementById('ask-count');
  askTa.addEventListener('input', () => {
    const l = askTa.value.length;
    count.textContent = `${l} / 1000`;
    count.style.color = l > 900 ? 'var(--amber)' : '';
  });
  // Ctrl+Enter shortcut
  askTa.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) askSingle(); });
  document.getElementById('dash-input').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) dashboardAsk(); });
}

function setSubject(subj) {
  const ta = document.getElementById('ask-input');
  // Toggle: if same prefix, remove it
  const prefix = `[${subj}] `;
  if (ta.value.startsWith(prefix)) { ta.value = ta.value.slice(prefix.length); }
  else { ta.value = prefix + ta.value; }
  ta.dispatchEvent(new Event('input'));
  document.querySelectorAll('.subject-tag').forEach(t => t.classList.remove('active'));
  event.target.classList.toggle('active', !ta.value.startsWith('[') || ta.value.startsWith(prefix));
}

function setAskExample(text) {
  const ta = document.getElementById('ask-input');
  ta.value = text;
  ta.dispatchEvent(new Event('input'));
  ta.focus();
}

function clearAsk() {
  const ta = document.getElementById('ask-input');
  ta.value = '';
  ta.dispatchEvent(new Event('input'));
  document.getElementById('ask-response').classList.add('hidden');
  document.getElementById('ask-empty-state').classList.remove('hidden');
  document.getElementById('ask-error').classList.add('hidden');
  document.querySelectorAll('.subject-tag').forEach(t => t.classList.remove('active'));
}

async function askSingle() {
  const input  = document.getElementById('ask-input').value.trim();
  if (!input) { shakeEl('ask-input'); return; }
  state.lastAskQuestion = input;

  const btn      = document.getElementById('ask-btn');
  const respArea = document.getElementById('ask-response');
  const rText    = document.getElementById('ask-response-text');
  const empty    = document.getElementById('ask-empty-state');
  const err      = document.getElementById('ask-error');

  respArea.classList.add('hidden');
  empty.classList.add('hidden');
  err.classList.add('hidden');
  btn.disabled = true;
  showLoading('Thinking…');

  try {
    const res = await apiFetch('/ask', {userInput: input});
    hideLoading();
    if (!res.ok) { empty.classList.remove('hidden'); showErr('ask-error', 'ask-error-text', res.data.error); btn.disabled = false; return; }

    respArea.classList.remove('hidden');
    await renderMarkdown(rText, res.data.response);
    buildFollowups(input);
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
  const suggestions = generateFollowups(question);
  container.innerHTML = suggestions.map(s =>
    `<button class="followup-chip" onclick="setAskExample(${JSON.stringify(s)})">${escHtml(s)}</button>`
  ).join('');
  section.style.display = suggestions.length ? '' : 'none';
}

function generateFollowups(q) {
  // Heuristic follow-up generation
  const base = q.replace(/^\[.*?\]\s*/, '').toLowerCase();
  const starters = [
    `Can you give me a practical example of this?`,
    `What are the most common mistakes students make here?`,
    `How does this apply in real-world scenarios?`,
    `What related topics should I study next?`,
  ];
  return starters.slice(0, 3);
}

// ─────────────────────────────────────────────────────────────
//  VOICE INPUT
// ─────────────────────────────────────────────────────────────
function initVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    document.getElementById('voice-btn').title = 'Voice input not supported in this browser';
    document.getElementById('voice-btn').disabled = true;
    return;
  }
  const r = new SpeechRecognition();
  r.continuous    = false;
  r.interimResults = true;
  r.lang           = 'en-US';

  r.onresult = e => {
    const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
    document.getElementById('ask-input').value = transcript;
    document.getElementById('ask-input').dispatchEvent(new Event('input'));
  };
  r.onend = () => stopVoice();
  r.onerror = () => stopVoice();
  state.recognition = r;
}

function toggleVoice() {
  if (state.voiceActive) { stopVoice(); return; }
  state.voiceActive = true;
  document.getElementById('voice-btn').classList.add('listening');
  document.getElementById('voice-status').classList.remove('hidden');
  state.recognition?.start();
}

function stopVoice() {
  state.voiceActive = false;
  document.getElementById('voice-btn').classList.remove('listening');
  document.getElementById('voice-status').classList.add('hidden');
  state.recognition?.stop();
}

// ─────────────────────────────────────────────────────────────
//  BULK QUERY
// ─────────────────────────────────────────────────────────────
const MAX_BULK = 10;

function initBulk() {
  state.bulkItems = [];
  addBulkQuestion();
}

function addBulkQuestion() {
  if (state.bulkItems.length >= MAX_BULK) { showToast('Maximum 10 questions allowed'); return; }
  const id = Date.now();
  state.bulkItems.push({id, value: '', status: 'pending', answer: ''});
  renderBulkQuestions();
}

function renderBulkQuestions() {
  const container = document.getElementById('bulk-questions');
  const badge     = document.getElementById('bulk-count-badge');
  const n = state.bulkItems.length;
  badge.textContent = `${n} question${n !== 1 ? 's' : ''}`;

  container.innerHTML = state.bulkItems.map((item, i) => `
    <div class="bulk-q-item ${item.status === 'done' ? 'done' : ''}"
         id="bqi-${item.id}"
         draggable="true"
         ondragstart="bqDragStart(event, ${i})"
         ondragover="bqDragOver(event, ${i})"
         ondrop="bqDrop(event, ${i})"
         ondragend="bqDragEnd()">
      <div class="bulk-q-header">
        <span class="bulk-q-label">Q${i + 1}</span>
        <div style="display:flex;gap:6px;align-items:center;">
          <span class="bulk-q-status bulk-q-status--${item.status}">
            ${item.status === 'pending' ? 'Pending' : item.status === 'loading' ? '⏳ Processing…' : item.status === 'done' ? '✓ Done' : '✗ Error'}
          </span>
          ${n > 1 ? `<button class="bulk-q-remove" onclick="removeBulkQ(${item.id})" title="Remove">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>` : ''}
        </div>
      </div>
      <textarea
        class="textarea textarea--sm"
        placeholder="Enter question ${i + 1}…"
        rows="2"
        oninput="updateBulkQ(${item.id}, this.value)"
      >${escHtml(item.value)}</textarea>
      ${item.answer ? `<div class="bulk-q-answer markdown-body" id="bqa-${item.id}">${markdownToHtml(item.answer)}</div>` : ''}
    </div>
  `).join('');
}

function updateBulkQ(id, value) {
  const item = state.bulkItems.find(i => i.id === id);
  if (item) item.value = value;
}

function removeBulkQ(id) {
  state.bulkItems = state.bulkItems.filter(i => i.id !== id);
  renderBulkQuestions();
}

function clearBulk() {
  state.bulkItems = [];
  state.bulkResults = [];
  document.getElementById('bulk-responses').classList.add('hidden');
  document.getElementById('bulk-responses').innerHTML = '';
  document.getElementById('bulk-error').classList.add('hidden');
  document.getElementById('download-btn').classList.add('hidden');
  document.getElementById('bulk-progress').classList.add('hidden');
  addBulkQuestion();
}

// Drag-to-reorder
let dragIdx = null;
function bqDragStart(e, i)  { dragIdx = i; e.currentTarget.classList.add('dragging'); }
function bqDragOver(e, i)   { e.preventDefault(); document.querySelectorAll('.bulk-q-item').forEach((el, idx) => el.classList.toggle('drag-over', idx === i && i !== dragIdx)); }
function bqDrop(e, i)       { e.preventDefault(); if (dragIdx === null || dragIdx === i) return; const moved = state.bulkItems.splice(dragIdx, 1)[0]; state.bulkItems.splice(i, 0, moved); renderBulkQuestions(); }
function bqDragEnd()        { dragIdx = null; document.querySelectorAll('.bulk-q-item').forEach(el => { el.classList.remove('dragging'); el.classList.remove('drag-over'); }); }

async function askBulk() {
  // Collect non-empty inputs
  const inputs = state.bulkItems.map((item, i) => {
    // Sync textarea values
    const ta = document.querySelector(`#bqi-${item.id} textarea`);
    if (ta) item.value = ta.value.trim();
    return item.value;
  }).filter(Boolean);

  if (inputs.length === 0) { state.bulkItems.forEach(i => { const ta = document.querySelector(`#bqi-${i.id} textarea`); if (ta) ta.style.borderColor='rgba(239,68,68,0.4)'; setTimeout(()=>{ if(ta) ta.style.borderColor=''; }, 800); }); return; }

  // Also sync state items with actual textarea values
  state.bulkItems.forEach(item => {
    const ta = document.querySelector(`#bqi-${item.id} textarea`);
    if (ta) item.value = ta.value.trim();
  });

  const nonEmpty = state.bulkItems.filter(i => i.value);

  const btn  = document.getElementById('bulk-btn');
  const prog = document.getElementById('bulk-progress');
  const bar  = document.getElementById('bulk-progress-bar');
  const pTxt = document.getElementById('bulk-progress-text');
  const err  = document.getElementById('bulk-error');
  const dl   = document.getElementById('download-btn');

  err.classList.add('hidden');
  dl.classList.add('hidden');
  prog.classList.remove('hidden');
  btn.disabled = true;

  // Set all to loading
  nonEmpty.forEach(i => { i.status = 'loading'; i.answer = ''; });
  renderBulkQuestions();
  bar.style.width = '0%';
  pTxt.textContent = `0 / ${nonEmpty.length} completed`;

  showLoading(`Sending ${nonEmpty.length} questions…`, 'Concurrent AI processing — results arrive in order');

  try {
    const res  = await apiFetch('/ask-bulk', {userInputs: nonEmpty.map(i => i.value)});
    hideLoading();

    if (!res.ok) {
      nonEmpty.forEach(i => { i.status = 'error'; });
      renderBulkQuestions();
      showErr('bulk-error', 'bulk-error-text', res.data.error);
      btn.disabled = false;
      return;
    }

    const responses = res.data.responses;
    let done = 0;
    // Animate results one by one
    for (let i = 0; i < nonEmpty.length; i++) {
      nonEmpty[i].status = 'done';
      nonEmpty[i].answer = responses[i] || '';
      done++;
      const pct = Math.round((done / nonEmpty.length) * 100);
      bar.style.width = pct + '%';
      pTxt.textContent = `${done} / ${nonEmpty.length} completed`;
      renderBulkQuestions();
      await sleep(80);
    }

    state.bulkResults = nonEmpty.map((item, i) => ({q: item.value, a: responses[i] || ''}));
    dl.classList.remove('hidden');
    loadStats();

  } catch {
    hideLoading();
    nonEmpty.forEach(i => { i.status = 'error'; });
    renderBulkQuestions();
    showErr('bulk-error', 'bulk-error-text', networkErr());
  } finally {
    btn.disabled = false;
  }
}

function downloadAnswers() {
  if (!state.bulkResults.length) return;
  const lines = state.bulkResults.map((r, i) =>
    `Q${i+1}: ${r.q}\n${'─'.repeat(60)}\n${r.a}\n`
  ).join('\n');
  const blob = new Blob([`EduAI Bulk Answers\nGenerated: ${new Date().toLocaleString()}\n${'═'.repeat(60)}\n\n${lines}`], {type: 'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `eduai-answers-${Date.now()}.txt`;
  a.click();
  showToast('Downloaded!');
}

// ─────────────────────────────────────────────────────────────
//  HISTORY
// ─────────────────────────────────────────────────────────────
let historyDebounceTimer = null;
function historySearchDebounced() {
  clearTimeout(historyDebounceTimer);
  const val = document.getElementById('history-search').value;
  document.getElementById('search-clear').classList.toggle('hidden', !val);
  historyDebounceTimer = setTimeout(() => {
    state.historySearch = val;
    state.historyPage   = 1;
    loadHistory();
  }, 380);
}

function clearHistorySearch() {
  document.getElementById('history-search').value = '';
  document.getElementById('search-clear').classList.add('hidden');
  state.historySearch = '';
  state.historyPage   = 1;
  loadHistory();
}

function setHistoryFilter(f) {
  state.historyFilter = f;
  state.historyPage   = 1;
  document.querySelectorAll('.filter-pill').forEach(p => p.classList.toggle('active', p.dataset.filter === f));
  loadHistory();
}

function historyPage(dir) {
  state.historyPage = Math.max(1, Math.min(state.historyPages, state.historyPage + dir));
  loadHistory();
}

async function loadHistory() {
  const list = document.getElementById('history-list');
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
    if (!res.ok) { list.innerHTML = `<div class="history-empty">${escHtml(data.error || 'Error loading history')}</div>`; return; }

    state.historyTotal = data.total;
    state.historyPages = data.pages;

    if (!data.history.length) {
      list.innerHTML = `<div class="history-empty">${state.historySearch ? `No results for "${escHtml(state.historySearch)}"` : 'No history yet. Ask your first question!'}</div>`;
      document.getElementById('pagination').classList.add('hidden');
      return;
    }

    list.innerHTML = data.history.map(h => `
      <div class="history-item" id="hist-${h._id}">
        <div class="history-item-header" onclick="toggleHistItem('${h._id}')">
          <span class="history-q">${escHtml(h.userInput)}</span>
          <div class="history-meta">
            <span class="history-type history-type--${h.type ?? 'single'}">${h.type ?? 'single'}</span>
            <span class="history-time">${fmtTime(h.createdAt)}</span>
            <button class="history-delete" onclick="deleteHistItem(event, '${h._id}')" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
            <span class="history-chevron">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
          </div>
        </div>
        <div class="history-item-body">
          <div class="history-answer markdown-body">${markdownToHtml(h.response)}</div>
        </div>
      </div>
    `).join('');

    // Pagination
    const pg = document.getElementById('pagination');
    pg.classList.toggle('hidden', state.historyPages <= 1);
    document.getElementById('page-info').textContent  = `${state.historyPage} / ${state.historyPages}`;
    document.getElementById('page-prev').disabled     = state.historyPage <= 1;
    document.getElementById('page-next').disabled     = state.historyPage >= state.historyPages;

  } catch {
    list.innerHTML = `<div class="history-empty">Could not load history — is the API running?</div>`;
  }
}

function toggleHistItem(id) {
  document.getElementById(`hist-${id}`).classList.toggle('open');
}

async function deleteHistItem(e, id) {
  e.stopPropagation();
  const item = document.getElementById(`hist-${id}`);
  item.style.opacity = '0.4';
  try {
    const res = await fetch(`${API}/history/${id}`, {method: 'DELETE'});
    if (res.ok) {
      item.style.transition = 'all 0.3s ease';
      item.style.transform  = 'translateX(-20px)';
      item.style.opacity    = '0';
      setTimeout(() => { loadHistory(); loadStats(); }, 320);
      showToast('Deleted');
    } else {
      item.style.opacity = '1';
      showToast('Delete failed');
    }
  } catch {
    item.style.opacity = '1';
  }
}

// ─────────────────────────────────────────────────────────────
//  PROMPT EDITOR
// ─────────────────────────────────────────────────────────────
async function loadPrompt() {
  const ta  = document.getElementById('prompt-editor');
  const err = document.getElementById('prompt-error');
  ta.value  = 'Loading…';
  err.classList.add('hidden');
  try {
    const res  = await fetch(`${API}/prompt`);
    const data = await res.json();
    ta.value = res.ok ? data.template : 'Error loading prompt.';
    validatePromptEditor();
  } catch {
    ta.value = 'Could not reach the server.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const ta = document.getElementById('prompt-editor');
  if (ta) ta.addEventListener('input', validatePromptEditor);
});

function validatePromptEditor() {
  const ta   = document.getElementById('prompt-editor');
  const hint = document.getElementById('prompt-hint');
  const btn  = document.getElementById('save-prompt-btn');
  const ok   = ta.value.includes('{{userInput}}');
  hint.style.color = ok ? 'var(--text-muted)' : 'var(--red)';
  btn.disabled     = !ok;
}

async function savePrompt() {
  const ta  = document.getElementById('prompt-editor');
  const err = document.getElementById('prompt-error');
  err.classList.add('hidden');

  const template = ta.value.trim();
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
    if (res.ok) { showToast('Prompt saved to MongoDB!'); }
    else { showErr('prompt-error', 'prompt-error-text', data.error || 'Save failed'); }
  } catch {
    showErr('prompt-error', 'prompt-error-text', networkErr());
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Save to MongoDB`;
  }
}

// ─────────────────────────────────────────────────────────────
//  SHARED HELPERS
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

function showLoading(text = 'Thinking…', sub = 'EduAI is generating your answer') {
  document.getElementById('loading-text').textContent = text;
  document.getElementById('loading-sub').textContent  = sub;
  document.getElementById('loading-overlay').classList.remove('hidden');
}
function hideLoading() {
  document.getElementById('loading-overlay').classList.add('hidden');
}

function showToast(msg = 'Done!') {
  const t = document.getElementById('toast');
  document.getElementById('toast-text').textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2800);
}

function showErr(areaId, textId, msg) {
  document.getElementById(areaId).classList.remove('hidden');
  document.getElementById(textId).textContent = msg || 'An error occurred';
}

function networkErr() {
  return 'Cannot reach the server. Make sure python run.py is running on port 5000.';
}

function shakeEl(id) {
  const el = document.getElementById(id);
  el.style.borderColor = 'rgba(239,68,68,0.6)';
  el.classList.add('shake');
  setTimeout(() => { el.style.borderColor = ''; el.classList.remove('shake'); }, 600);
}

function copyText(id) {
  const el = document.getElementById(id);
  const text = el?.innerText || el?.textContent || '';
  navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!'));
}

function escHtml(s = '') {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function markdownToHtml(text = '') {
  if (typeof marked === 'undefined') return escHtml(text).replace(/\n/g,'<br>');
  try { return marked.parse(text); } catch { return escHtml(text); }
}

async function renderMarkdown(el, text) {
  el.innerHTML = markdownToHtml(text);
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const now  = new Date();
  const diff = now - d;
  if (diff < 60_000)   return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Shake keyframe injection
const shakeCSS = document.createElement('style');
shakeCSS.textContent = `
@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
.shake{animation:shake 0.5s ease;}
`;
document.head.appendChild(shakeCSS);
