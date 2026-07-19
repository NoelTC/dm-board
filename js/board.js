/* ============================================================
   DM BOARD — Board Component
   Drag tokens with pointer events. Surgical DOM updates.
   HP delta input. Global compact/expand toggle.
   ============================================================ */

import { t } from './i18n.js';

const TOKEN_MAP = new Map(); // tokenId -> DOM element

/**
 * @param {HTMLElement} boardEl
 * @param {Array} tokens
 * @param {Object} callbacks - { onUpdate, onRemove, onEdit, onSaveVault }
 */
export function renderBoard(boardEl, tokens, { onUpdate, onRemove, onEdit, onSaveVault }) {
  const currentIds = new Set(tokens.map(t => t.id));
  let emptyEl = boardEl.querySelector('.board-empty');

  // Show/hide empty state
  if (tokens.length === 0) {
    if (!emptyEl) {
      emptyEl = document.createElement('div');
      emptyEl.className = 'board-empty';
      emptyEl.innerHTML = `<div style="font-size:2.5rem">🎯</div><div data-i18n-html="board.empty.hint">${t('board.empty.hint')}</div>`;
      boardEl.appendChild(emptyEl);
    }
  } else {
    if (emptyEl) emptyEl.remove();
  }

  // Update or create token elements
  for (const token of tokens) {
    let el = TOKEN_MAP.get(token.id);
    if (!el) {
      el = buildTokenElement(boardEl, token, { onUpdate, onRemove, onEdit, onSaveVault });
      boardEl.appendChild(el);
      TOKEN_MAP.set(token.id, el);
    } else {
      updateTokenElement(el, token);
    }
    currentIds.delete(token.id);
  }

  // Remove tokens no longer present
  for (const id of currentIds) {
    const el = TOKEN_MAP.get(id);
    if (el) { el.remove(); TOKEN_MAP.delete(id); }
  }
}

export function clearBoardCache() {
  TOKEN_MAP.forEach(el => el.remove());
  TOKEN_MAP.clear();
}

/** Remove a single token element from cache without resetting all others */
export function removeTokenFromCache(id) {
  const el = TOKEN_MAP.get(id);
  if (el) { el.remove(); TOKEN_MAP.delete(id); }
}

/* ================================================================ */

