// ─── Config ──────────────────────────────────────────────────
const WEFT_API = 'http://localhost:3000';
const POLL_INTERVAL = 3000;

// ─── State ───────────────────────────────────────────────────
let state = {
  token: '',
  triggerId: '',
  eventDescription: '',
  sponsorshipTiers: '',
  sheetId: '',
  templateBlocks: [],
  subjectPersonalize: true,
  companies: [],       // [{ name, row }]
  tasks: {},
  companyStatus: {},
  currentReviewTask: null,
  pollTimer: null,
};

// ─── Persistence ──────────────────────────────────────────────
const STORAGE_KEYS = [
  'weft_token', 'weft_trigger_id', 'event_description', 'sponsorship_tiers',
  'email_template', 'subject_personalize', 'template_blocks_json',
  'llm_key_openrouter', 'llm_key_openai', 'llm_key_gemini', 'llm_key_groq', 'llm_key_primary',
  'google_sa_json', 'sheet_url',
];

function loadSaved() {
  const map = {
    'ext-token': 'weft_token',
    'trigger-id': 'weft_trigger_id',
    'event-description': 'event_description',
    'sponsorship-tiers': 'sponsorship_tiers',
    'email-template': 'email_template',
    'sheet-url': 'sheet_url',
    'llm-key-openrouter': 'llm_key_openrouter',
    'llm-key-openai': 'llm_key_openai',
    'llm-key-gemini': 'llm_key_gemini',
    'llm-key-groq': 'llm_key_groq',
    'llm-key-primary': 'llm_key_primary',
    'google-sa-json': 'google_sa_json',
  };
  for (const [elId, key] of Object.entries(map)) {
    const val = localStorage.getItem(key);
    if (val) document.getElementById(elId).value = val;
  }
  const subj = localStorage.getItem('subject_personalize');
  if (subj !== null) document.getElementById('subject-personalize').checked = subj === 'true';
  loadProviderPrefs();
  restoreTemplateBlocks();
}

function save() {
  state.token = document.getElementById('ext-token').value.trim();
  state.triggerId = document.getElementById('trigger-id').value.trim();
  localStorage.setItem('weft_token', state.token);
  localStorage.setItem('weft_trigger_id', state.triggerId);
  localStorage.setItem('event_description', document.getElementById('event-description').value);
  localStorage.setItem('sponsorship_tiers', document.getElementById('sponsorship-tiers').value);
  localStorage.setItem('email_template', document.getElementById('email-template').value);
  localStorage.setItem('sheet_url', document.getElementById('sheet-url').value);
  localStorage.setItem('subject_personalize', document.getElementById('subject-personalize').checked);
  localStorage.setItem('template_blocks_json', JSON.stringify(state.templateBlocks));
  localStorage.setItem('llm_key_openrouter', document.getElementById('llm-key-openrouter').value);
  localStorage.setItem('llm_key_openai', document.getElementById('llm-key-openai').value);
  localStorage.setItem('llm_key_gemini', document.getElementById('llm-key-gemini').value);
  localStorage.setItem('llm_key_groq', document.getElementById('llm-key-groq').value);
  localStorage.setItem('llm_key_primary', document.getElementById('llm-key-primary').value);
  localStorage.setItem('google_sa_json', document.getElementById('google-sa-json').value);
  saveProviderPrefs();
  syncPrimaryKeyToProvider();
}

function syncPrimaryKeyToProvider() {
  const provider = document.getElementById('llm-provider').value;
  const primary = document.getElementById('llm-key-primary').value;
  const idMap = { openai: 'llm-key-openai', openrouter: 'llm-key-openrouter', gemini: 'llm-key-gemini', groq: 'llm-key-groq' };
  const el = document.getElementById(idMap[provider]);
  if (el && primary) el.value = primary;
}

function getUiApiKeys() {
  syncPrimaryKeyToProvider();
  return {
    openai: document.getElementById('llm-key-openai').value.trim(),
    openrouter: document.getElementById('llm-key-openrouter').value.trim(),
    gemini: document.getElementById('llm-key-gemini').value.trim(),
    groq: document.getElementById('llm-key-groq').value.trim(),
  };
}

// ─── Template blocks ──────────────────────────────────────────
function splitTemplate() {
  const raw = document.getElementById('email-template').value.trim();
  if (!raw) return showStatus('error', 'Paste an example email first');

  const parts = raw.split(/\n\s*\n/).map(t => t.trim()).filter(Boolean);
  if (parts.length === 0) return showStatus('error', 'Could not split email into blocks');

  state.templateBlocks = parts.map((text, i) => ({
    index: i,
    text,
    mode: i === 0 ? 'fixed' : 'personalize',
  }));

  renderTemplateBlocks();
  showStatus('info', `Split into ${parts.length} blocks — toggle each as Keep identical or Personalize`);
}

