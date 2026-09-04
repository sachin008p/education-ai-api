// ─────────────────────────────────────────────
//  EduAI Frontend – app.js
// ─────────────────────────────────────────────

const API_BASE = 'http://127.0.0.1:5000/api';

// ── Session history store ──
let sessionHistory = [];

// ── Textarea character counter ──
const singleInput = document.getElementById('single-input');
const singleCount = document.getElementById('single-count');
singleInput.addEventListener('input', () => {
  const len = singleInput.value.length;
  singleCount.textContent = `${len} / 500`;
  singleCount.style.color = len > 450 ? '#f59e0b' : '';
});

// ── Tab switching ──
function switchTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById(`nav-${tab}`).classList.add('active');

  if (tab === 'history') renderHistory();
}

// ── Example chip fill ──
function setExample(text) {
  singleInput.value = text;
  singleCount.textContent = `${text.length} / 500`;
  singleInput.focus();
}

// ────────────────────────────────────────────
//  SINGLE QUERY
// ────────────────────────────────────────────
async function askSingle() {
  const input = singleInput.value.trim();
  if (!input) { shake('single-input'); return; }

  const btn = document.getElementById('ask-btn');
  const responseArea = document.getElementById('single-response');
  const responseText = document.getElementById('single-response-text');
  const errorArea   = document.getElementById('single-error');
  const errorText   = document.getElementById('single-error-text');

  // Reset UI
  responseArea.classList.add('hidden');
  errorArea.classList.add('hidden');

  showLoading('Thinking…');
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInput: input }),
    });

    const data = await res.json();
    hideLoading();

    if (!res.ok) {
      errorText.textContent = data.error || `Error ${res.status}`;
      errorArea.classList.remove('hidden');
      return;
    }

    // Typewriter effect
    responseText.textContent = '';
    responseArea.classList.remove('hidden');
    await typewriter(responseText, data.response);

    // Save to session history
    sessionHistory.unshift({ type: 'single', question: input, answer: data.response, time: new Date() });

  } catch (err) {
    hideLoading();
    errorText.textContent = 'Could not reach the server. Make sure the API is running on http://127.0.0.1:5000';
    errorArea.classList.remove('hidden');
  } finally {
    btn.disabled = false;
  }
}

// ────────────────────────────────────────────
//  BULK QUERY
// ────────────────────────────────────────────
let bulkCount = 1;
const MAX_BULK = 8;

function addBulkQuestion() {
  if (bulkCount >= MAX_BULK) return;
  bulkCount++;

  const container = document.getElementById('bulk-questions');
  const idx = bulkCount - 1;

  const item = document.createElement('div');
  item.className = 'bulk-question-item';
  item.dataset.index = idx;
  item.innerHTML = `
    <div class="bulk-question-header">
      <span class="bulk-q-label">Q${bulkCount}</span>
      <button class="remove-btn" onclick="removeBulkQuestion(${idx})" title="Remove">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <textarea class="textarea textarea--sm" placeholder="Enter question ${bulkCount}…" rows="2"></textarea>
  `;
  container.appendChild(item);

  // Show remove on first item if we now have >1
  updateBulkRemoveBtns();

  if (bulkCount >= MAX_BULK) {
    document.getElementById('add-q-btn').disabled = true;
  }
}

function removeBulkQuestion(idx) {
  const container = document.getElementById('bulk-questions');
  const items = container.querySelectorAll('.bulk-question-item');
  if (items.length <= 1) return;

  // Find the item with matching data-index
  for (const item of items) {
    if (parseInt(item.dataset.index) === idx) {
      item.remove();
      bulkCount--;
      break;
    }
  }

  // Re-number labels
  renumberBulkItems();
  updateBulkRemoveBtns();
  document.getElementById('add-q-btn').disabled = false;
}

function renumberBulkItems() {
  const items = document.querySelectorAll('.bulk-question-item');
  items.forEach((item, i) => {
    item.dataset.index = i;
    item.querySelector('.bulk-q-label').textContent = `Q${i + 1}`;
    const removeBtn = item.querySelector('.remove-btn');
    if (removeBtn) {
      removeBtn.setAttribute('onclick', `removeBulkQuestion(${i})`);
    }
    const ta = item.querySelector('textarea');
    ta.placeholder = `Enter question ${i + 1}…`;
  });
}

function updateBulkRemoveBtns() {
  const items = document.querySelectorAll('.bulk-question-item');
  items.forEach(item => {
    const btn = item.querySelector('.remove-btn');
    if (!btn) return;
    btn.classList.toggle('hidden', items.length <= 1);
  });
}

