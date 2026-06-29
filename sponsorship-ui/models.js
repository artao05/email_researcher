// LLM provider catalog — models available per provider
const LLM_CATALOG = {
  openrouter: {
    label: 'OpenRouter',
    envKey: 'OPENROUTER_API_KEY',
    models: [
      { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4' },
      { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (via OR)' },
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
    ],
  },
  gemini: {
    label: 'Gemini (direct)',
    envKey: 'GEMINI_API_KEY',
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    ],
  },
  groq: {
    label: 'Groq (direct)',
    envKey: 'GROQ_API_KEY',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
      { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    ],
  },
};

const FALLBACK_ORDER = ['openrouter', 'gemini', 'groq'];

function populateModelDropdown(provider) {
  const sel = document.getElementById('llm-model');
  const catalog = LLM_CATALOG[provider];
  if (!catalog) return;
  sel.innerHTML = catalog.models
    .map(m => `<option value="${m.id}">${m.label}</option>`)
    .join('');
}

function onProviderChange() {
  const provider = document.getElementById('llm-provider').value;
  populateModelDropdown(provider);
  saveProviderPrefs();
}

function resolveLlmConfig(uiKeys) {
  const preferred = document.getElementById('llm-provider').value;
  const model = document.getElementById('llm-model').value;
  const chain = [preferred, ...FALLBACK_ORDER.filter(p => p !== preferred)];

  for (const provider of chain) {
    const key = uiKeys[provider] || '';
    if (key.trim()) {
      return {
        provider,
        model: provider === preferred ? model : defaultModelFor(provider),
        apiKey: key.trim(),
        fallbackUsed: provider !== preferred,
      };
    }
  }
  return null;
}

function defaultModelFor(provider) {
  return LLM_CATALOG[provider]?.models[0]?.id || '';
}

function saveProviderPrefs() {
  localStorage.setItem('llm_provider', document.getElementById('llm-provider').value);
  localStorage.setItem('llm_model', document.getElementById('llm-model').value);
}

function loadProviderPrefs() {
  const provider = localStorage.getItem('llm_provider') || 'openrouter';
  document.getElementById('llm-provider').value = provider;
  populateModelDropdown(provider);
  const savedModel = localStorage.getItem('llm_model');
  if (savedModel) document.getElementById('llm-model').value = savedModel;
}