function restoreTemplateBlocks() {
  try {
    const saved = localStorage.getItem('template_blocks_json');
    if (saved) {
      state.templateBlocks = JSON.parse(saved);
      if (state.templateBlocks.length) renderTemplateBlocks();
    }
  } catch (_) { /* ignore */ }
}

function renderTemplateBlocks() {
  const container = document.getElementById('template-blocks');
  container.classList.remove('hidden');
  container.innerHTML = state.templateBlocks.map((block, i) => `
    <div class="template-block ${block.mode}" data-index="${i}">
      <div class="block-header">
        <span class="block-num">${block.label ? escHtml(block.label) : `Block ${i + 1}`}</span>
        <div class="block-toggles">
          <button type="button" class="mode-btn ${block.mode === 'fixed' ? 'active fixed' : ''}"
            onclick="setBlockMode(${i}, 'fixed')">Keep identical</button>
          <button type="button" class="mode-btn ${block.mode === 'personalize' ? 'active personalize' : ''}"
            onclick="setBlockMode(${i}, 'personalize')">Personalize</button>
        </div>
      </div>
      ${block.hint ? `<div class="block-hint">${escHtml(block.hint)}</div>` : ''}
      <pre class="block-text">${escHtml(block.text)}</pre>
    </div>
  `).join('');
}

function setBlockMode(index, mode) {
  if (state.templateBlocks[index]) {
    state.templateBlocks[index].mode = mode;
    renderTemplateBlocks();
    localStorage.setItem('template_blocks_json', JSON.stringify(state.templateBlocks));
  }
}

function buildTemplatePayload() {
  if (state.templateBlocks.length === 0) splitTemplate();
  return {
    subject_mode: document.getElementById('subject-personalize').checked ? 'personalize' : 'fixed',
    suggested_subject: typeof CHIMES_TEMPLATE !== 'undefined' ? CHIMES_TEMPLATE.suggestedSubject : '',
    sponsorship_tiers: document.getElementById('sponsorship-tiers').value.trim(),
    blocks: state.templateBlocks.map(b => ({
      text: b.text,
      mode: b.mode,
      label: b.label || '',
      hint: b.hint || '',
    })),
  };
}

// ─── Google Sheets read ───────────────────────────────────────
function sheetUrlToCsvUrl(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) throw new Error('Invalid Google Sheets URL — could not extract sheet ID');
  state.sheetId = match[1];
  return `https://docs.google.com/spreadsheets/d/${state.sheetId}/export?format=csv`;
}