async function askBulk() {
  const textareas = document.querySelectorAll('#bulk-questions textarea');
  const inputs = Array.from(textareas).map(ta => ta.value.trim()).filter(Boolean);

  if (inputs.length === 0) { shakeBulk(); return; }

  const btn = document.getElementById('bulk-ask-btn');
  const responsesDiv = document.getElementById('bulk-responses');
  const errorArea   = document.getElementById('bulk-error');
  const errorText   = document.getElementById('bulk-error-text');

  responsesDiv.classList.add('hidden');
  responsesDiv.innerHTML = '';
  errorArea.classList.add('hidden');

  showLoading(`Processing ${inputs.length} question${inputs.length > 1 ? 's' : ''}…`);
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/ask-bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInputs: inputs }),
    });

    const data = await res.json();
    hideLoading();

    if (!res.ok) {
      errorText.textContent = data.error || `Error ${res.status}`;
      errorArea.classList.remove('hidden');
      return;
    }

    responsesDiv.classList.remove('hidden');
    data.responses.forEach((answer, i) => {
      const item = document.createElement('div');
      item.className = 'bulk-response-item';
      item.innerHTML = `
        <div class="bulk-response-q">
          <span>Q${i + 1}</span>
          <span class="bulk-response-q-text">${escapeHtml(inputs[i])}</span>
        </div>
        <div class="bulk-response-answer" id="bulk-ans-${i}"></div>
      `;
      responsesDiv.appendChild(item);
    });

    // Staggered typewriter
    for (let i = 0; i < data.responses.length; i++) {
      const el = document.getElementById(`bulk-ans-${i}`);
      await typewriter(el, data.responses[i], 8);
    }

    // Save to history (one bulk entry per run)
    inputs.forEach((q, i) => {
      sessionHistory.unshift({ type: 'bulk', question: q, answer: data.responses[i], time: new Date() });
    });

  } catch (err) {
    hideLoading();
    errorText.textContent = 'Could not reach the server. Make sure the API is running on http://127.0.0.1:5000';
    errorArea.classList.remove('hidden');
  } finally {
    btn.disabled = false;
  }
}

// ────────────────────────────────────────────
//  HISTORY
// ────────────────────────────────────────────
function renderHistory() {
  const list = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');

  // Remove old items (keep empty placeholder)
  Array.from(list.querySelectorAll('.history-item')).forEach(el => el.remove());

  if (sessionHistory.length === 0) {
    empty.style.display = '';
    return;
  }

  empty.style.display = 'none';

  sessionHistory.forEach((entry, i) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.id = `hist-${i}`;

    const timeStr = formatTime(entry.time);
    item.innerHTML = `
      <div class="history-item-header" onclick="toggleHistory(${i})">
        <span class="history-q">${escapeHtml(entry.question)}</span>
        <div class="history-meta">
          <span class="history-type history-type--${entry.type}">${entry.type}</span>
          <span class="history-time">${timeStr}</span>
          <span class="history-chevron">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </span>
        </div>
      </div>
      <div class="history-item-body">
        <div class="history-answer">${escapeHtml(entry.answer)}</div>
      </div>
    `;
    list.appendChild(item);
  });
}

function toggleHistory(i) {
  const item = document.getElementById(`hist-${i}`);
  item.classList.toggle('open');
}

function clearHistory() {
  sessionHistory = [];
  renderHistory();
}

// ────────────────────────────────────────────
//  COPY
// ────────────────────────────────────────────
function copyResponse(elId) {
  const text = document.getElementById(elId)?.textContent || '';
  navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!'));
}

// ────────────────────────────────────────────
//  HELPERS
// ────────────────────────────────────────────
function showLoading(msg = 'Thinking…') {
  document.getElementById('loading-text').textContent = msg;
  document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading-overlay').classList.add('hidden');
}

function showToast(msg = 'Done!') {
  const toast = document.getElementById('toast');
  document.getElementById('toast-text').textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2500);
}

function shake(id) {
  const el = document.getElementById(id);
  el.classList.add('shake');
  el.style.borderColor = 'rgba(239,68,68,0.6)';
  setTimeout(() => {
    el.classList.remove('shake');
    el.style.borderColor = '';
  }, 600);
}

function shakeBulk() {
  document.querySelectorAll('#bulk-questions .textarea').forEach(ta => {
    ta.style.borderColor = 'rgba(239,68,68,0.4)';
    setTimeout(() => { ta.style.borderColor = ''; }, 600);
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function typewriter(el, text, speed = 12) {
  el.textContent = '';
  for (let i = 0; i < text.length; i++) {
    el.textContent += text[i];
    if (i % 3 === 0) await sleep(speed);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Shake CSS (injected once)
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%,100% { transform: translateX(0); }
    20%      { transform: translateX(-6px); }
    40%      { transform: translateX(6px); }
    60%      { transform: translateX(-4px); }
    80%      { transform: translateX(4px); }
  }
  .shake { animation: shake 0.5s ease; }
`;
document.head.appendChild(shakeStyle);

// ── Enter key shortcut for single query ──
singleInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    askSingle();
  }
});
