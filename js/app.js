/* ============================================================
   DM BOARD — Main Application
   Surgical DOM updates. HP delta input. Global image toggle.
   ============================================================ */

import { state } from './state.js';
import { uid, clamp } from './utils.js';
import { renderBoard, clearBoardCache, removeTokenFromCache, toggleAllTokenImages } from './board.js';
import { initThemeSystem, applyTheme } from './themes.js';

const $ = (s) => document.querySelector(s);

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
      o.textContent = '— Sin campañas —'; o.disabled = true;
      select.appendChild(o);
    }
  };

  select?.addEventListener('change', () => {
    if (select.value) { clearBoardCache(); state.switchCampaign(select.value); renderAll(); }
  });

  $('#btn-new-campaign')?.addEventListener('click', () => {
    const n = prompt('Nombre de la nueva campaña:', 'Nueva Campaña');
    if (n?.trim()) { state.createCampaign(n.trim()); populate(); renderAll(); }
  });
  $('#btn-delete-campaign')?.addEventListener('click', () => {
    const c = state.active; if (!c) return;
    if (confirm(`¿Eliminar "${c.name}"?`)) { state.deleteCampaign(c.id); populate(); renderAll(); }
  });
  $('#btn-rename-campaign')?.addEventListener('click', () => {
    const c = state.active; if (!c) return;
    const n = prompt('Nuevo nombre:', c.name);
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
    reader.onload = () => { const img = ov.querySelector('#m-upload img'); if (img) img.src = reader.result; else { const ua = ov.querySelector('#m-upload'); if (ua) ua.innerHTML = `<img src="${reader.result}" alt="preview">`; } };
    reader.readAsDataURL(preloadedFile);
  }

  ov.innerHTML = `<div class="modal-panel">
    <h2>${isEdit ? 'Editar' : 'Nueva'} ${isVaultPreset ? 'Plantilla de Almacén' : 'Criatura'}</h2>
    <div class="modal-field"><label>Nombre</label><input type="text" id="m-name" value="${isEdit ? esc(existing.name) : ''}" placeholder="Goblin, Dragón..."></div>
    <div class="modal-field"><label>Imagen</label>
      <div class="image-upload-area" id="m-upload">${prev || 'Click para subir (PNG, JPG)'}</div>
      <input type="file" id="m-file" accept="image/*" style="display:none">
      <button class="btn btn-sm btn-accent" id="m-read-sheet" style="width:100%;margin-top:0.4rem;display:none">🔍 Leer estadísticas automáticamente</button>
      ${isEdit && existing.imgDataUrl ? '<button class="btn btn-sm btn-secondary" id="m-rmimg">Quitar imagen</button>' : ''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">
      <div class="modal-field"><label>Vida Máx</label><input type="number" id="m-hp" value="${isEdit ? existing.maxHp : 30}" min="1"></div>
      <div class="modal-field"><label>CA</label><input type="number" id="m-ac" value="${isEdit ? existing.ac : 12}" min="0"></div>
      <div class="modal-field"><label>Mod. Iniciativa</label><input type="number" id="m-init" value="${isEdit ? (existing.initMod ?? 0) : 0}" min="-5" max="10" title="Modificador de DEX (+X que se suma al d20)"></div>
      ${isVaultPreset ? '' : `<div class="modal-field"><label>Cantidad</label><input type="number" id="m-ct" value="${isEdit ? existing.count : 1}" min="1"></div>`}
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" id="m-cancel">Cancelar</button>
      <button class="btn btn-primary" id="m-save">${isEdit ? 'Guardar' : 'Añadir'}</button>
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
      r.onload = () => {
        ov.querySelector('#m-upload').innerHTML = `<img src="${r.result}" alt="preview">`;
        if (readBtn) readBtn.style.display = 'block';
      };
      r.readAsDataURL(sf);
    }
  });

  // Ollama Vision - read stat block
  readBtn?.addEventListener('click', async () => {
    if (!sf) return;
    readBtn.disabled = true;
    readBtn.textContent = '⏳ Leyendo ficha…';

    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(sf);
      });

      const prompt = `Look at this tabletop RPG monster stat block image carefully.

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
          prompt,
          images: [b64],
          stream: false
          // NO format:'json' — it interferes with vision reasoning
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

      // Regex fallback for each field if JSON parse failed
      if (!stats) {
        stats = {};
        const nameM = raw.match(/"name"\s*:\s*"([^"]+)"/);
        const hpM   = raw.match(/"hp"\s*:\s*(-?\d+)/);
        const acM   = raw.match(/"ac"\s*:\s*(-?\d+)/);
        if (nameM) stats.name = nameM[1];
        if (hpM)   stats.hp   = parseInt(hpM[1]);
        if (acM)   stats.ac   = parseInt(acM[1]);
        // Try to extract modifiers array from text
        const modsM = raw.match(/"modifiers"\s*:\s*\[([^\]]+)\]/);
        if (modsM) {
          const mods = modsM[1].split(',').map(v => parseInt(v.trim()));
          if (mods.length >= 2) stats.modifiers = mods;
        }
      }

      if (!stats) throw new Error('No se pudo interpretar la respuesta');

      // DEX is always index 1 in [STR, DEX, CON, INT, WIS, CHA]
      if (Array.isArray(stats.modifiers) && stats.modifiers.length >= 2) {
        stats.initMod = stats.modifiers[1];
      } else if (typeof stats.initMod !== 'number') {
        stats.initMod = undefined;
      }

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
      setTimeout(() => { readBtn.textContent = '🔍 Leer estadísticas automáticamente'; readBtn.style.background = ''; readBtn.disabled = false; }, 4000);

    } catch (err) {
      console.error('OCR error:', err);
      readBtn.disabled = false;
      readBtn.textContent = '❌ Error al leer — ¿Ollama en marcha?';
      setTimeout(() => { readBtn.textContent = '🔍 Leer estadísticas automáticamente'; }, 3000);
    }
  });


  ov.querySelector('#m-cancel')?.addEventListener('click', () => ov.remove());
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  ov.querySelector('#m-rmimg')?.addEventListener('click', () => {
    sf = null; ov.querySelector('#m-upload').innerHTML = 'Click para subir (PNG, JPG)';
    if (readBtn) readBtn.style.display = 'none';
    if (isEdit) { existing.imgDataUrl = null; existing.imageId = null; }
  });

  ov.querySelector('#m-save')?.addEventListener('click', async () => {
    const name = ov.querySelector('#m-name').value.trim();
    if (!name) { alert('La criatura necesita nombre.'); return; }
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

  const existing = new Map();
  panel.querySelectorAll('.player-row').forEach(r => existing.set(r.dataset.id, r));

  let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem">
    <h3 style="margin:0">👥 Jugadores</h3><button class="btn btn-sm btn-primary" id="btn-add-p">＋</button></div><div id="player-list">`;

  if (!c.players.length) html += '<div style="color:var(--text-secondary);font-size:0.85rem;padding:0.5rem">Sin jugadores.</div>';

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
      <span style="font-size:0.8rem;color:var(--text-secondary)">CA ${p.ac}</span>
      <button class="btn btn-sm btn-danger" data-del="${p.id}" title="Eliminar">×</button>
    </div>`;
  });
  html += '</div><button class="btn btn-sm btn-secondary" id="btn-add-p2" style="margin-top:0.4rem;width:100%">＋ Añadir Jugador</button>';
  panel.innerHTML = html;

  const addP = () => {
    const n = prompt('Nombre del jugador:', 'Jugador');
    if (!n?.trim()) return;
    state.addPlayer({ name: n.trim(), maxHp: parseInt(prompt('Vida máxima:', '30')) || 30, ac: parseInt(prompt('CA:', '14')) || 14 });
    renderPlayers();
  };
  panel.querySelector('#btn-add-p')?.addEventListener('click', addP);
  panel.querySelector('#btn-add-p2')?.addEventListener('click', addP);

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
    b.addEventListener('click', () => { if (confirm('¿Eliminar jugador?')) { state.removePlayer(b.dataset.del); renderAll(); } });
  });
}

