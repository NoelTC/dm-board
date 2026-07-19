/**
 * i18n.js — Internationalization system for DM Board
 *
 * HOW TO ADD A NEW STRING:
 *   1. Add the key+value to both `es` and `en` objects below.
 *   2. Use `t('your.key')` anywhere in JS to get the current-language string.
 *   3. For static HTML elements, add data-i18n="your.key" attribute and
 *      call applyI18n() (already called automatically on language change).
 *
 * HOW TO SWITCH LANGUAGE: call setLanguage('en') or setLanguage('es').
 */

const STORAGE_KEY = 'dmboard_lang';

const translations = {
  es: {
    /* ---- Page / Header ---- */
    'page.title':              'DM Board — Tablero de Combate',
    'header.new_campaign':     'Nueva campaña',
    'header.rename_campaign':  'Renombrar',
    'header.delete_campaign':  'Eliminar campaña',
    'header.change_theme':     'Cambiar tema',
    'header.lang_toggle':      'EN',

    /* ---- Board empty state ---- */
    'board.empty.hint':        'Añade criaturas con el botón <strong>"+ Criatura"</strong>',

    /* ---- Toolbar ---- */
    'toolbar.add_token':       '＋ Criatura',
    'toolbar.expand':          '⤢ Expandir',
    'toolbar.compact':         '⊡ Compactar',
    'toolbar.hint':            '✎ editar • ⤢ click en imagen',

    /* ---- Sidebar tabs ---- */
    'tab.combat':              '⚔️ Combate',
    'tab.prep':                '🗺️ Prep & Almacén',

    /* ---- Theme panel ---- */
    'theme.title':             '🎨 Tema de Campaña',

    /* ---- Players panel ---- */
    'players.title':           '👥 Jugadores',
    'players.empty':           'Sin jugadores.',
    'players.add':             '＋ Añadir Jugador',
    'players.prompt.name':     'Nombre del jugador:',
    'players.prompt.hp':       'Vida máxima:',
    'players.prompt.ac':       'CA:',
    'players.confirm.delete':  '¿Eliminar jugador?',
    'players.default_name':    'Jugador',

    /* ---- Initiative panel ---- */
    'initiative.title':        '⚔️ Iniciativa',
    'initiative.round':        'Ronda',
    'initiative.generate':     '🎲 Generar',
    'initiative.clear':        '✕ Limpiar',
    'initiative.empty':        'Sin criaturas en el tablero.',
    'initiative.tip':          'Pulsa ESPACIO para avanzar turno.',
    'initiative.prompt.set':   'Iniciativa de',
    'initiative.prompt.edit':  'Modificar iniciativa de',
    'initiative.confirm.clear':'¿Limpiar iniciativa?',
    'initiative.hp_label':     'HP:',
    'initiative.badge.player': 'PJ',
    'initiative.badge.npc':    'PNJ',

    /* ---- Locations panel ---- */
    'locations.title':         '🗺️ Localizaciones',
    'locations.add':           '＋ Nueva Localización',
    'locations.rename_title':  'Renombrar',
    'locations.delete_title':  'Eliminar',
    'locations.prompt.rename': 'Nuevo nombre de la localización:',
    'locations.prompt.new':    'Nombre de la nueva localización:',
    'locations.default_name':  'Nueva Localización',
    'locations.confirm.delete':'¿Eliminar la localización "{name}" y todas sus criaturas?',

    /* ---- Vault panel ---- */
    'vault.title':             '📁 Almacén de Criaturas',
    'vault.empty':             'El almacén está vacío. Guarda criaturas desde el tablero o crea plantillas.',
    'vault.add_preset':        '＋ Crear Nueva Plantilla',
    'vault.spawn_title':       'Añadir al Tablero',
    'vault.delete_title':      'Eliminar',
    'vault.confirm.delete':    '¿Eliminar la plantilla de "{name}" del almacén?',
    'vault.saved_alert':       '"{name}" guardado en el Almacén.',

    /* ---- Token Editor Modal ---- */
    'modal.new_creature':      'Nueva Criatura',
    'modal.edit_creature':     'Editar Criatura',
    'modal.new_preset':        'Nueva Plantilla de Almacén',
    'modal.edit_preset':       'Editar Plantilla de Almacén',
    'modal.label.name':        'Nombre',
    'modal.label.image':       'Imagen',
    'modal.label.hp':          'Vida Máx',
    'modal.label.ac':          'CA',
    'modal.label.init':        'Mod. Iniciativa',
    'modal.label.count':       'Cantidad',
    'modal.placeholder.name':  'Goblin, Dragón...',
    'modal.upload_hint':       'Click para subir (PNG, JPG)',
    'modal.read_sheet':        '🔍 Leer estadísticas automáticamente',
    'modal.reading':           '⏳ Leyendo ficha…',
    'modal.read_error':        '❌ Error al leer — ¿Ollama en marcha?',
    'modal.remove_image':      'Quitar imagen',
    'modal.cancel':            'Cancelar',
    'modal.save':              'Guardar',
    'modal.add':               'Añadir',
    'modal.error.no_name':     'La criatura necesita nombre.',
    'modal.only_images':       'Solo se aceptan archivos de imagen (PNG, JPG, etc.)',

    /* ---- Campaign Manager ---- */
    'campaign.no_campaigns':   '— Sin campañas —',
    'campaign.prompt.new':     'Nombre de la nueva campaña:',
    'campaign.default_name':   'Nueva Campaña',
    'campaign.confirm.delete': '¿Eliminar "{name}"?',
    'campaign.prompt.rename':  'Nuevo nombre:',

    /* ---- Board token panel ---- */
    'token.hp_label':          'HP',
    'token.ac_label':          'CA',
    'token.edit_title':        'Editar',
    'token.save_vault_title':  'Guardar en Almacén',
  },

  en: {
    /* ---- Page / Header ---- */
    'page.title':              'DM Board — Combat Tracker',
    'header.new_campaign':     'New campaign',
    'header.rename_campaign':  'Rename',
    'header.delete_campaign':  'Delete campaign',
    'header.change_theme':     'Change theme',
    'header.lang_toggle':      'ES',

    /* ---- Board empty state ---- */
    'board.empty.hint':        'Add creatures with the <strong>"+ Creature"</strong> button',

    /* ---- Toolbar ---- */
    'toolbar.add_token':       '＋ Creature',
    'toolbar.expand':          '⤢ Expand',
    'toolbar.compact':         '⊡ Compact',
    'toolbar.hint':            '✎ edit • ⤢ click image',

    /* ---- Sidebar tabs ---- */
    'tab.combat':              '⚔️ Combat',
    'tab.prep':                '🗺️ Prep & Vault',

    /* ---- Theme panel ---- */
    'theme.title':             '🎨 Campaign Theme',

    /* ---- Players panel ---- */
    'players.title':           '👥 Players',
    'players.empty':           'No players.',
    'players.add':             '＋ Add Player',
    'players.prompt.name':     'Player name:',
    'players.prompt.hp':       'Max HP:',
    'players.prompt.ac':       'AC:',
    'players.confirm.delete':  'Delete player?',
    'players.default_name':    'Player',

    /* ---- Initiative panel ---- */
    'initiative.title':        '⚔️ Initiative',
    'initiative.round':        'Round',
    'initiative.generate':     '🎲 Roll',
    'initiative.clear':        '✕ Clear',
    'initiative.empty':        'No creatures on the board.',
    'initiative.tip':          'Press SPACE to advance turn.',
    'initiative.prompt.set':   'Initiative for',
    'initiative.prompt.edit':  'Edit initiative for',
    'initiative.confirm.clear':'Clear initiative?',
    'initiative.hp_label':     'HP:',
    'initiative.badge.player': 'PC',
    'initiative.badge.npc':    'NPC',

    /* ---- Locations panel ---- */
    'locations.title':         '🗺️ Locations',
    'locations.add':           '＋ New Location',
    'locations.rename_title':  'Rename',
    'locations.delete_title':  'Delete',
    'locations.prompt.rename': 'New location name:',
    'locations.prompt.new':    'New location name:',
    'locations.default_name':  'New Location',
    'locations.confirm.delete':'Delete location "{name}" and all its creatures?',

    /* ---- Vault panel ---- */
    'vault.title':             '📁 Creature Vault',
    'vault.empty':             'The vault is empty. Save creatures from the board or create templates.',
    'vault.add_preset':        '＋ Create New Template',
    'vault.spawn_title':       'Add to Board',
    'vault.delete_title':      'Delete',
    'vault.confirm.delete':    'Delete template "{name}" from the vault?',
    'vault.saved_alert':       '"{name}" saved to the Vault.',

    /* ---- Token Editor Modal ---- */
    'modal.new_creature':      'New Creature',
    'modal.edit_creature':     'Edit Creature',
    'modal.new_preset':        'New Vault Template',
    'modal.edit_preset':       'Edit Vault Template',
    'modal.label.name':        'Name',
    'modal.label.image':       'Image',
    'modal.label.hp':          'Max HP',
    'modal.label.ac':          'AC',
    'modal.label.init':        'Init Modifier',
    'modal.label.count':       'Count',
    'modal.placeholder.name':  'Goblin, Dragon...',
    'modal.upload_hint':       'Click to upload (PNG, JPG)',
    'modal.read_sheet':        '🔍 Read stats automatically',
    'modal.reading':           '⏳ Reading stat block…',
    'modal.read_error':        '❌ Read error — Is Ollama running?',
    'modal.remove_image':      'Remove image',
    'modal.cancel':            'Cancel',
    'modal.save':              'Save',
    'modal.add':               'Add',
    'modal.error.no_name':     'Creature needs a name.',
    'modal.only_images':       'Only image files are accepted (PNG, JPG, etc.)',

    /* ---- Campaign Manager ---- */
    'campaign.no_campaigns':   '— No campaigns —',
    'campaign.prompt.new':     'New campaign name:',
    'campaign.default_name':   'New Campaign',
    'campaign.confirm.delete': 'Delete "{name}"?',
    'campaign.prompt.rename':  'New name:',

    /* ---- Board token panel ---- */
    'token.hp_label':          'HP',
    'token.ac_label':          'AC',
    'token.edit_title':        'Edit',
    'token.save_vault_title':  'Save to Vault',
  }
};

