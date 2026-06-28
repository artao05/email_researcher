// ─── Config ──────────────────────────────────────────────────
const WEFT_API = 'http://localhost:3000';
const POLL_INTERVAL = 3000;

// ─── State ───────────────────────────────────────────────────
let state = {
  token: '',
  triggerId: '',
  eventDescription: '',
  sheetId: '',
  companies: [],       // [{ name, url }]
  tasks: {},           // executionId → task object from Weft
  companyStatus: {},   // companyIndex → 'researching'|'needs-review'|'approved'|'skipped'|'re-researching'
  currentReviewTask: null,
  pollTimer: null,
};

// ─── Persistence ──────────────────────────────────────────────
function loadSaved() {
  const token     = localStorage.getItem('weft_token')     || '';
  const triggerId = localStorage.getItem('weft_trigger_id') || '';
  if (token)     document.getElementById('ext-token').value   = token;
  if (triggerId) document.getElementById('trigger-id').value  = triggerId;
}

function save() {
  state.token     = document.getElementById('ext-token').value.trim();
  state.triggerId = document.getElementById('trigger-id').value.trim();
  localStorage.setItem('weft_token',      state.token);
  localStorage.setItem('weft_trigger_id', state.triggerId);
}

// ─── Google Sheets ────────────────────────────────────────────
function sheetUrlToCsvUrl(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) throw new Error('Invalid Google Sheets URL — could not extract sheet ID');
  const id = match[1];
  state.sheetId = id;
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
}

function parseCsv(text) {
  const lines = text.trim().split('\n').map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
  if (lines.length < 2) throw new Error('Sheet must have at least one data row');
  const headers = lines[0].map(h => h.toLowerCase());
  const nameIdx = headers.findIndex(h => h.includes('company') || h.includes('name'));
  const urlIdx  = headers.findIndex(h => h.includes('url') || h.includes('website') || h.includes('domain'));
  if (nameIdx < 0) throw new Error('Sheet must have a "Company Name" column');
  if (urlIdx  < 0) throw new Error('Sheet must have a "Website URL" column');
  return lines.slice(1)
    .filter(row => row[nameIdx])
    .map(row => ({ name: row[nameIdx], url: row[urlIdx] || '' }));
}

