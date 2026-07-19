/* ============================================================
   DM BOARD — Main Application
   Surgical DOM updates. HP delta input. Global image toggle.
   ============================================================ */

import { state, saveImage } from './state.js';
import { uid, clamp } from './utils.js';
import { renderBoard, clearBoardCache, removeTokenFromCache, toggleAllTokenImages } from './board.js';
import { initThemeSystem, applyTheme } from './themes.js';
import { t, getLang, setLanguage, applyI18n } from './i18n.js';

const $ = (s) => document.querySelector(s);

/* ---- Turn Timer ---- */
let _turnTimer = null;   // { intervalId, remaining, paused }
const TURN_SECONDS = 60;

function _startTurnTimer() {
  _stopTurnTimer(); // clear any existing
  _turnTimer = { remaining: TURN_SECONDS, paused: false, intervalId: null };
  _turnTimer.intervalId = setInterval(() => {
    if (_turnTimer.paused) return;
    _turnTimer.remaining--;
    _updateTimerDisplay();
    if (_turnTimer.remaining <= 0) {
      _stopTurnTimer();
      state.nextTurn();
      state._save(); state._notify();
      renderAll();
      _startTurnTimer();
    }
  }, 1000);
  _updateTimerDisplay();
}

function _stopTurnTimer() {
  if (_turnTimer?.intervalId) clearInterval(_turnTimer.intervalId);
  _turnTimer = null;
  _updateTimerDisplay();
}

function _togglePauseTimer() {
  if (!_turnTimer) return;
  _turnTimer.paused = !_turnTimer.paused;
  _updateTimerDisplay();
}

function _resetTurnTimer() {
  _stopTurnTimer();
  _startTurnTimer();
}

function _updateTimerDisplay() {
  const el = document.getElementById('turn-timer');
  if (!el) return;
  if (!_turnTimer) {
    el.textContent = '⏱ --:--';
    el.className = 'turn-timer';
    return;
  }
  const m = Math.floor(_turnTimer.remaining / 60);
  const s = _turnTimer.remaining % 60;
  el.textContent = `⏱ ${m}:${String(s).padStart(2, '0')}`;
  el.className = 'turn-timer' +
    (_turnTimer.remaining <= 10 ? ' urgent' : '') +
    (_turnTimer.paused ? ' paused' : '');
}

/* ---- Campaign Manager ---- */

/* ---- Ollama OCR (reusable) ---- */

/**
 * Call Ollama vision model to read a stat block image.
 * @param {File} file - Image file
 * @returns {Promise<{name:string, hp:number, ac:number, modifiers:number[], initMod:number}|null>}
 */
async function ocrStatBlock(file) {
  const b64 = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  const prompt_text = `Look at this tabletop RPG monster stat block image carefully.

TASK 1 - Find these lines and extract the numbers:
- NAME: The large bold title at the very top of the card.
- HP: The line that says "Hit Points" or "Puntos de Golpe". Take only the FIRST integer before any parenthesis. Example: "Hit Points 55 (10d8 + 10)" → 55
- AC: The line that says "Armor Class" or "Clase de Armadura". Take only the first integer. Example: "Armor Class 12 (Sin armadura)" → 12

TASK 2 - Find the ability scores table:
The table always has exactly 6 columns in this order: STR | DEX | CON | INT | WIS | CHA
Under each column header there is a score and a modifier in parentheses.
Example row: "11 (+0)  14 (+2)  12 (+1)  20 (+5)  16 (+3)  20 (+5)"
List all 6 modifiers in order as integers (drop the + sign, keep the - sign):
modifiers: [0, 2, 1, 5, 3, 5]
The DEX modifier is always the SECOND value in that list.

Respond with ONLY this JSON, no explanation:
{"name":"...","hp":0,"ac":0,"modifiers":[str,dex,con,int,wis,cha]}`;

  const resp = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemma4',
      prompt: prompt_text,
      images: [b64],
      stream: false
    })
  });

  if (!resp.ok) throw new Error(`Ollama error ${resp.status}`);
  const data = await resp.json();
  const raw = data.response || '';

  // Robust parser: try JSON first, then regex fallback
  let stats = null;
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    const match = clean.match(/\{[\s\S]*?\}/);
    if (match) stats = JSON.parse(match[0]);
  } catch { /* fallback below */ }

  if (!stats) {
    stats = {};
    const nameM = raw.match(/"name"\s*:\s*"([^"]+)"/);
    const hpM   = raw.match(/"hp"\s*:\s*(-?\d+)/);
    const acM   = raw.match(/"ac"\s*:\s*(-?\d+)/);
    if (nameM) stats.name = nameM[1];
    if (hpM)   stats.hp   = parseInt(hpM[1]);
    if (acM)   stats.ac   = parseInt(acM[1]);
    const modsM = raw.match(/"modifiers"\s*:\s*\[([^\]]+)\]/);
    if (modsM) {
      const mods = modsM[1].split(',').map(v => parseInt(v.trim()));
      if (mods.length >= 2) stats.modifiers = mods;
    }
  }

  if (!stats) throw new Error('Could not parse response');

  // DEX is always index 1 in [STR, DEX, CON, INT, WIS, CHA]
  if (Array.isArray(stats.modifiers) && stats.modifiers.length >= 2) {
    stats.initMod = stats.modifiers[1];
  } else if (typeof stats.initMod !== 'number') {
    stats.initMod = undefined;
  }

  return stats;
}