// ---- Runtime state ----
let _lang = localStorage.getItem(STORAGE_KEY) || 'es';
const _listeners = [];

/** Get current language code */
export function getLang() { return _lang; }

/**
 * Translate a key. Supports {name} interpolation.
 * @param {string} key
 * @param {Object} [vars] - e.g. { name: 'Goblin' }
 */
export function t(key, vars = {}) {
  const dict = translations[_lang] || translations.es;
  let str = dict[key] ?? translations.es[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(`{${k}}`, v);
  }
  return str;
}

/**
 * Switch language and re-apply all data-i18n elements.
 * Notifies all registered listeners.
 */
export function setLanguage(lang) {
  if (!translations[lang]) return;
  _lang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  document.documentElement.lang = lang;
  applyI18n();
  _listeners.forEach(fn => fn(lang));
}

/** Register a callback to be called whenever the language changes */
export function onLangChange(fn) { _listeners.push(fn); }

/**
 * Apply translations to all elements with data-i18n attribute.
 * Supports:
 *   data-i18n="key"           → element.textContent
 *   data-i18n-html="key"      → element.innerHTML (for strings with <strong> etc.)
 *   data-i18n-title="key"     → element.title
 *   data-i18n-placeholder="key" → element.placeholder
 *   data-i18n-aria="key"      → element.setAttribute('aria-label', ...)
 */
export function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });
  // Update page title
  document.title = t('page.title');
}
