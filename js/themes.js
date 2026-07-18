/* ============================================================
   DM BOARD — Theme System
   Applies CSS custom properties from campaign theme selection.
   ============================================================ */

import { state } from './state.js';

const THEME_PRESETS = {
  taberna: {
    name: 'Taberna',
    preview: 'linear-gradient(135deg, #f5f0e8 50%, #c4823e 50%)',
    description: 'Cálido y acogedor — fantasía clásica',
  },
  tormenta: {
    name: 'Tormenta',
    preview: 'linear-gradient(135deg, #e8edf2 50%, #3b6fa0 50%)',
    description: 'Metálico y táctico — ciencia ficción / moderno',
  },
  verdad: {
    name: 'Verdad',
    preview: 'linear-gradient(135deg, #f2f6f0 50%, #5b8c4e 50%)',
    description: 'Natural y sereno — campañas de naturaleza / feéricas',
  },
  sombra: {
    name: 'Sombra',
    preview: 'linear-gradient(135deg, #1a1a2e 50%, #c9a84c 50%)',
    description: 'Oscuro y dorado — gótico / horror',
  },
  fuego: {
    name: 'Fuego',
    preview: 'linear-gradient(135deg, #1e1818 50%, #d4653a 50%)',
    description: 'Ígneo e intenso — infernal / underdark',
  },
};

const THEME_CSS_VARS = [
  '--bg-primary', '--bg-secondary', '--bg-tertiary',
  '--text-primary', '--text-secondary',
  '--accent', '--accent-hover', '--danger', '--success', '--border',
];

/**
 * Apply a theme to the document root from campaign data.
 */
export function applyTheme(campaign) {
  const root = document.documentElement;
  const theme = campaign?.theme || 'taberna';

  if (theme === 'custom' && campaign?.customTheme) {
    const ct = campaign.customTheme;
    root.style.setProperty('--bg-primary', ct.bgPrimary);
    root.style.setProperty('--bg-secondary', ct.bgSecondary);
    root.style.setProperty('--bg-tertiary', ct.bgTertiary);
    root.style.setProperty('--text-primary', ct.textPrimary);
    root.style.setProperty('--text-secondary', ct.textSecondary);
    root.style.setProperty('--accent', ct.accent);
    root.style.setProperty('--accent-hover', ct.accentHover);
    root.style.setProperty('--danger', ct.danger);
    root.style.setProperty('--success', ct.success);
    root.style.setProperty('--border', ct.border);
    root.style.setProperty('--heading-font', ct.headingFont || "'Crimson Text', serif");
    root.style.setProperty('--body-font', ct.bodyFont || "'Lato', sans-serif");
    root.style.setProperty('--number-font', ct.numberFont || "'JetBrains Mono', monospace");
  } else {
    // Clear custom overrides — CSS [data-theme] handles the rest
    THEME_CSS_VARS.forEach(v => root.style.removeProperty(v));
    root.style.removeProperty('--heading-font');
    root.style.removeProperty('--body-font');
    root.style.removeProperty('--number-font');
  }

  root.setAttribute('data-theme', theme);
}

/**
 * Initialize the theme UI (swatches in the toolbar/settings).
 */
export function initThemeSystem() {
  const container = document.getElementById('theme-picker');
  if (!container) return;

  // Build theme swatches
  const swatches = Object.entries(THEME_PRESETS).map(([id, preset]) => {
    const active = state.active?.theme === id ? ' active' : '';
    return `
      <button class="theme-swatch${active}" data-theme="${id}"
              style="background:${preset.preview}" title="${preset.name}: ${preset.description}">
        ${preset.name}
      </button>
    `;
  }).join('');

  // Add custom option
  const customActive = state.active?.theme === 'custom' ? ' active' : '';

  container.innerHTML = `
    <div class="theme-grid">
      ${swatches}
      <button class="theme-swatch${customActive}" data-theme="custom"
              style="background:linear-gradient(135deg, #888 50%, #ddd 50%)"
              title="Personalizado — configura tus propios colores">
        Custom
      </button>
    </div>
    <div id="custom-theme-editor" style="display:${state.active?.theme === 'custom' ? 'block' : 'none'};margin-top:0.5rem">
      ${buildCustomEditor()}
    </div>
  `;

  // Swatch click handlers
  container.querySelectorAll('.theme-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      const themeId = btn.dataset.theme;
      state.setTheme(themeId);
      applyTheme(state.active);
      initThemeSystem(); // re-render to update active state
    });
  });

  // Custom editor handlers
  container.querySelectorAll('.custom-color-input').forEach(input => {
    input.addEventListener('input', () => {
      const colors = {};
      container.querySelectorAll('.custom-color-input').forEach(inp => {
        colors[inp.dataset.var] = inp.value;
      });
      state.setCustomTheme({
        bgPrimary: colors.bgPrimary,
        bgSecondary: colors.bgSecondary,
        bgTertiary: colors.bgTertiary,
        textPrimary: colors.textPrimary,
        textSecondary: colors.textSecondary,
        accent: colors.accent,
        accentHover: colors.accentHover,
        danger: colors.danger,
        success: colors.success,
        border: colors.border,
        headingFont: document.getElementById('custom-font-heading')?.value || '',
        bodyFont: document.getElementById('custom-font-body')?.value || '',
        numberFont: document.getElementById('custom-font-number')?.value || '',
      });
      applyTheme(state.active);
    });
  });
}

function buildCustomEditor() {
  const ct = state.active?.customTheme || {};
  const fields = [
    { id: 'bgPrimary', label: 'Fondo principal', def: '#f5f0e8' },
    { id: 'bgSecondary', label: 'Fondo secundario', def: '#ede4d3' },
    { id: 'bgTertiary', label: 'Fondo controles', def: '#e0d5c0' },
    { id: 'textPrimary', label: 'Texto principal', def: '#3d3226' },
    { id: 'textSecondary', label: 'Texto secundario', def: '#6b5d4f' },
    { id: 'accent', label: 'Acento', def: '#c4823e' },
    { id: 'accentHover', label: 'Acento hover', def: '#a0682e' },
    { id: 'danger', label: 'Peligro', def: '#c0392b' },
    { id: 'success', label: 'Curación', def: '#5d8c4a' },
    { id: 'border', label: 'Bordes', def: '#c4b59a' },
  ];

  const colorRows = fields.map(f => `
    <div class="color-picker-row">
      <label style="flex:1;font-size:0.78rem">${f.label}</label>
      <input type="color" class="custom-color-input" data-var="${f.id}" value="${ct[f.id] || f.def}">
    </div>
  `).join('');

  return `
    <div style="display:flex;flex-direction:column;gap:0.3rem">
      ${colorRows}
      <div class="modal-field" style="margin-top:0.3rem">
        <label>Fuente títulos</label>
        <input type="text" id="custom-font-heading" value="${ct.headingFont || ''}" placeholder="Georgia, serif" style="width:100%">
      </div>
      <div class="modal-field">
        <label>Fuente texto</label>
        <input type="text" id="custom-font-body" value="${ct.bodyFont || ''}" placeholder="Segoe UI, sans-serif" style="width:100%">
      </div>
      <div class="modal-field">
        <label>Fuente números</label>
        <input type="text" id="custom-font-number" value="${ct.numberFont || ''}" placeholder="JetBrains Mono, monospace" style="width:100%">
      </div>
    </div>
  `;
}
