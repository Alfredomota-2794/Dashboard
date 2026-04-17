// ============================================================
//  BGI Tools — Generador de Historias de Instagram
//  Frontend con llamadas a Claude Haiku via /api/generate
// ============================================================

const STORAGE_KEY = 'bgi_perfil_v2';

const ANGLES = {
  cta_directo: [
    'Sorpréndeme',
    'Estoy buscando',
    'Grupo de prueba',
    'Oportunidad única',
    'Resultado específico',
    'Observación personal'
  ],
  recurso_valor: [
    'Sorpréndeme',
    'Errores comunes',
    'Mini clase / Video',
    'Guía / Recurso',
    'Observación + recurso',
    'Historia personal'
  ]
};

let state = {
  profile: null,
  type: 'cta_directo',
  angle: 'Sorpréndeme'
};

// ── Inicialización ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Verificar autenticación
  document.body.style.visibility = 'hidden';
  const auth = await bgiRequireAuth(['student', 'super_admin', 'bgi_team']);
  if (!auth) return;
  document.body.style.visibility = 'visible';

  const saved = loadProfile();
  if (saved) {
    state.profile = saved;
    showGenerator();
  } else {
    showSetup();
  }
  bindEvents();
});

// ── Eventos ───────────────────────────────────────────────────
function bindEvents() {
  // Setup form
  document.getElementById('profile-form').addEventListener('submit', e => {
    e.preventDefault();
    const p = readForm();
    saveProfile(p);
    state.profile = p;
    showGenerator();
  });

  // Editar perfil
  document.getElementById('btn-edit').addEventListener('click', () => {
    fillForm(state.profile);
    show('screen-setup');
    hide('screen-generator');
  });

  // Selector de tipo
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => switchType(btn.dataset.type));
  });

  // Generar
  document.getElementById('btn-generate').addEventListener('click', generate);

  // Regenerar
  document.getElementById('btn-regen').addEventListener('click', generate);
}

// ── Pantallas ─────────────────────────────────────────────────
function showSetup() {
  show('screen-setup');
  hide('screen-generator');
}

function showGenerator() {
  hide('screen-setup');
  show('screen-generator');
  updateHeader();
  renderAngleChips();
  hideResult();
}

// ── Perfil ────────────────────────────────────────────────────
function readForm() {
  return {
    nombre:        v('f-nombre'),
    audiencia:     v('f-audiencia'),
    nicho:         v('f-nicho'),
    tema:          v('f-tema'),
    transformacion: v('f-transformacion'),
    resultado:     v('f-resultado'),
    beneficio:     v('f-beneficio'),
    nombre_curso:  v('f-nombre_curso'),
    recurso:       v('f-recurso'),
    palabra_clave: v('f-palabra_clave').toUpperCase()
  };
}

function fillForm(p) {
  Object.keys(p).forEach(k => {
    const el = document.getElementById('f-' + k);
    if (el) el.value = p[k];
  });
}

function saveProfile(p)  { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }
function loadProfile()   {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}

function updateHeader() {
  const p = state.profile;
  document.getElementById('gen-avatar').textContent = p.nombre?.charAt(0).toUpperCase() || '?';
  document.getElementById('gen-name').textContent   = p.nombre || '—';
  document.getElementById('gen-detail').textContent = [p.nicho, p.tema].filter(Boolean).join(' · ');
}

// ── Tipo de historia ──────────────────────────────────────────
function switchType(type) {
  state.type  = type;
  state.angle = 'Sorpréndeme';

  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.className = 'type-btn';
    if (btn.dataset.type === type) {
      btn.classList.add(type === 'cta_directo' ? 'active-cta' : 'active-recurso');
    }
  });

  toggle('tip-cta',    type === 'cta_directo');
  toggle('tip-recurso', type === 'recurso_valor');

  renderAngleChips();
  hideResult();
}

// ── Ángulos ───────────────────────────────────────────────────
function renderAngleChips() {
  const container = document.getElementById('angle-chips');
  container.innerHTML = ANGLES[state.type].map(a => `
    <button class="angle-chip ${a === state.angle ? 'selected' : ''}" data-angle="${a}">
      ${a === 'Sorpréndeme' ? '✨ ' : ''}${a}
    </button>`
  ).join('');

  container.querySelectorAll('.angle-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.angle = chip.dataset.angle;
      renderAngleChips();
    });
  });
}