// ─── Start research ───────────────────────────────────────────
async function startResearch() {
  save();

  const sheetUrl = document.getElementById('sheet-url').value.trim();
  state.eventDescription = document.getElementById('event-description').value.trim();

  const statusEl = document.getElementById('parse-status');
  const btn = document.getElementById('run-btn');

  if (!state.token)     return showStatus('error', 'Extension token is required');
  if (!state.triggerId) return showStatus('error', 'Weft Trigger ID is required');
  if (!sheetUrl)        return showStatus('error', 'Google Sheet URL is required');
  if (!state.eventDescription) return showStatus('error', 'Event description is required');

  btn.disabled = true;
  btn.textContent = 'Fetching sheet...';
  showStatus('info', 'Fetching Google Sheet...');

  try {
    const csvUrl = sheetUrlToCsvUrl(sheetUrl);
    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error(`Could not fetch sheet (${res.status}). Make sure it's shared publicly.`);
    const text = await res.text();
    state.companies = parseCsv(text);

    if (state.companies.length === 0) throw new Error('No companies found in the sheet');

    showStatus('info', `Found ${state.companies.length} companies. Starting research...`);
    btn.textContent = 'Triggering Weft...';

    // POST to Weft
    const payload = {
      companies: JSON.stringify(state.companies),
      event_description: state.eventDescription,
      sheet_id: state.sheetId,
    };

    const weftRes = await fetch(`${WEFT_API}/api/v1/webhooks/${state.triggerId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!weftRes.ok) {
      const body = await weftRes.text();
      throw new Error(`Weft API error (${weftRes.status}): ${body}`);
    }

    // All companies start as "researching"
    state.companies.forEach((_, i) => { state.companyStatus[i] = 'researching'; });

    showQueueView();
    startPolling();

  } catch (err) {
    showStatus('error', err.message);
    btn.disabled = false;
    btn.textContent = 'Run Research';
  }
}

function showStatus(type, msg) {
  const el = document.getElementById('parse-status');
  el.className = `parse-status${type === 'error' ? ' error' : ''}`;
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ─── View transitions ─────────────────────────────────────────
function showSetup() {
  stopPolling();
  document.getElementById('view-setup').className = 'view active';
  document.getElementById('view-queue').className = 'view hidden';
}

function showQueueView() {
  document.getElementById('view-setup').className = 'view hidden';
  document.getElementById('view-queue').className = 'view active';
  document.getElementById('event-summary').textContent = `Event: ${state.eventDescription.slice(0, 120)}${state.eventDescription.length > 120 ? '...' : ''}`;
  renderCompanyList();
}

// ─── Company list rendering ───────────────────────────────────
function renderCompanyList() {
  const list = document.getElementById('company-list');
  list.innerHTML = '';

  state.companies.forEach((company, i) => {
    const status = state.companyStatus[i] || 'researching';
    const task = findTaskForCompany(i);

    const card = document.createElement('div');
    card.className = `company-card${status === 'needs-review' ? ' needs-review' : ''}`;
    card.id = `company-card-${i}`;

    card.innerHTML = `
      <div class="company-info">
        <div class="company-name">${escHtml(company.name)}</div>
        <div class="company-url">${escHtml(company.url)}</div>
      </div>
      ${renderBadge(status)}
      ${status === 'needs-review' && task
        ? `<button class="btn-review" onclick="openReview(${i})">Review →</button>`
        : ''}
    `;
    list.appendChild(card);
  });

  updateStats();
}

function renderBadge(status) {
  const map = {
    'researching':    ['status-researching',    'Researching',    true],
    'needs-review':   ['status-needs-review',   'Needs Review',   true],
    'approved':       ['status-approved',        'Approved',       false],
    'skipped':        ['status-skipped',         'Skipped',        false],
    're-researching': ['status-re-researching',  'Re-researching', true],
  };
  const [cls, label, pulse] = map[status] || map['researching'];
  return `<span class="status-badge ${cls}">${pulse ? '<span class="pulse-dot"></span>' : ''}${label}</span>`;
}

function updateStats() {
  const counts = Object.values(state.companyStatus).reduce((acc, s) => {
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const total = state.companies.length;
  const statsEl = document.getElementById('queue-stats');
  statsEl.innerHTML = `
    <span class="queue-stat">${total} companies</span>
    ${counts['researching']    ? `<span class="queue-stat" style="color:var(--accent)">${counts['researching']} researching</span>` : ''}
    ${counts['needs-review']   ? `<span class="queue-stat" style="color:var(--amber)">${counts['needs-review']} needs review</span>` : ''}
    ${counts['approved']       ? `<span class="queue-stat" style="color:var(--green)">${counts['approved']} approved</span>` : ''}
    ${counts['skipped']        ? `<span class="queue-stat" style="color:var(--text-muted)">${counts['skipped']} skipped</span>` : ''}
  `;
}

// ─── Polling ───────────────────────────────────────────────────
function startPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  pollTasks();
  state.pollTimer = setInterval(pollTasks, POLL_INTERVAL);
}

function stopPolling() {
  if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
}

async function pollTasks() {
  try {
    const res = await fetch(`${WEFT_API}/ext/${state.token}/tasks`);
    if (!res.ok) return;
    const data = await res.json();
    const tasks = (data.tasks || []).filter(t => t.metadata?.source === 'human');

    // Update known tasks
    state.tasks = {};
    tasks.forEach(task => { state.tasks[task.executionId] = task; });

    // Match tasks back to companies by name in task data
    tasks.forEach(task => {
      const companyName = task.data?.company?.name;
      if (!companyName) return;
      const idx = state.companies.findIndex(c => c.name === companyName);
      if (idx >= 0 && state.companyStatus[idx] !== 'approved' && state.companyStatus[idx] !== 'skipped') {
        state.companyStatus[idx] = 'needs-review';
      }
    });

    renderCompanyList();
  } catch (_) { /* silent */ }
}

function findTaskForCompany(idx) {
  const company = state.companies[idx];
  return Object.values(state.tasks).find(t => t.data?.company?.name === company.name) || null;
}

// ─── Review panel ─────────────────────────────────────────────
function openReview(companyIdx) {
  const task = findTaskForCompany(companyIdx);
  if (!task) return;

  state.currentReviewTask = { task, companyIdx };

  const company = state.companies[companyIdx];
  const data = task.data || {};
  const scores = data.scores || {};

  document.getElementById('review-company-name').textContent = company.name;
  const urlEl = document.getElementById('review-company-url');
  urlEl.textContent = company.url;
  urlEl.href = company.url;

  // Score pills
  const pillsEl = document.getElementById('score-pills');
  pillsEl.innerHTML = ['mission', 'recent_activity', 'audience', 'overall'].map(key => {
    const val = scores[key] || '?';
    const cls = val >= 8 ? 'score-high' : val >= 5 ? 'score-mid' : 'score-low';
    const label = key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    return `<div class="score-pill"><span class="score-label">${label}</span><span class="score-value ${cls}">${val}</span></div>`;
  }).join('');

  // Brief
  document.getElementById('review-brief').textContent = data.brief || 'No brief available yet.';

  // Reset form
  document.getElementById('annotation-input').value = '';
  document.getElementById('direction-input').value = '';
  document.getElementById('direction-group').classList.add('hidden');

  document.getElementById('review-overlay').classList.remove('hidden');
}

function closeReview(evt) {
  if (evt && evt.target !== document.getElementById('review-overlay')) return;
  document.getElementById('review-overlay').classList.add('hidden');
  state.currentReviewTask = null;
}

function toggleDiveDirection() {
  const group = document.getElementById('direction-group');
  group.classList.toggle('hidden');
  if (!group.classList.contains('hidden')) {
    document.getElementById('direction-input').focus();
  }
}

async function submitReview(action) {
  if (!state.currentReviewTask) return;
  const { task, companyIdx } = state.currentReviewTask;

  const annotation = document.getElementById('annotation-input').value.trim();
  const direction  = document.getElementById('direction-input').value.trim();

  if (action === 'skip') {
    await cancelTask(task.executionId);
    state.companyStatus[companyIdx] = 'skipped';
  } else {
    const input = {
      decision: action === 'approve',
      annotation,
      deeper_dive_direction: direction,
    };
    await completeTask(task.executionId, task.nodeId, task.metadata?.callbackId, input);
    state.companyStatus[companyIdx] = action === 'approve' ? 'approved' : 're-researching';
  }

  document.getElementById('review-overlay').classList.add('hidden');
  state.currentReviewTask = null;
  renderCompanyList();

  // Auto-advance to next needs-review
  const next = state.companies.findIndex((_, i) => state.companyStatus[i] === 'needs-review');
  if (next >= 0) setTimeout(() => openReview(next), 400);
}

// ─── Weft API calls ────────────────────────────────────────────
async function completeTask(executionId, nodeId, callbackId, input) {
  await fetch(`${WEFT_API}/ext/${state.token}/tasks/${executionId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodeId, callbackId, input }),
  });
}

async function cancelTask(executionId) {
  await fetch(`${WEFT_API}/ext/${state.token}/tasks/${executionId}/cancel`, {
    method: 'POST',
  });
}

// ─── Utils ────────────────────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Init ─────────────────────────────────────────────────────
loadSaved();