/* ---- Campaign Manager ---- */
function initCampaignManager() {
  const select = $('#campaign-select');
  const populate = () => {
    if (!select) return;
    select.innerHTML = '';
    state.campaigns.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = c.name;
      if (c.id === state.activeId) o.selected = true;
      select.appendChild(o);
    });
    if (!state.campaigns.length) {
      const o = document.createElement('option');
      o.textContent = t('campaign.no_campaigns'); o.disabled = true;
      select.appendChild(o);
    }
  };

  select?.addEventListener('change', () => {
    if (select.value) { clearBoardCache(); state.switchCampaign(select.value); renderAll(); }
  });

  $('#btn-new-campaign')?.addEventListener('click', () => {
    const n = prompt(t('campaign.prompt.new'), t('campaign.default_name'));
    if (n?.trim()) { state.createCampaign(n.trim()); populate(); renderAll(); }
  });
  $('#btn-delete-campaign')?.addEventListener('click', () => {
    const c = state.active; if (!c) return;
    if (confirm(t('campaign.confirm.delete', { name: c.name }))) {
      state.deleteCampaign(c.id); populate(); renderAll();
    }
  });
  $('#btn-rename-campaign')?.addEventListener('click', () => {
    const c = state.active; if (!c) return;
    const n = prompt(t('campaign.prompt.rename'), c.name);
    if (n?.trim()) { c.name = n.trim(); state.switchCampaign(c.id); populate(); }
  });

  state.onChange(() => populate());
  populate();
}

/* ---- Token Editor Modal ---- */
function showTokenEditor(existing = null, preloadedFile = null, isVaultPreset = false) {
  const ov = document.createElement('div'); ov.className = 'modal-overlay';
  const isEdit = !!existing;
  let prev = '';
  if (isEdit && existing.imgDataUrl) prev = `<img src="${existing.imgDataUrl}" alt="preview">`;
  if (preloadedFile) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = ov.querySelector('#m-upload img');
      if (img) img.src = reader.result;
      else { const ua = ov.querySelector('#m-upload'); if (ua) ua.innerHTML = `<img src="${reader.result}" alt="preview">`; }
    };
    reader.readAsDataURL(preloadedFile);
  }

  // Determine modal title
  let modalTitle;
  if (isVaultPreset) {
    modalTitle = isEdit ? t('modal.edit_preset') : t('modal.new_preset');
  } else {
    modalTitle = isEdit ? t('modal.edit_creature') : t('modal.new_creature');
  }

  ov.innerHTML = `<div class="modal-panel">
    <h2>${modalTitle}</h2>
    <div class="modal-field"><label>${t('modal.label.name')}</label><input type="text" id="m-name" value="${isEdit ? esc(existing.name) : ''}" placeholder="${t('modal.placeholder.name')}"></div>
    <div class="modal-field"><label>${t('modal.label.image')}</label>
      <div class="image-upload-area" id="m-upload">${prev || t('modal.upload_hint')}</div>
      <input type="file" id="m-file" accept="image/*" style="display:none">
      <button class="btn btn-sm btn-accent" id="m-read-sheet" style="width:100%;margin-top:0.4rem;display:none">${t('modal.read_sheet')}</button>
      ${isEdit && existing.imgDataUrl ? `<button class="btn btn-sm btn-secondary" id="m-rmimg">${t('modal.remove_image')}</button>` : ''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">
      <div class="modal-field"><label>${t('modal.label.hp')}</label><input type="number" id="m-hp" value="${isEdit ? existing.maxHp : 30}" min="1"></div>
      <div class="modal-field"><label>${t('modal.label.ac')}</label><input type="number" id="m-ac" value="${isEdit ? existing.ac : 12}" min="0"></div>
      <div class="modal-field"><label>${t('modal.label.init')}</label><input type="number" id="m-init" value="${isEdit ? (existing.initMod ?? 0) : 0}" min="-5" max="10"></div>
      ${isVaultPreset ? '' : `<div class="modal-field"><label>${t('modal.label.count')}</label><input type="number" id="m-ct" value="${isEdit ? existing.count : 1}" min="1"></div>`}
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" id="m-cancel">${t('modal.cancel')}</button>
      <button class="btn btn-primary" id="m-save">${isEdit ? t('modal.save') : t('modal.add')}</button>
    </div>
  </div>`;
  document.body.appendChild(ov);

  const fi = ov.querySelector('#m-file');
  const readBtn = ov.querySelector('#m-read-sheet');
  let sf = preloadedFile || null;

  // Show read button if preloaded file exists
  if (preloadedFile && readBtn) readBtn.style.display = 'block';

  ov.querySelector('#m-upload')?.addEventListener('click', () => fi.click());

  fi.addEventListener('change', () => {
    sf = fi.files[0];
    if (sf) {
      const r = new FileReader();
      r.onload = () => { ov.querySelector('#m-upload').innerHTML = `<img src="${r.result}" alt="preview">`; };
      r.readAsDataURL(sf);
      if (readBtn) readBtn.style.display = 'block';
    }
  });

  // Ollama Vision - read stat block (uses extracted ocrStatBlock)
  readBtn?.addEventListener('click', async () => {
    if (!sf) return;
    readBtn.disabled = true;
    readBtn.textContent = t('modal.reading');

    try {
      const stats = await ocrStatBlock(sf);

      if (stats.name)  ov.querySelector('#m-name').value = stats.name;
      if (stats.hp)    ov.querySelector('#m-hp').value = stats.hp;
      if (stats.ac)    ov.querySelector('#m-ac').value = stats.ac;
      if (stats.initMod !== null && stats.initMod !== undefined)
        ov.querySelector('#m-init').value = stats.initMod;

      // Show what was detected
      const initLabel = stats.initMod >= 0 ? `+${stats.initMod}` : `${stats.initMod}`;
      const detected = [
        stats.name    ? `📛 ${stats.name}` : null,
        stats.hp      ? `❤️ ${stats.hp}` : null,
        stats.ac      ? `🛡️ ${stats.ac}` : null,
        stats.initMod !== undefined ? `⚡ Ini ${initLabel}` : null,
      ].filter(Boolean).join('  ');

      readBtn.textContent = `✅ ${detected}`;
      readBtn.style.background = 'var(--success, #22c55e)';
      setTimeout(() => {
        readBtn.textContent = t('modal.read_sheet');
        readBtn.style.background = '';
        readBtn.disabled = false;
      }, 4000);
    } catch (err) {
      console.error('OCR error:', err);
      readBtn.disabled = false;
      readBtn.textContent = t('modal.read_error');
      setTimeout(() => { readBtn.textContent = t('modal.read_sheet'); }, 3000);
    }
  });

  ov.querySelector('#m-cancel')?.addEventListener('click', () => ov.remove());
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  ov.querySelector('#m-rmimg')?.addEventListener('click', () => {
    sf = null;
    ov.querySelector('#m-upload').innerHTML = t('modal.upload_hint');
    if (readBtn) readBtn.style.display = 'none';
    if (isEdit) { existing.imgDataUrl = null; existing.imageId = null; }
  });

  ov.querySelector('#m-save')?.addEventListener('click', async () => {
    const name = ov.querySelector('#m-name').value.trim();
    if (!name) { alert(t('modal.error.no_name')); return; }
    const hp = parseInt(ov.querySelector('#m-hp').value) || 30;
    const ac = parseInt(ov.querySelector('#m-ac').value) || 12;
    const initMod = parseInt(ov.querySelector('#m-init').value) || 0;
    const ct = isVaultPreset ? 1 : (parseInt(ov.querySelector('#m-ct').value) || 1);

    if (isVaultPreset) {
      await state.addPresetToVault({ name, maxHp: hp, ac, initMod, imageFile: sf });
    } else if (isEdit) {
      Object.assign(existing, { name, maxHp: hp, hp: Math.min(existing.hp, hp), ac, initMod, count: ct });
      if (sf) {
        const { compressImage } = await import('./utils.js');
        try { const c = await compressImage(sf); existing.imgDataUrl = c.dataUrl; } catch(e) {}
      }
      state.updateToken(existing.id, existing);
    } else {
      await state.addToken({ name, imageFile: sf, maxHp: hp, ac, initMod, count: ct });
    }
    ov.remove(); renderAll();
  });
}