function buildTokenElement(board, token, { onUpdate, onRemove, onEdit, onSaveVault }) {
  const el = document.createElement('div');
  el.className = 'board-token';
  el.setAttribute('data-token-id', token.id);
  el.style.left = `${token.x}px`;
  el.style.top = `${token.y}px`;

  const hasImage = !!token.imgDataUrl;

  el.innerHTML = `
    <button class="token-delete-btn" data-act="remove" title="${t('header.delete_campaign')}">×</button>
    ${token.count > 1 ? `<span class="token-count-badge">×${token.count}</span>` : ''}
    <div class="token-image-wrap" data-act="toggle-img">
      ${hasImage
        ? `<img src="${token.imgDataUrl}" alt="${esc(token.name)}" draggable="false">`
        : `<span class="token-initial">${token.name.charAt(0).toUpperCase()}</span>`
      }
      ${hasImage ? '<span class="token-expand-hint">⤢</span>' : ''}
      ${hasImage ? '<span class="token-resize-handle" data-act="resize"></span>' : ''}
    </div>
    <div class="token-panel">
      <div class="token-name-tag">
        ${esc(token.name)}
        <button class="btn btn-sm" data-act="edit" title="${t('token.edit_title')}" style="font-size:0.65rem;padding:0 0.25rem;margin-left:0.2rem">✎</button>
        <button class="btn btn-sm" data-act="save-vault" title="${t('token.save_vault_title')}" style="font-size:0.65rem;padding:0 0.25rem;margin-left:0.2rem">📁</button>
      </div>
      <div class="token-panel-row">
        <span class="token-panel-label">${t('token.hp_label')}</span>
        <div class="hp-controls">
          <button class="btn btn-sm btn-danger" data-act="hp-down">−</button>
          <input type="number" class="token-hp-input stat-number" value="${token.hp}"
                 min="0" max="${token.maxHp}" data-act="hp-val" data-delta="1">
          <span class="token-hp-max">/ ${token.maxHp}</span>
          <button class="btn btn-sm btn-success" data-act="hp-up">＋</button>
        </div>
      </div>
      <div class="token-panel-row">
        <span class="token-panel-label">${t('token.ac_label')}</span>
        <span class="token-panel-value">${token.ac}</span>
      </div>
    </div>
  `;

  /* ---- Drag (pointer events from image wrap) ---- */
  let dragging = false, sx, sy, ox, oy, moved = false;
  const imgWrap = el.querySelector('[data-act="toggle-img"]');

  const onDown = (e) => {
    if (e.target.closest('button') || e.target.closest('input')) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    dragging = true; moved = false;
    el.classList.add('dragging');
    const br = board.getBoundingClientRect();
    const tr = el.getBoundingClientRect();
    sx = e.clientX; sy = e.clientY;
    ox = tr.left - br.left + board.scrollLeft;
    oy = tr.top - br.top + board.scrollTop;
  };

  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
    el.style.left = `${Math.max(0, ox + dx)}px`;
    el.style.top  = `${Math.max(0, oy + dy)}px`;
  };

  const onUp = (e) => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('dragging');
    el.releasePointerCapture(e.pointerId);
    if (moved) {
      token.x = parseInt(el.style.left) || 0;
      token.y = parseInt(el.style.top) || 0;
      onUpdate(token.id, { x: token.x, y: token.y });
    }
  };

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', () => { dragging = false; el.classList.remove('dragging'); });
  el.querySelector('img')?.addEventListener('dragstart', e => e.preventDefault());

  /* ---- Buttons ---- */
  el.querySelector('[data-act="remove"]')?.addEventListener('click', (e) => {
    e.stopPropagation(); onRemove(token.id);
  });
  el.querySelector('[data-act="edit"]')?.addEventListener('click', (e) => {
    e.stopPropagation(); onEdit(token);
  });
  el.querySelector('[data-act="save-vault"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (onSaveVault) onSaveVault(token);
  });

  const hpInput = el.querySelector('[data-act="hp-val"]');
  const updateHp = (delta) => {
    const d = parseInt(hpInput.dataset.delta) || 1;
    const amount = delta > 0 ? d : -d;
    token.hp = Math.max(0, Math.min(token.maxHp, token.hp + amount));
    hpInput.value = token.hp;
    hpInput.classList.toggle('hp-low', token.hp <= token.maxHp * 0.25);
    onUpdate(token.id, { hp: token.hp });
  };

  el.querySelector('[data-act="hp-down"]')?.addEventListener('click', (e) => { e.stopPropagation(); updateHp(-1); });
  el.querySelector('[data-act="hp-up"]')?.addEventListener('click', (e) => { e.stopPropagation(); updateHp(1); });

  hpInput?.addEventListener('input', () => {
    const v = parseInt(hpInput.value);
    if (!isNaN(v)) { token.hp = Math.max(0, Math.min(v, token.maxHp)); onUpdate(token.id, { hp: token.hp }); }
  });
  hpInput?.addEventListener('pointerdown', e => e.stopPropagation());
  hpInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); hpInput.dataset.delta = hpInput.value; hpInput.blur(); }
  });

  /* ---- Image size toggle (individual click) ---- */
  imgWrap?.addEventListener('click', (e) => {
    if (moved) { moved = false; return; }
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('[data-act="resize"]')) return;
    e.stopPropagation();
    const expanded = imgWrap.classList.contains('token-expanded');
    setImageExpanded(imgWrap, el, !expanded);
  });

  /* ---- Resize handle (drag corner to scale image) ---- */
  const handle = el.querySelector('[data-act="resize"]');
  if (handle) {
    let resizing = false, rsx, rsy, rsw, rsh;
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      resizing = true;
      el.setPointerCapture(e.pointerId);
      rsx = e.clientX; rsy = e.clientY;
      rsw = imgWrap.offsetWidth;
      rsh = imgWrap.offsetHeight;
    });
    const onResizeMove = (e) => {
      if (!resizing) return;
      const dx = e.clientX - rsx;
      const dy = e.clientY - rsy;
      const ratio = rsw / (rsh || 1);
      // Use the larger delta to determine size, keep aspect ratio
      let nw, nh;
      if (Math.abs(dx) > Math.abs(dy)) {
        nw = Math.max(60, Math.min(450, rsw + dx));
        nh = nw / ratio;
      } else {
        nh = Math.max(60, Math.min(450, rsh + dy));
        nw = nh * ratio;
      }
      imgWrap.style.width = `${Math.round(nw)}px`;
      imgWrap.style.height = `${Math.round(nh)}px`;
      // Move panel
      const panel = el.querySelector('.token-panel');
      if (panel) panel.style.top = `${Math.round(nh) + 10}px`;
    };
    const onResizeUp = (e) => {
      if (!resizing) return;
      resizing = false;
      el.releasePointerCapture(e.pointerId);
    };
    el.addEventListener('pointermove', onResizeMove);
    el.addEventListener('pointerup', onResizeUp);
    el.addEventListener('pointercancel', onResizeUp);
  }

  // Apply global expanded state to new tokens
  if (_globalExpanded) {
    const wrap = el.querySelector('.token-image-wrap');
    if (wrap?.querySelector('img')) {
      // Defer until image dimensions are available
      const applyExpand = () => setImageExpanded(wrap, el, true);
      const img = wrap.querySelector('img');
      if (img.complete && img.naturalWidth > 0) {
        applyExpand();
      } else {
        img.addEventListener('load', applyExpand, { once: true });
        // Fallback in case load already fired
        setTimeout(applyExpand, 100);
      }
    }
  }

  return el;
}