function playerDelta(pid, dir) {
  const c = state.active; if (!c) return;
  const p = c.players.find(pl => pl.id === pid); if (!p) return;
  const inp = document.querySelector(`[data-pid="${pid}"][data-act="php"]`);
  const d = inp ? (parseInt(inp.dataset.delta) || 1) : 1;
  state.updatePlayer(pid, { hp: clamp(p.hp + dir * d, 0, p.maxHp) });
  renderPlayers();
}

/* ---- Initiative ---- */
function renderInitiative() {
  const c = state.active; const panel = $('#initiative-panel');
  if (!c) return;

  let html = `<div class="initiative-header"><h3 style="margin:0">⚔️ Iniciativa</h3>
    ${c.round > 0 ? `<span class="round-counter">Ronda ${c.round}</span>` : ''}</div>`;

  if (!c.initiative.length) {
    html += '<div style="color:var(--text-secondary);font-size:0.85rem;padding:0.5rem;text-align:center">Genera la iniciativa para empezar.</div>';
  } else {
    html += '<ul class="initiative-list">';
    c.initiative.forEach((e, i) => {
      const active = i === c.activeTurnIndex ? ' active-turn' : '';
      
      // Determine HP status class
      let hpStatus = 'hp-healthy';
      const hpPct = e.maxHp > 0 ? (e.hp / e.maxHp) : 0;
      if (hpPct <= 0.25) {
        hpStatus = 'hp-critical';
      } else if (hpPct <= 0.5) {
        hpStatus = 'hp-injured';
      }
      
      const widthPct = Math.max(0, Math.min(100, hpPct * 100));

      html += `<li class="initiative-entry${active}" data-eid="${e.id}">
        <div class="init-row-main">
          <div class="init-left">
            <span class="initiative-roll" title="Haz clic para modificar tirada">${e.roll}</span>
            <span class="initiative-name" title="${esc(e.name)}">${esc(e.name)}</span>
            <span class="init-badge ${e.type}">${e.type === 'player' ? 'PJ' : 'PNJ'}</span>
          </div>
          <div class="init-right">
            <span class="initiative-ac" title="Clase de Armadura">🛡️ ${e.ac}</span>
          </div>
        </div>
        <div class="init-row-hp">
          <div class="init-hp-progress-container">
            <div class="init-hp-text">HP: <strong>${e.hp}</strong> / ${e.maxHp}</div>
            <div class="init-hp-bar-bg">
              <div class="init-hp-bar-fill ${hpStatus}" style="width: ${widthPct}%"></div>
            </div>
          </div>
          <div class="initiative-hp">
            <button class="btn btn-sm hp-down" data-eid="${e.id}" title="Restar HP">−</button>
            <input type="number" class="token-hp-input stat-number ${e.hp <= e.maxHp * 0.25 ? 'hp-low' : ''}"
                   value="${e.hp}" data-eid="${e.id}" data-act="ihp" data-delta="1" min="0" max="${e.maxHp}" title="Presiona Enter para establecer delta de ajuste">
            <button class="btn btn-sm hp-up" data-eid="${e.id}" title="Sumar HP">＋</button>
          </div>
        </div>
      </li>`;
    });
    html += '</ul>';
  }

  html += `<div class="initiative-controls" style="margin-top:0.5rem">
    <button class="btn btn-primary" id="btn-gen">🎲 Generar Iniciativa</button>
    ${c.initiative.length ? `<div style="display:flex;gap:0.3rem;margin-top:0.3rem">
      <button class="btn btn-secondary" id="btn-prev">◀</button>
      <button class="btn btn-primary" id="btn-next" style="flex:1">▶ Siguiente</button>
      <button class="btn btn-sm btn-secondary" id="btn-clr">✕</button>
    </div>` : ''}
  </div>`;
  panel.innerHTML = html;

  panel.querySelector('#btn-gen')?.addEventListener('click', () => {
    state.generateInitiative();
    // Prompt for player rolls
    c.initiative.forEach(e => {
      if (e.type === 'player') {
        const r = prompt(`Iniciativa de ${e.name}:`, '10');
        if (r && !isNaN(parseInt(r))) e.roll = parseInt(r);
        else e.roll = 10;
      }
    });
    state.sortInitiative();
    state._save(); state._notify();
    renderAll();
  });
  panel.querySelector('#btn-next')?.addEventListener('click', () => { state.nextTurn(); renderAll(); });
  panel.querySelector('#btn-prev')?.addEventListener('click', () => { state.prevTurn(); renderAll(); });
  panel.querySelector('#btn-clr')?.addEventListener('click', () => { if (confirm('¿Limpiar iniciativa?')) { state.clearInitiative(); renderAll(); } });

  // Roll modification on click
  panel.querySelectorAll('.initiative-roll').forEach(rollSpan => {
    rollSpan.addEventListener('click', () => {
      const eid = rollSpan.closest('.initiative-entry').dataset.eid;
      const entry = c.initiative.find(en => en.id === eid);
      if (!entry) return;
      const newVal = prompt(`Modificar iniciativa de ${entry.name}:`, entry.roll);
      if (newVal !== null && !isNaN(parseInt(newVal))) {
        state.updateInitiativeEntry(eid, { roll: parseInt(newVal) });
        state.sortInitiative();
        state._save(); state._notify();
        renderAll();
      }
    });
  });

  // HP buttons
  panel.querySelectorAll('.hp-up').forEach(b => {
    b.addEventListener('click', () => initDelta(b.dataset.eid, 1));
  });
  panel.querySelectorAll('.hp-down').forEach(b => {
    b.addEventListener('click', () => initDelta(b.dataset.eid, -1));
  });
  // HP inputs
  panel.querySelectorAll('[data-act="ihp"]').forEach(inp => {
    inp.addEventListener('input', () => {
      const v = parseInt(inp.value); const eid = inp.dataset.eid;
      if (!isNaN(v)) state.updateInitiativeEntry(eid, { hp: clamp(v, 0, 999) });
    });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { inp.dataset.delta = inp.value; inp.blur(); } });
  });
}