/* ---- Players ---- */
function renderPlayers() {
  const c = state.active; const panel = $('#players-panel');
  if (!c) return;

  let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem">
    <h3 style="margin:0">${t('players.title')}</h3></div><div id="player-list">`;

  if (!c.players.length) html += `<div style="color:var(--text-secondary);font-size:0.85rem;padding:0.5rem">${t('players.empty')}</div>`;

  c.players.forEach(p => {
    html += `<div class="player-row" data-id="${p.id}">
      <span class="player-name">${esc(p.name)}</span>
      <div class="hp-controls">
        <button class="btn btn-sm btn-danger hp-down" data-pid="${p.id}">−</button>
        <input type="number" class="token-hp-input stat-number ${p.hp <= p.maxHp * 0.25 ? 'hp-low' : ''}"
               value="${p.hp}" data-pid="${p.id}" data-act="php" data-delta="1" min="0" max="${p.maxHp}">
        <span class="token-hp-max">/ ${p.maxHp}</span>
        <button class="btn btn-sm btn-success hp-up" data-pid="${p.id}">＋</button>
      </div>
      <span style="font-size:0.8rem;color:var(--text-secondary)">${t('token.ac_label')} ${p.ac}</span>
      <button class="btn btn-sm btn-danger" data-del="${p.id}" title="${t('header.delete_campaign')}">×</button>
    </div>`;
  });
  html += `</div><button class="btn btn-sm btn-secondary" id="btn-add-p" style="margin-top:0.4rem;width:100%">${t('players.add')}</button>`;
  panel.innerHTML = html;

  const addP = () => {
    const n = prompt(t('players.prompt.name'), t('players.default_name'));
    if (!n?.trim()) return;
    state.addPlayer({
      name: n.trim(),
      maxHp: parseInt(prompt(t('players.prompt.hp'), '30')) || 30,
      ac: parseInt(prompt(t('players.prompt.ac'), '14')) || 14
    });
    renderPlayers();
  };
  panel.querySelector('#btn-add-p')?.addEventListener('click', addP);

  panel.querySelectorAll('.hp-up').forEach(b => {
    b.addEventListener('click', () => playerDelta(b.dataset.pid, 1));
  });
  panel.querySelectorAll('.hp-down').forEach(b => {
    b.addEventListener('click', () => playerDelta(b.dataset.pid, -1));
  });
  panel.querySelectorAll('[data-act="php"]').forEach(inp => {
    inp.addEventListener('input', () => {
      const v = parseInt(inp.value); const pid = inp.dataset.pid;
      if (!isNaN(v)) state.updatePlayer(pid, { hp: clamp(v, 0, 999) });
    });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { inp.dataset.delta = inp.value; inp.blur(); } });
  });
  panel.querySelectorAll('[data-del]').forEach(b => {
    b.addEventListener('click', () => {
      if (confirm(t('players.confirm.delete'))) { state.removePlayer(b.dataset.del); renderAll(); }
    });
  });
}

function playerDelta(pid, dir) {
  const c = state.active; if (!c) return;
  const p = c.players.find(pl => pl.id === pid); if (!p) return;
  const inp = document.querySelector(`[data-pid="${pid}"][data-act="php"]`);
  const d = inp ? (parseInt(inp.dataset.delta) || 1) : 1;
  const newHp = p.hp + dir * d;

  if (newHp <= 0) {
    const excess = Math.abs(newHp);
    if (excess > p.maxHp / 2) {
      // Instant death
      state.updatePlayer(pid, { hp: 0 });
      // Also mark initiative entry as dead
      c.initiative.forEach(e => {
        if (e.refId === pid && e.type === 'player') { e.isDead = true; e.hp = 0; }
      });
    } else {
      state.updatePlayer(pid, { hp: 0 });
      // Init death saves in initiative entry if present
      c.initiative.forEach(e => {
        if (e.refId === pid && e.type === 'player' && !e.isDead) {
          e.hp = 0;
          if (!e.deathSaves) e.deathSaves = { successes: 0, failures: 0 };
        }
      });
    }
  } else {
    state.updatePlayer(pid, { hp: Math.min(newHp, p.maxHp) });
    // Clear death saves if healed
    c.initiative.forEach(e => {
      if (e.refId === pid && e.type === 'player') {
        e.hp = Math.min(newHp, p.maxHp);
        if (e.deathSaves) delete e.deathSaves;
      }
    });
  }
  renderAll();
}

/* ---- Initiative ---- */
function renderInitiative() {
  const c = state.active; const panel = $('#initiative-panel');
  if (!c) return;

  let html = `<div class="initiative-header"><h3 style="margin:0">${t('initiative.title')}</h3>
    ${c.round > 0 ? `<span class="round-counter">${t('initiative.round')} ${c.round}</span>` : ''}</div>
    <div class="turn-timer-row">
      <span class="turn-timer" id="turn-timer">⏱ --:--</span>
      ${c.initiative.length ? `<div class="timer-controls">
        <button class="btn btn-sm btn-secondary" id="btn-timer-pause" title="${t('timer.pause')}">⏯</button>
        <button class="btn btn-sm btn-secondary" id="btn-timer-reset" title="${t('timer.reset')}">🔄</button>
      </div>` : ''}
    </div>`;

  if (!c.initiative.length) {
    html += `<div style="color:var(--text-secondary);font-size:0.85rem;padding:0.5rem;text-align:center">${t('initiative.empty')}</div>`;
  } else {
    html += '<ul class="initiative-list">';
    c.initiative.forEach((e, i) => {
      const active = i === c.activeTurnIndex ? ' active-turn' : '';
      const deadClass = e.isDead ? ' dead' : '';
      const hpPct = e.maxHp > 0 ? (e.hp / e.maxHp) : 0;
      let hpStatus = 'hp-healthy';
      if (e.isDead) hpStatus = 'hp-dead';
      else if (hpPct <= 0.25) hpStatus = 'hp-critical';
      else if (hpPct <= 0.5) hpStatus = 'hp-injured';
      const widthPct = Math.max(0, Math.min(100, hpPct * 100));
      const badge = e.type === 'player' ? t('initiative.badge.player') : t('initiative.badge.npc');

      html += `<li class="initiative-entry${active}${deadClass}" data-eid="${e.id}">
        <div class="init-row-main">
          <div class="init-left">
            <span class="initiative-roll">${e.isDead ? '💀' : e.roll}</span>
            <span class="initiative-name" title="${esc(e.name)}">${esc(e.name)}</span>
            <span class="init-badge ${e.type}">${e.isDead ? '💀' : badge}</span>
          </div>
          <div class="init-right">
            <span class="initiative-ac">🛡️ ${e.ac}</span>
          </div>
        </div>
        <div class="init-row-hp">
          ${_renderInitiativeHpRow(e)}
        </div>
      </li>`;
    });
    html += '</ul>';
  }

  html += `<div class="initiative-controls" style="margin-top:0.5rem">
    <button class="btn btn-primary" id="btn-gen">${t('initiative.generate')}</button>
    ${c.initiative.length ? `<div style="display:flex;gap:0.3rem;margin-top:0.3rem">
      <button class="btn btn-secondary" id="btn-prev">◀</button>
      <button class="btn btn-primary" id="btn-next" style="flex:1">▶</button>
      <button class="btn btn-sm btn-secondary" id="btn-clr">${t('initiative.clear')}</button>
    </div>` : ''}
  </div>`;
  panel.innerHTML = html;

  panel.querySelector('#btn-gen')?.addEventListener('click', () => {
    state.generateInitiative();
    c.initiative.forEach(e => {
      if (e.type === 'player') {
        const r = prompt(`${t('initiative.prompt.set')} ${e.name}:`, '10');
        if (r && !isNaN(parseInt(r))) e.roll = parseInt(r);
        else e.roll = 10;
      }
    });
    state.sortInitiative();
    // Always start at the highest roller
    if (c.initiative.length > 0) c.activeTurnIndex = 0;
    state._save(); state._notify();
    renderAll();
    _startTurnTimer();
  });
  panel.querySelector('#btn-next')?.addEventListener('click', () => {
    state.nextTurn();
    state._save(); state._notify();
    renderAll();
    _startTurnTimer();
  });
  panel.querySelector('#btn-prev')?.addEventListener('click', () => {
    state.prevTurn();
    state._save(); state._notify();
    renderAll();
    _startTurnTimer();
  });
  panel.querySelector('#btn-clr')?.addEventListener('click', () => {
    if (confirm(t('initiative.confirm.clear'))) { _stopTurnTimer(); state.clearInitiative(); renderAll(); }
  });

  // Timer controls
  panel.querySelector('#btn-timer-pause')?.addEventListener('click', () => {
    _togglePauseTimer();
    const btn = panel.querySelector('#btn-timer-pause');
    if (btn) btn.textContent = _turnTimer?.paused ? '▶' : '⏯';
  });
  panel.querySelector('#btn-timer-reset')?.addEventListener('click', () => _resetTurnTimer());

  // Roll modification on click
  panel.querySelectorAll('.initiative-roll').forEach(rollSpan => {
    rollSpan.addEventListener('click', () => {
      const eid = rollSpan.closest('.initiative-entry').dataset.eid;
      const entry = c.initiative.find(en => en.id === eid);
      if (!entry) return;
      const newVal = prompt(`${t('initiative.prompt.edit')} ${entry.name}:`, entry.roll);
      if (newVal !== null && !isNaN(parseInt(newVal))) {
        state.updateInitiativeEntry(eid, { roll: parseInt(newVal) });
        state.sortInitiative();
        state._save(); state._notify();
        renderAll();
      }
    });
  });

  // HP buttons — use delta value from adjacent input
  panel.querySelectorAll('.hp-up').forEach(b => {
    b.addEventListener('click', () => initDelta(b.dataset.eid, 1, b));
  });
  panel.querySelectorAll('.hp-down').forEach(b => {
    b.addEventListener('click', () => initDelta(b.dataset.eid, -1, b));
  });

  // Delta input — store value on change / Enter
  panel.querySelectorAll('.init-delta-input').forEach(inp => {
    inp.addEventListener('change', () => {
      const eid = inp.dataset.eid;
      // Store delta on the HP button dataset
      const hpDown = panel.querySelector(`.hp-down[data-eid="${eid}"]`);
      const hpUp = panel.querySelector(`.hp-up[data-eid="${eid}"]`);
      const val = Math.max(1, parseInt(inp.value) || 1);
      if (hpDown) hpDown.dataset.delta = val;
      if (hpUp) hpUp.dataset.delta = val;
      inp.value = val;
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { inp.blur(); }
    });
    // Initial value
    inp.value = parseInt(inp.value) || 1;
  });

  // Death save click handlers
  panel.querySelectorAll('.death-save-slot').forEach(slot => {
    slot.addEventListener('click', () => {
      const eid = slot.dataset.eid;
      const type = slot.dataset.type;
      state.addDeathSave(eid, type);
      state._save(); state._notify();
      renderAll();
    });
  });
}

/**
 * Render the HP row of an initiative entry.
 * Shows death saves when hp==0, otherwise the normal HP bar + delta controls.
 */
function _renderInitiativeHpRow(e) {
  // --- Dead ---
  if (e.isDead) {
    return `<div class="init-hp-progress-container">
      <div class="init-hp-text" style="color:var(--danger)">💀 ${t('initiative.dead')}</div>
      <div class="init-hp-bar-bg"><div class="init-hp-bar-fill hp-dead" style="width:0%"></div></div>
    </div>`;
  }

  // --- Dying (death saves) ---
  if (e.hp === 0 && !e.isDead) {
    const sCount = e.deathSaves?.successes || 0;
    const fCount = e.deathSaves?.failures || 0;

    // Success row (top) — 3 boxes, click to mark ✓
    let successBoxes = '';
    for (let i = 0; i < 3; i++) {
      const filled = i < sCount;
      successBoxes += `<span class="death-save-slot success${filled ? ' filled' : ''}"
        data-eid="${e.id}" data-type="success">${filled ? '✓' : ''}</span>`;
    }

    // Failure row (bottom) — 3 boxes, click to mark ✗
    let failureBoxes = '';
    for (let i = 0; i < 3; i++) {
      const filled = i < fCount;
      failureBoxes += `<span class="death-save-slot failure${filled ? ' filled' : ''}"
        data-eid="${e.id}" data-type="failure">${filled ? '✗' : ''}</span>`;
    }

    return `<div class="init-hp-progress-container">
      <div class="init-hp-text" style="color:var(--danger)">${t('initiative.death_saves')}</div>
      <div class="death-save-row">${successBoxes}</div>
      <div class="death-save-row">${failureBoxes}</div>
    </div>`;
  }

  // --- Normal ---
  const hpPct = e.maxHp > 0 ? (e.hp / e.maxHp) : 0;
  let hpStatus = 'hp-healthy';
  if (hpPct <= 0.25) hpStatus = 'hp-critical';
  else if (hpPct <= 0.5) hpStatus = 'hp-injured';
  const widthPct = Math.max(0, Math.min(100, hpPct * 100));

  return `<div class="init-hp-progress-container">
    <div class="init-hp-text">${t('initiative.hp_label')} <strong>${e.hp}</strong> / ${e.maxHp}</div>
    <div class="init-hp-bar-bg">
      <div class="init-hp-bar-fill ${hpStatus}" style="width: ${widthPct}%"></div>
    </div>
  </div>
  <div class="initiative-hp">
    <button class="btn btn-sm hp-down" data-eid="${e.id}" data-delta="1">−</button>
    <input type="number" class="init-delta-input" value="1" min="1" max="999"
           data-eid="${e.id}" style="width:2.8rem;text-align:center">
    <button class="btn btn-sm hp-up" data-eid="${e.id}" data-delta="1">＋</button>
  </div>`;
}

function initDelta(eid, dir, btn) {
  const c = state.active; if (!c) return;
  const e = c.initiative.find(en => en.id === eid); if (!e) return;
  const d = btn ? (parseInt(btn.dataset.delta) || 1) : 1;
  const newHp = e.hp + dir * d;

  if (newHp <= 0) {
    // Lethal damage check: if damage exceeds half max HP, instant death
    const excess = Math.abs(newHp);  // how far below 0
    if (excess > e.maxHp / 2) {
      state.updateInitiativeEntry(eid, { hp: -excess }); // triggers lethal in state
    } else {
      state.updateInitiativeEntry(eid, { hp: 0 });
    }
  } else {
    state.updateInitiativeEntry(eid, { hp: Math.min(newHp, e.maxHp) });
  }
  state._save(); state._notify();
  renderAll();
}

/* ---- Render all (surgical) ---- */
function renderAll() {
  const c = state.active;
  if (!c) return;

  const boardEl = $('#board-area');
  if (boardEl) renderBoard(boardEl, c.tokens, {
    onUpdate: (id, u) => { state.updateToken(id, u); syncInitFromBoard(); },
    onRemove: (id) => {
      state.removeToken(id);
      // Remove only this token from DOM — preserves expand state of others
      removeTokenFromCache(id);
      renderAll();
    },
    onEdit: (token) => showTokenEditor(token),
    onSaveVault: (token) => {
      state.addTokenToVault(token);
      renderAll();
      alert(t('vault.saved_alert', { name: token.name }));
    }
  });

  renderPlayers();
  renderInitiative();
  renderLocations();
  renderVault();
}

/* ---- Locations ---- */
function renderLocations() {
  const c = state.active; const panel = $('#locations-panel');
  if (!c) return;

  c.locations = c.locations || [];
  
  let html = `<div class="location-list">`;
  
  c.locations.forEach(loc => {
    const activeClass = loc.id === c.activeLocationId ? ' active' : '';
    html += `
      <div class="location-item${activeClass}" data-loc-id="${loc.id}">
        <span class="location-name">${esc(loc.name)}</span>
        <div class="location-actions">
          <button class="btn-icon-sm" data-act="rename-loc" data-loc-id="${loc.id}" title="${t('locations.rename_title')}">✎</button>
          ${c.locations.length > 1 ? `<button class="btn-icon-sm btn-danger" data-act="delete-loc" data-loc-id="${loc.id}" title="${t('locations.delete_title')}">✕</button>` : ''}
        </div>
      </div>
    `;
  });
  
  html += `</div>
    <button class="btn btn-secondary btn-sm" id="btn-add-location" style="width:100%">${t('locations.add')}</button>`;
    
  panel.innerHTML = html;

  panel.querySelectorAll('.location-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.location-actions')) return;
      const locId = item.dataset.locId;
      clearBoardCache();
      state.switchLocation(locId);
      renderAll();
    });
  });

  panel.querySelectorAll('[data-act="rename-loc"]').forEach(b => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const locId = b.dataset.locId;
      const loc = c.locations.find(l => l.id === locId);
      if (!loc) return;
      const n = prompt(t('locations.prompt.rename'), loc.name);
      if (n?.trim()) {
        state.renameLocation(locId, n.trim());
        renderAll();
      }
    });
  });

  panel.querySelectorAll('[data-act="delete-loc"]').forEach(b => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const locId = b.dataset.locId;
      const loc = c.locations.find(l => l.id === locId);
      if (!loc) return;
      if (confirm(t('locations.confirm.delete', { name: loc.name }))) {
        clearBoardCache();
        state.deleteLocation(locId);
        renderAll();
      }
    });
  });

  panel.querySelector('#btn-add-location')?.addEventListener('click', () => {
    const n = prompt(t('locations.prompt.new'), t('locations.default_name'));
    if (n?.trim()) {
      clearBoardCache();
      state.createLocation(n.trim());
      renderAll();
    }
  });
}

/* ---- Vault ---- */
function renderVault() {
  const c = state.active; const panel = $('#vault-panel');
  if (!c) return;

  c.vault = c.vault || [];

  let html = `
    <!-- Batch import drop zone -->
    <div class="vault-drop-zone" id="vault-drop-zone">
      <div class="vault-drop-inner">
        <span style="font-size:1.5rem">📁</span>
        <span style="font-size:0.8rem">${t('vault.batch_drop')}</span>
      </div>
    </div>
    <div class="vault-batch-progress" id="vault-batch-progress" style="display:none"></div>
    <div class="vault-list">`;

  if (!c.vault.length) {
    html += `<div style="color:var(--text-secondary);font-size:0.85rem;padding:0.5rem;text-align:center">${t('vault.empty')}</div>`;
  } else {
    c.vault.forEach(preset => {
      const hasImage = !!preset.imgDataUrl;
      html += `
        <div class="vault-item" data-preset-id="${preset.id}">
          <div class="vault-avatar">
            ${hasImage
              ? `<img src="${preset.imgDataUrl}" alt="${esc(preset.name)}">`
              : `<span class="vault-avatar-initial">${preset.name.charAt(0).toUpperCase()}</span>`
            }
          </div>
          <div class="vault-info">
            <span class="vault-name">${esc(preset.name)}</span>
            <div class="vault-stats">
              <span>🛡️ ${preset.ac}</span>
              <span>❤️ ${preset.maxHp}</span>
            </div>
          </div>
          <div class="vault-actions">
            <button class="btn btn-sm btn-primary" data-act="spawn-preset" data-preset-id="${preset.id}" title="${t('vault.spawn_title')}">＋</button>
            <button class="btn btn-sm btn-danger" data-act="delete-preset" data-preset-id="${preset.id}" title="${t('vault.delete_title')}">×</button>
          </div>
        </div>
      `;
    });
  }

  html += `</div>
    <div style="display:flex;gap:0.4rem;margin-top:0.5rem">
      <button class="btn btn-secondary btn-sm" id="btn-add-vault-preset" style="flex:1">${t('vault.add_preset')}</button>
      <button class="btn btn-secondary btn-sm" id="btn-vault-batch" title="${t('vault.batch_import')}" style="flex:0">${t('vault.batch_import')}</button>
      <button class="btn btn-secondary btn-sm" id="btn-vault-folder" title="${t('vault.batch_folder')}" style="flex:0">${t('vault.batch_folder')}</button>
    </div>
    <input type="file" id="vault-file-input" accept="image/*" multiple style="display:none">
    <input type="file" id="vault-folder-input" webkitdirectory multiple style="display:none">`;

  panel.innerHTML = html;

  // --- Batch import: drag & drop on vault drop zone ---
  _initVaultDropZone(panel);

  // --- Batch import: multi-file button ---
  panel.querySelector('#btn-vault-batch')?.addEventListener('click', () => {
    document.getElementById('vault-file-input')?.click();
  });
  document.getElementById('vault-file-input')?.addEventListener('change', (e) => {
    if (e.target.files?.length) processBatchImages(e.target.files);
    e.target.value = '';
  });

  // --- Batch import: folder button ---
  panel.querySelector('#btn-vault-folder')?.addEventListener('click', () => {
    document.getElementById('vault-folder-input')?.click();
  });
  document.getElementById('vault-folder-input')?.addEventListener('change', (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    // Filter to images only
    const images = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!images.length) {
      _showBatchToast(t('vault.batch_empty'));
    } else {
      processBatchImages(images);
    }
    e.target.value = '';
  });

  // --- Standard vault actions ---
  panel.querySelectorAll('[data-act="spawn-preset"]').forEach(b => {
    b.addEventListener('click', () => {
      const presetId = b.dataset.presetId;
      state.spawnTokenFromVault(presetId);
      renderAll();
    });
  });

  panel.querySelectorAll('[data-act="delete-preset"]').forEach(b => {
    b.addEventListener('click', () => {
      const presetId = b.dataset.presetId;
      const preset = c.vault.find(p => p.id === presetId);
      if (!preset) return;
      if (confirm(t('vault.confirm.delete', { name: preset.name }))) {
        state.removePresetFromVault(presetId);
        renderAll();
      }
    });
  });

  panel.querySelector('#btn-add-vault-preset')?.addEventListener('click', () => {
    showTokenEditor(null, null, true);
  });
}

/* ---- Batch image import (Vault drop zone) ---- */

function _initVaultDropZone(panel) {
  const dropZone = panel.querySelector('#vault-drop-zone');
  if (!dropZone) return;
  let counter = 0;

  dropZone.addEventListener('dragenter', (e) => {
    e.preventDefault(); e.stopPropagation();
    counter++;
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault(); e.stopPropagation();
    counter--;
    if (counter <= 0) { counter = 0; dropZone.classList.remove('drag-over'); }
  });
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault(); e.stopPropagation();
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); e.stopPropagation();
    counter = 0;
    dropZone.classList.remove('drag-over');
    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    const images = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (images.length) processBatchImages(images);
  });
}

/**
 * Process multiple image files: compress → OCR → vault.
 * Shows inline progress in the vault panel.
 */
async function processBatchImages(files) {
  const progressEl = document.getElementById('vault-batch-progress');
  const { compressImage } = await import('./utils.js');
  let added = 0;

  if (progressEl) {
    progressEl.style.display = 'block';
    progressEl.innerHTML = '';
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const idx = i + 1;
    const total = files.length;

    if (progressEl) {
      progressEl.innerHTML = `<span>${t('vault.batch_processing', { current: idx, total, name: file.name })}</span>`;
    }

    // 1. Compress image
    let imageId = null, imgDataUrl = null;
    try {
      const { dataUrl } = await compressImage(file);
      imgDataUrl = dataUrl;
      imageId = uid();
    } catch (e) {
      // Compression failed — still try to OCR without image
      console.warn('Image compression failed for', file.name, e);
    }

    // 2. OCR with Ollama
    let ocrResult = null;
    try {
      ocrResult = await ocrStatBlock(file);
    } catch {
      // Ollama not available or failed — use filename as fallback
    }

    // 3. Save image to IndexedDB if we have compressed data
    if (imgDataUrl && imageId) {
      try {
        await saveImage(imageId, imgDataUrl);
      } catch { /* image save failed, proceed without */ }
    }

    // 4. Create vault preset
    const name = ocrResult?.name || file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
    const maxHp = ocrResult?.hp || 30;
    const ac = ocrResult?.ac || 12;
    const initMod = ocrResult?.initMod ?? 0;

    await state.addPresetToVaultBatch({ name, maxHp, ac, initMod, imageId, imgDataUrl });
    added++;

    // Update progress line
    if (progressEl) {
      const statusKey = ocrResult ? 'vault.batch_ok' : 'vault.batch_fallback';
      progressEl.innerHTML = progressEl.innerHTML +
        `<br><span style="font-size:0.75rem;color:${ocrResult ? 'var(--success,#22c55e)' : 'var(--text-secondary)'}">${t(statusKey, { name, hp: maxHp, ac })}</span>`;
    }
  }

  // Done
  if (progressEl) {
    progressEl.innerHTML = `<span style="color:var(--success,#22c55e);font-weight:600">${t('vault.batch_done', { count: added })}</span>`;
    setTimeout(() => { progressEl.style.display = 'none'; }, 4000);
  }

  renderAll();
}

function _showBatchToast(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = [
    'position:fixed', 'bottom:1.5rem', 'left:50%', 'transform:translateX(-50%)',
    'background:var(--accent,#6366f1)', 'color:#fff', 'padding:0.6rem 1.2rem',
    'border-radius:0.5rem', 'font-size:0.9rem', 'z-index:9999',
    'box-shadow:0 4px 12px rgba(0,0,0,.4)', 'pointer-events:none',
    'opacity:1', 'transition:opacity 0.4s'
  ].join(';');
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 4000);
}

/* ---- Sidebar Tabs ---- */
function initSidebarTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const targetId = tab.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = content.id === targetId ? 'flex' : 'none';
      });
    });
  });
}

function syncInitFromBoard() {
  const c = state.active;
  if (!c?.initiative.length) return;
  c.initiative.forEach(e => {
    if (e.type === 'token') {
      const tok = c.tokens.find(tk => tk.id === e.refId);
      if (tok) { e.hp = tok.hp; e.maxHp = tok.maxHp; e.ac = tok.ac; }
    } else {
      const p = c.players.find(pl => pl.id === e.refId);
      if (p) { e.hp = p.hp; e.maxHp = p.maxHp; e.ac = p.ac; }
    }
  });
}

/* ---- Drag-and-drop image onto board ---- */
function initDropZone() {
  const board = $('#board-area');
  if (!board) return;

  let dragCounter = 0;

  board.addEventListener('dragenter', (e) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter++;
    board.classList.add('drop-active');
  });

  board.addEventListener('dragleave', (e) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter--;
    if (dragCounter <= 0) { dragCounter = 0; board.classList.remove('drop-active'); }
  });

  board.addEventListener('dragover', (e) => {
    e.preventDefault(); e.stopPropagation();
  });

  board.addEventListener('drop', (e) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter = 0;
    board.classList.remove('drop-active');

    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      alert(t('modal.only_images'));
      return;
    }

    // Open token editor with this image pre-loaded
    showTokenEditor(null, file);
  });
}

/* ---- Language toggle ---- */
function initLangToggle() {
  const btn = $('#btn-lang');
  if (!btn) return;

  btn.addEventListener('click', () => {
    // Toggle language
    const newLang = getLang() === 'es' ? 'en' : 'es';

    // 1. Update internal state + static data-i18n elements
    setLanguage(newLang);

    // 2. Explicitly update the toggle button text (direct fallback)
    btn.textContent = t('header.lang_toggle');

    // 3. Rebuild board tokens (so HP/AC labels update)
    clearBoardCache();

    // 4. Re-render all dynamic panels with new language
    renderAll();

    // 5. Sync expand button text if it's currently in compact mode
    const expandBtn = $('#btn-toggle-size');
    if (expandBtn) {
      const isExpanded = expandBtn.dataset.expanded === 'true';
      expandBtn.textContent = isExpanded ? t('toolbar.compact') : t('toolbar.expand');
    }
  });
}

/* ---- Init ---- */
async function init() {
  // Apply initial language (stored in localStorage or default 'es')
  applyI18n();

  initCampaignManager();
  initThemeSystem();
  initSidebarTabs();
  initLangToggle();

  $('#btn-add-token')?.addEventListener('click', () => showTokenEditor());

  // Drag-and-drop image onto board → new creature with that image
  initDropZone();

  // Full image toggle button
  $('#btn-toggle-size')?.addEventListener('click', () => {
    const exp = toggleAllTokenImages();
    const btn = $('#btn-toggle-size');
    if (btn) {
      btn.textContent = exp ? t('toolbar.compact') : t('toolbar.expand');
      btn.dataset.expanded = exp ? 'true' : 'false';
    }
  });

  // Theme toggle
  const tp = $('#theme-panel');
  $('#btn-toggle-theme')?.addEventListener('click', () => {
    if (tp) tp.style.display = tp.style.display === 'none' ? 'block' : 'none';
  });

  if (!state.campaigns.length) state.createCampaign(t('campaign.default_name'));

  // Rehydrate images from IndexedDB before first render
  await state.loadImages();

  renderAll();

  state.onChange(() => {
    applyTheme(state.active);
    renderAll();
  });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); state.nextTurn(); state._save(); state._notify(); renderAll(); _startTurnTimer(); }
    if (e.code === 'KeyN' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); showTokenEditor(); }
    if (e.code === 'KeyI' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); state.generateInitiative(); renderAll(); }
  });
}

applyTheme(state.active);
init();

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