// ── Generación con IA ─────────────────────────────────────────
async function generate() {
  if (!state.profile) return;

  hideResult();
  hideError();
  showLoading();
  setGenerateDisabled(true);

  try {
    const token = await bgiGetToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        profile: state.profile,
        type:    state.type,
        angle:   state.angle
      })
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      const msg = typeof data.error === 'string' ? data.error : 'Error al generar. Intenta de nuevo.';
      throw new Error(msg);
    }

    hideLoading();
    displayResult(data.text);

  } catch (err) {
    hideLoading();
    showError(err.message || 'Error de conexión. Verifica tu internet e intenta de nuevo.');
  } finally {
    setGenerateDisabled(false);
  }
}

// ── Mostrar resultado ─────────────────────────────────────────
function displayResult(rawText) {
  const container  = document.getElementById('stories-container');
  const typeLabel  = state.type === 'cta_directo' ? 'CTA Directo' : 'Recurso de Valor';
  const angleLabel = state.angle !== 'Sorpréndeme' ? ` · ${state.angle}` : '';
  document.getElementById('result-title').textContent = `${typeLabel}${angleLabel}`;

  let stories;

  if (state.type === 'cta_directo') {
    stories = [{ label: 'Historia', role: 'Lista para copiar', text: rawText.trim() }];
  } else {
    // Separar las 2 historias del Recurso de Valor
    const parts = rawText.split(/---HISTORIA2---/i);
    stories = [
      { label: 'Historia 1', role: 'Genera curiosidad — sube primero', text: parts[0].trim() },
      { label: 'Historia 2', role: 'Ofrece el recurso — sube inmediatamente después', text: (parts[1] || '').trim() }
    ];
  }

  container.innerHTML = stories.map((s, i) => `
    <div class="story-card" style="margin-bottom:${i < stories.length - 1 ? '16px' : '0'}">
      <div class="story-card-header">
        <span class="story-card-label">${s.label}</span>
        <span class="story-card-role">${s.role}</span>
      </div>
      <div class="story-text" id="story-text-${i}">${escHtml(s.text)}</div>
      <button class="btn-copy-story" data-index="${i}">📋 Copiar esta historia</button>
    </div>`
  ).join('');

  container.querySelectorAll('.btn-copy-story').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx  = parseInt(btn.dataset.index);
      const text = stories[idx].text;
      copyText(text, btn);
    });
  });

  document.getElementById('result-section').classList.add('visible');
}

// ── Utilidades de UI ──────────────────────────────────────────
function showLoading()  { document.getElementById('loading-state').classList.add('visible'); }
function hideLoading()  { document.getElementById('loading-state').classList.remove('visible'); }
function hideResult()   { document.getElementById('result-section').classList.remove('visible'); document.getElementById('stories-container').innerHTML = ''; }
function showError(msg) { document.getElementById('error-text').textContent = msg; document.getElementById('error-card').classList.add('visible'); }
function hideError()    { document.getElementById('error-card').classList.remove('visible'); }

function setGenerateDisabled(val) {
  const btn = document.getElementById('btn-generate');
  btn.disabled = val;
  btn.textContent = val ? '⏳ Generando...' : '✨ Generar historia con IA';
}

function show(id)   { document.getElementById(id)?.classList.remove('hidden'); }
function hide(id)   { document.getElementById(id)?.classList.add('hidden'); }
function toggle(id, visible) { visible ? show(id) : hide(id); }
function v(id)      { return document.getElementById(id)?.value.trim() || ''; }

function escHtml(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

// ── Copiar al portapapeles ────────────────────────────────────
let toastTimer = null;

function copyText(text, btn) {
  const clean = text.replace(/<br\s*\/?>/gi, '\n').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');

  const success = () => {
    showToast();
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = '✓ Copiado';
      btn.classList.add('copied');
      setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('copied'); }, 2000);
    }
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(clean).then(success).catch(() => fallback(clean, success));
  } else {
    fallback(clean, success);
  }
}

function fallback(text, onSuccess) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  try { document.execCommand('copy'); onSuccess(); } catch {}
  document.body.removeChild(ta);
}

function showToast() {
  const t = document.getElementById('toast');
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