function initDelta(eid, dir) {
  const c = state.active; if (!c) return;
  const e = c.initiative.find(en => en.id === eid); if (!e) return;
  const inp = document.querySelector(`[data-eid="${eid}"][data-act="ihp"]`);
  const d = inp ? (parseInt(inp.dataset.delta) || 1) : 1;
  state.updateInitiativeEntry(eid, { hp: clamp(e.hp + dir * d, 0, e.maxHp) });
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
    onEdit: (t) => showTokenEditor(t),
    onSaveVault: (t) => {
      state.addTokenToVault(t);
      renderAll();
      alert(`"${t.name}" guardado en el Almacén.`);
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
          <button class="btn-icon-sm" data-act="rename-loc" data-loc-id="${loc.id}" title="Renombrar">✎</button>
          ${c.locations.length > 1 ? `<button class="btn-icon-sm btn-danger" data-act="delete-loc" data-loc-id="${loc.id}" title="Eliminar">✕</button>` : ''}
        </div>
      </div>
    `;
  });
  
  html += `</div>
    <button class="btn btn-secondary btn-sm" id="btn-add-location" style="width:100%">＋ Nueva Localización</button>`;
    
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
      const n = prompt('Nuevo nombre de la localización:', loc.name);
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
      if (confirm(`¿Eliminar la localización "${loc.name}" y todas sus criaturas?`)) {
        clearBoardCache();
        state.deleteLocation(locId);
        renderAll();
      }
    });
  });

  panel.querySelector('#btn-add-location')?.addEventListener('click', () => {
    const n = prompt('Nombre de la nueva localización:', 'Nueva Localización');
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

  let html = `<div class="vault-list">`;
  
  if (!c.vault.length) {
    html += '<div style="color:var(--text-secondary);font-size:0.85rem;padding:0.5rem;text-align:center">El almacén está vacío. Guarda criaturas desde el tablero o crea plantillas.</div>';
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
            <button class="btn btn-sm btn-primary" data-act="spawn-preset" data-preset-id="${preset.id}" title="Añadir al Tablero">＋</button>
            <button class="btn btn-sm btn-danger" data-act="delete-preset" data-preset-id="${preset.id}" title="Eliminar">×</button>
          </div>
        </div>
      `;
    });
  }
  
  html += `</div>
    <button class="btn btn-secondary btn-sm" id="btn-add-vault-preset" style="width:100%;margin-top:0.5rem">＋ Crear Nueva Plantilla</button>`;
    
  panel.innerHTML = html;

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
      if (confirm(`¿Eliminar la plantilla de "${preset.name}" del almacén?`)) {
        state.removePresetFromVault(presetId);
        renderAll();
      }
    });
  });

  panel.querySelector('#btn-add-vault-preset')?.addEventListener('click', () => {
    showTokenEditor(null, null, true);
  });
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
      const t = c.tokens.find(tk => tk.id === e.refId);
      if (t) { e.hp = t.hp; e.maxHp = t.maxHp; e.ac = t.ac; e.saveDc = t.saveDc; }
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
      alert('Solo se aceptan archivos de imagen (PNG, JPG, etc.)');
      return;
    }

    // Open token editor with this image pre-loaded
    showTokenEditor(null, file);
  });
}

/* ---- Init ---- */
function init() {
  initCampaignManager();
  initThemeSystem();
  initSidebarTabs();

  $('#btn-add-token')?.addEventListener('click', () => showTokenEditor());

  // Drag-and-drop image onto board → new creature with that image
  initDropZone();

  // Full image toggle button
  $('#btn-toggle-size')?.addEventListener('click', () => {
    const exp = toggleAllTokenImages();
    const btn = $('#btn-toggle-size');
    if (btn) btn.textContent = exp ? '⊡ Compactar' : '⤢ Expandir';
  });

  // Theme toggle
  const tp = $('#theme-panel');
  $('#btn-toggle-theme')?.addEventListener('click', () => {
    if (tp) tp.style.display = tp.style.display === 'none' ? 'block' : 'none';
  });

  if (!state.campaigns.length) state.createCampaign('Mi Campaña');
  renderAll();

  state.onChange(() => {
    applyTheme(state.active);
    renderAll();
  });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); state.nextTurn(); renderAll(); }
    if (e.code === 'KeyN' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); showTokenEditor(); }
    if (e.code === 'KeyI' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); state.generateInitiative(); renderAll(); }
  });
}

applyTheme(state.active);
init();

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