function updateTokenElement(el, token) {
  el.style.left = `${token.x}px`;
  el.style.top  = `${token.y}px`;

  const hpInput = el.querySelector('[data-act="hp-val"]');
  if (hpInput && parseInt(hpInput.value) !== token.hp) {
    hpInput.value = token.hp;
    hpInput.max = token.maxHp;
    hpInput.classList.toggle('hp-low', token.hp <= token.maxHp * 0.25);
  }

  const maxSpan = el.querySelector('.token-hp-max');
  if (maxSpan) maxSpan.textContent = `/ ${token.maxHp}`;

  const badge = el.querySelector('.token-count-badge');
  if (badge) {
    if (token.count > 1) { badge.textContent = `×${token.count}`; badge.style.display = ''; }
    else badge.style.display = 'none';
  }

  const nameTag = el.querySelector('.token-name-tag');
  if (nameTag) {
    nameTag.childNodes[0].textContent = token.name;
  }
}

/** Expand or collapse a single token image */
function setImageExpanded(wrap, tokenEl, expanded) {
  const img = wrap.querySelector('img');
  const handle = wrap.querySelector('[data-act="resize"]');

  if (expanded) {
    wrap.classList.add('token-expanded');
    // Start at a good viewing size or natural image size
    const naturalW = img ? img.naturalWidth : 200;
    const naturalH = img ? img.naturalHeight : 200;
    const ratio = naturalW / (naturalH || 1);
    let w = Math.min(naturalW, 240);
    let h = w / ratio;
    if (h > 300) { h = 300; w = h * ratio; }
    wrap.style.width = `${Math.round(w)}px`;
    wrap.style.height = `${Math.round(h)}px`;
    wrap.style.maxWidth = 'none'; wrap.style.maxHeight = 'none';
    wrap.style.borderRadius = '6px';
    wrap.style.overflow = 'visible';
    if (handle) handle.style.display = 'block';
    // Move panel below
    const panel = tokenEl.querySelector('.token-panel');
    if (panel) panel.style.top = `${Math.round(h) + 10}px`;
  } else {
    wrap.classList.remove('token-expanded');
    wrap.style.width = '72px';
    wrap.style.height = '72px';
    wrap.style.maxWidth = ''; wrap.style.maxHeight = '';
    wrap.style.borderRadius = '50%';
    wrap.style.overflow = 'hidden';
    if (handle) handle.style.display = 'none';
    const panel = tokenEl.querySelector('.token-panel');
    if (panel) panel.style.top = '78px';
  }
}

/** Toggle ALL tokens (called from global button) */
let _globalExpanded = false;
export function getGlobalExpanded() { return _globalExpanded; }
export function toggleAllTokenImages() {
  _globalExpanded = !_globalExpanded;
  TOKEN_MAP.forEach((el) => {
    const wrap = el.querySelector('.token-image-wrap');
    if (wrap?.querySelector('img')) {
      setImageExpanded(wrap, el, _globalExpanded);
    }
  });
  return _globalExpanded;
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