function parseCsv(text) {
  const lines = text.trim().split('\n').map(l => {
    const row = [];
    let cur = '', inQ = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { row.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    row.push(cur.trim());
    return row;
  });
  if (lines.length < 2) throw new Error('Sheet must have at least one data row');

  const headers = lines[0].map(h => h.toLowerCase().replace(/^"|"$/g, ''));
  const col = (...patterns) => headers.findIndex(h => patterns.some(p => h.includes(p)));

  const nameIdx = col('company', 'sponsor') >= 0 ? col('company', 'sponsor') : col('name');
  if (nameIdx < 0) throw new Error('Sheet must have a "Company Name" column (row 1)');

  const pocNameIdx = col('poc name', 'contact name', 'contact');
  const pocEmailIdx = col('poc email', 'email');
  const industryIdx = col('industry');
  const urlIdx = col('url', 'link', 'website');

  const clean = v => (v || '').replace(/^"|"$/g, '');

  return lines.slice(1)
    .map((row, i) => ({
      name: clean(row[nameIdx]),
      row: i + 2,
      poc_name: pocNameIdx >= 0 ? clean(row[pocNameIdx]) : '',
      poc_email: pocEmailIdx >= 0 ? clean(row[pocEmailIdx]) : '',
      industry: industryIdx >= 0 ? clean(row[industryIdx]) : '',
      url: urlIdx >= 0 ? clean(row[urlIdx]) : '',
    }))
    .filter(c => c.name);
}

// ─── Start research ───────────────────────────────────────────
async function startResearch() {
  save();

  const sheetUrl = document.getElementById('sheet-url').value.trim();
  state.eventDescription = document.getElementById('event-description').value.trim();
  state.sponsorshipTiers = document.getElementById('sponsorship-tiers').value.trim();

  const btn = document.getElementById('run-btn');

  if (!state.token) return showStatus('error', 'Extension token is required');
  if (!state.triggerId) return showStatus('error', 'Weft Trigger ID is required');
  if (!sheetUrl) return showStatus('error', 'Google Sheet URL is required');
  if (!state.eventDescription) return showStatus('error', 'Event description is required');
  if (!document.getElementById('email-template').value.trim()) return showStatus('error', 'Paste an example email template');
  if (state.templateBlocks.length === 0) splitTemplate();
  if (state.templateBlocks.length === 0) return showStatus('error', 'Could not parse email template blocks');

  const uiKeys = getUiApiKeys();
  let llm = resolveLlmConfig(uiKeys);
  if (!llm) {
    // Keys may be injected server-side via register-trigger.sh (.env)
    llm = {
      provider: document.getElementById('llm-provider').value,
      model: document.getElementById('llm-model').value,
      apiKey: '',
      fallbackUsed: false,
      serverKeys: true,
    };
  }

  btn.disabled = true;
  btn.textContent = 'Fetching sheet...';
  showStatus('info', 'Fetching Google Sheet...');

  try {
    const csvUrl = sheetUrlToCsvUrl(sheetUrl);
    const sheetFetchUrl = `${window.location.origin}/api/sheet?url=${encodeURIComponent(sheetUrl)}`;
    let res;
    try {
      res = await fetch(sheetFetchUrl);
    } catch {
      res = await fetch(csvUrl);
    }
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).error; } catch { detail = await res.text(); }
      throw new Error(detail || `Could not fetch sheet (${res.status}). Share with "Anyone with the link".`);
    }
    state.companies = parseCsv(await res.text());
    if (state.companies.length === 0) throw new Error('No companies found in the sheet');

    showStatus('info', `Found ${state.companies.length} companies. Starting research with ${LLM_CATALOG[llm.provider].label}${llm.fallbackUsed ? ' (fallback)' : ''}...`);
    btn.textContent = 'Triggering Weft...';

    const payload = {
      companies: JSON.stringify(state.companies),
      event_description: state.eventDescription,
      sheet_id: state.sheetId,
      template: JSON.stringify(buildTemplatePayload()),
      llm_provider: llm.provider,
      llm_model: llm.model,
      api_keys: JSON.stringify(uiKeys),
      google_credentials: document.getElementById('google-sa-json').value.trim() || '',
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

    state.companies.forEach((_, i) => { state.companyStatus[i] = 'researching'; });
    showQueueView();
    startPolling();
  } catch (err) {
    let msg = err.message || String(err);
    if (msg === 'Failed to fetch') {
      msg = 'Network error. Use http://localhost:8090 (bash scripts/open-ui.sh), ensure Weft is on :3000, and share your Google Sheet as "Anyone with the link".';
    }
    showStatus('error', msg);
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

// ─── Views ────────────────────────────────────────────────────
function showSetup() {
  stopPolling();
  document.getElementById('view-setup').className = 'view active';
  document.getElementById('view-queue').className = 'view hidden';
  document.getElementById('run-btn').disabled = false;
  document.getElementById('run-btn').textContent = 'Run Research';
}

function showQueueView() {
  document.getElementById('view-setup').className = 'view hidden';
  document.getElementById('view-queue').className = 'view active';
  document.getElementById('event-summary').textContent =
    `Event: ${state.eventDescription.slice(0, 100)}${state.eventDescription.length > 100 ? '…' : ''}`;
  renderCompanyList();
}

// ─── Company list ─────────────────────────────────────────────
function renderCompanyList() {
  const list = document.getElementById('company-list');
  list.innerHTML = '';

  state.companies.forEach((company, i) => {
    const status = state.companyStatus[i] || 'researching';
    const task = findTaskForCompany(i);

    const card = document.createElement('div');
    card.className = `company-card${status === 'needs-review' ? ' needs-review' : ''}`;
    card.innerHTML = `
      <div class="company-info">
        <div class="company-name">${escHtml(company.name)}</div>
        <div class="company-url">${task ? escHtml(taskFields(task).discovered_url || '') || `Row ${company.row}` : `Row ${company.row}`}</div>
      </div>
      ${renderBadge(status)}
      ${status === 'needs-review' && task ? `<button class="btn-review" onclick="openReview(${i})">Review →</button>` : ''}
    `;
    list.appendChild(card);
  });
  updateStats();
}

function renderBadge(status) {
  const map = {
    researching: ['status-researching', 'Researching', true],
    'needs-review': ['status-needs-review', 'Needs Review', true],
    approved: ['status-approved', 'Written to Sheet', false],
    skipped: ['status-skipped', 'Skipped', false],
    're-researching': ['status-re-researching', 'Re-researching', true],
  };
  const [cls, label, pulse] = map[status] || map.researching;
  return `<span class="status-badge ${cls}">${pulse ? '<span class="pulse-dot"></span>' : ''}${label}</span>`;
}

function updateStats() {
  const counts = Object.values(state.companyStatus).reduce((acc, s) => {
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  const total = state.companies.length;
  document.getElementById('queue-stats').innerHTML = `
    <span class="queue-stat">${total} companies</span>
    ${counts.researching ? `<span class="queue-stat accent">${counts.researching} researching</span>` : ''}
    ${counts['needs-review'] ? `<span class="queue-stat amber">${counts['needs-review']} needs review</span>` : ''}
    ${counts.approved ? `<span class="queue-stat green">${counts.approved} written</span>` : ''}
    ${counts.skipped ? `<span class="queue-stat">${counts.skipped} skipped</span>` : ''}
  `;
}

// ─── Polling ──────────────────────────────────────────────────
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
    const tasks = (await res.json()).tasks || [];
    const humanTasks = tasks.filter(t => t.metadata?.source === 'human');

    state.tasks = {};
    humanTasks.forEach(t => { state.tasks[t.executionId] = t; });

    humanTasks.forEach(task => {
      const idx = companyIndexFromTask(task);
      if (idx >= 0 && !['approved', 'skipped'].includes(state.companyStatus[idx])) {
        state.companyStatus[idx] = 'needs-review';
      }
    });
    renderCompanyList();
  } catch (_) { /* silent */ }
}

function taskFields(task) {
  const out = { ...(task.data || {}) };
  for (const f of task.formSchema?.fields || []) {
    if (f.key && out[f.key] == null && f.value != null) out[f.key] = f.value;
  }
  if (out.company?.name && !out.company_name) out.company_name = out.company.name;
  return out;
}

function companyIndexFromTask(task) {
  const fields = taskFields(task);
  const name = fields.company?.name || fields.company_name;
  if (!name) return -1;
  return state.companies.findIndex(c => c.name === name);
}

function findTaskForCompany(idx) {
  const company = state.companies[idx];
  return Object.values(state.tasks).find(t => {
    const fields = taskFields(t);
    const n = fields.company?.name || fields.company_name;
    return n === company.name;
  }) || null;
}

// ─── Review panel ─────────────────────────────────────────────
function openReview(companyIdx) {
  const task = findTaskForCompany(companyIdx);
  if (!task) return;

  state.currentReviewTask = { task, companyIdx };
  const company = state.companies[companyIdx];
  const data = taskFields(task);
  let scores = data.scores || {};
  if (typeof scores === 'string') {
    try { scores = JSON.parse(scores); } catch (_) { scores = {}; }
  }

  let briefText = data.brief || 'Research in progress…';
  if (briefText.includes('"blocks"') && (briefText.includes('"subject_mode"') || briefText.includes('"mode"'))) {
    briefText = 'Research did not complete — the model returned your email template instead of company research.\n\nSkip this review, then run research again (the workflow was just fixed). Old queued reviews from broken runs can be skipped.';
  }

  document.getElementById('review-company-name').textContent = company.name;
  const urlEl = document.getElementById('review-company-url');
  const url = data.discovered_url || data.company?.url || '';
  if (url) {
    urlEl.textContent = url;
    urlEl.href = url;
    urlEl.classList.remove('hidden');
  } else {
    urlEl.textContent = `Sheet row ${company.row}`;
    urlEl.href = '#';
  }

  document.getElementById('score-pills').innerHTML =
    ['mission', 'recent_activity', 'audience', 'overall'].map(key => {
      const val = scores[key]?.score ?? scores[key] ?? '?';
      const cls = val >= 8 ? 'score-high' : val >= 5 ? 'score-mid' : 'score-low';
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      return `<div class="score-pill"><span class="score-label">${label}</span><span class="score-value ${cls}">${val}</span></div>`;
    }).join('');

  const justEl = document.getElementById('score-justifications');
  justEl.innerHTML = ['mission', 'recent_activity', 'audience'].map(key => {
    const entry = scores[key];
    const justification = typeof entry === 'object' ? entry.justification : '';
    if (!justification) return '';
    const label = key.replace(/_/g, ' ');
    return `<div class="justification-item"><strong>${label}:</strong> ${escHtml(justification)}</div>`;
  }).join('');

  document.getElementById('review-brief').textContent = briefText;
  document.getElementById('review-process').textContent =
    data.process || data.personalization_plan || 'Fixed blocks preserved; variable blocks will use research highlights on approve.';

  const draftSection = document.getElementById('draft-section');
  if (data.draft_preview) {
    draftSection.classList.remove('hidden');
    document.getElementById('review-draft').textContent = data.draft_preview;
  } else {
    draftSection.classList.add('hidden');
  }

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
  document.getElementById('direction-group').classList.toggle('hidden');
  document.getElementById('direction-input').focus();
}

async function submitReview(action) {
  if (!state.currentReviewTask) return;
  const { task, companyIdx } = state.currentReviewTask;
  const annotation = document.getElementById('annotation-input').value.trim();
  const direction = document.getElementById('direction-input').value.trim();

  if (action === 'deeper' && !direction) {
    return showStatus('error', 'Enter a direction for the deeper dive');
  }

  if (action === 'skip') {
    await cancelTask(task.executionId);
    state.companyStatus[companyIdx] = 'skipped';
  } else {
    const input = {
      decision: action === 'approve',
      annotation,
      deeper_dive_direction: action === 'deeper' ? direction : '',
    };
    await completeTask(task.executionId, task.nodeId, task.metadata?.callbackId, input);
    state.companyStatus[companyIdx] = action === 'approve' ? 'approved' : 're-researching';
  }

  document.getElementById('review-overlay').classList.add('hidden');
  state.currentReviewTask = null;
  renderCompanyList();

  const next = state.companies.findIndex((_, i) => state.companyStatus[i] === 'needs-review');
  if (next >= 0) setTimeout(() => openReview(next), 400);
}

async function completeTask(executionId, nodeId, callbackId, input) {
  const res = await fetch(`${WEFT_API}/ext/${state.token}/tasks/${executionId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodeId, callbackId, input }),
  });
  if (!res.ok) throw new Error(`Complete task failed (${res.status})`);
}

async function cancelTask(executionId) {
  const res = await fetch(`${WEFT_API}/ext/${state.token}/tasks/${executionId}/cancel`, { method: 'POST' });
  if (!res.ok) throw new Error(`Cancel task failed (${res.status})`);
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function resumePendingReviews() {
  state.token = document.getElementById('ext-token').value.trim();
  if (!state.token) return;

  let humanTasks = [];
  try {
    const res = await fetch(`${WEFT_API}/ext/${state.token}/tasks`);
    if (!res.ok) return;
    humanTasks = ((await res.json()).tasks || []).filter(t => t.metadata?.source === 'human');
  } catch (_) { return; }
  if (humanTasks.length === 0) return;

  const resumeBtn = document.getElementById('resume-btn');
  const sheetUrl = document.getElementById('sheet-url').value.trim();
  if (!sheetUrl) {
    showStatus('info', `${humanTasks.length} review(s) waiting — add your Google Sheet URL, then click "Resume Reviews"`);
    resumeBtn?.classList.remove('hidden');
    return;
  }

  state.eventDescription = document.getElementById('event-description').value.trim() || 'Pending review';
  try {
    const sheetFetchUrl = `${window.location.origin}/api/sheet?url=${encodeURIComponent(sheetUrl)}`;
    const res = await fetch(sheetFetchUrl);
    if (!res.ok) throw new Error('Could not load sheet');
    sheetUrlToCsvUrl(sheetUrl);
    state.companies = parseCsv(await res.text());
  } catch (err) {
    showStatus('error', `Pending reviews exist but sheet failed to load: ${err.message}`);
    resumeBtn?.classList.remove('hidden');
    return;
  }

  state.companyStatus = {};
  humanTasks.forEach(task => {
    const idx = companyIndexFromTask(task);
    if (idx >= 0) state.companyStatus[idx] = 'needs-review';
  });

  humanTasks.forEach(t => { state.tasks[t.executionId] = t; });
  showQueueView();
  startPolling();

  const first = state.companies.findIndex((_, i) => state.companyStatus[i] === 'needs-review');
  if (first >= 0) setTimeout(() => openReview(first), 500);
}

async function resumeReviewsFromSetup() {
  save();
  const btn = document.getElementById('resume-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
  await resumePendingReviews();
  if (btn) { btn.disabled = false; btn.textContent = 'Resume Reviews'; }
}

loadSaved();
if (typeof loadDefaultTemplateIfEmpty === 'function') loadDefaultTemplateIfEmpty();
document.getElementById('llm-model').addEventListener('change', saveProviderPrefs);
resumePendingReviews();
