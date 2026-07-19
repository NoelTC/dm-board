/* ============================================================
   DM BOARD — State Management & Persistence
   All campaign data: tokens, players, initiative, theme.
   Persisted to localStorage. Images to IndexedDB.
   ============================================================ */

import { uid } from './utils.js';

const STATE_KEY = 'dmboard_campaigns';
const ACTIVE_KEY = 'dmboard_active';
const IMG_STORE = 'dmboard_images';
const IMG_DB_VER = 1;

/* ---- IndexedDB for images ---- */
function openImageDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IMG_STORE, IMG_DB_VER);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('images');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveImage(id, dataUrl) {
  const db = await openImageDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('images', 'readwrite');
    tx.objectStore('images').put(dataUrl, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadImage(id) {
  const db = await openImageDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('images', 'readonly');
    const req = tx.objectStore('images').get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function deleteImage(id) {
  const db = await openImageDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('images', 'readwrite');
    tx.objectStore('images').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ---- Toast helper ---- */
function _showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = [
    'position:fixed', 'bottom:1.5rem', 'left:50%', 'transform:translateX(-50%)',
    'background:' + (type === 'error' ? 'var(--danger,#ef4444)' : 'var(--accent,#6366f1)'),
    'color:#fff', 'padding:0.6rem 1.2rem', 'border-radius:0.5rem',
    'font-size:0.9rem', 'z-index:9999', 'box-shadow:0 4px 12px rgba(0,0,0,.4)',
    'pointer-events:none', 'opacity:1', 'transition:opacity 0.4s'
  ].join(';');
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 4000);
}

/* ---- Campaign data structure ---- */
function createCampaignData(name) {
  const locId = uid();
  return {
    id: uid(),
    name,
    tokens: [],        // { id, name, imageId, imgDataUrl, x, y, hp, maxHp, ac, saveDc, count }
    players: [],       // { id, name, hp, maxHp, ac }
    initiative: [],    // { id, refId, type:'token'|'player', name, roll, hp, maxHp, ac, saveDc }
    activeTurnIndex: -1,
    round: 0,
    theme: 'taberna',
    customTheme: null, // { bg, bgSecondary, bgTertiary, text, textSecondary, accent, accentHover, danger, success, border, headingFont, bodyFont, numberFont }
    createdAt: Date.now(),
    updatedAt: Date.now(),
    locations: [
      {
        id: locId,
        name: 'General',
        tokens: [],
        initiative: [],
        activeTurnIndex: -1,
        round: 0
      }
    ],
    activeLocationId: locId,
    vault: []          // Preset creatures: { id, name, imageId, imgDataUrl, maxHp, ac, saveDc }
  };
}

/* ---- State Manager ---- */
class StateManager {
  constructor() {
    this._campaigns = [];
    this._activeId = null;
    this._listeners = [];
    this._load();
  }

  /* --- Persistence --- */
  _load() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      this._campaigns = raw ? JSON.parse(raw) : [];
      this._activeId = localStorage.getItem(ACTIVE_KEY) || null;

      // Strip any legacy imgDataUrl that may still be in localStorage
      // (from before this fix). Images now live exclusively in IndexedDB.
      this._campaigns.forEach(camp => {
        (camp.tokens    || []).forEach(t => { delete t.imgDataUrl; });
        (camp.vault     || []).forEach(p => { delete p.imgDataUrl; });
        (camp.locations || []).forEach(loc =>
          (loc.tokens || []).forEach(t => { delete t.imgDataUrl; })
        );
      });
      // Migrate existing campaigns to locations structure
      this._campaigns.forEach(c => {
        if (!c.locations) {
          const locId = uid();
          c.locations = [{
            id: locId,
            name: 'General',
            tokens: c.tokens || [],
            initiative: c.initiative || [],
            activeTurnIndex: c.activeTurnIndex !== undefined ? c.activeTurnIndex : -1,
            round: c.round || 0
          }];
          c.activeLocationId = locId;
        }
        // Ensure root properties exist
        c.tokens = c.tokens || [];
        c.initiative = c.initiative || [];
        c.activeTurnIndex = c.activeTurnIndex !== undefined ? c.activeTurnIndex : -1;
        c.round = c.round || 0;
        
        // Ensure vault array exists
        c.vault = c.vault || [];
      });

      // Validate active campaign still exists
      if (this._activeId && !this._campaigns.find(c => c.id === this._activeId)) {
        this._activeId = this._campaigns.length > 0 ? this._campaigns[0].id : null;
      }
      // If no active but campaigns exist, pick first
      if (!this._activeId && this._campaigns.length > 0) {
        this._activeId = this._campaigns[0].id;
      }
    } catch {
      this._campaigns = [];
      this._activeId = null;
    }
  }

  _save() {
    try {
      const c = this.active;
      if (c) {
        this._saveCurrentLocationState(c);
      }

      // Strip imgDataUrl before serializing — images live in IndexedDB only.
      // We do a deep-clone so we don't mutate live objects.
      const stripped = this._campaigns.map(camp => ({
        ...camp,
        tokens: (camp.tokens || []).map(t => { const { imgDataUrl, ...rest } = t; return rest; }),
        vault:  (camp.vault  || []).map(p => { const { imgDataUrl, ...rest } = p; return rest; }),
        locations: (camp.locations || []).map(loc => ({
          ...loc,
          tokens: (loc.tokens || []).map(t => { const { imgDataUrl, ...rest } = t; return rest; }),
        })),
      }));

      localStorage.setItem(STATE_KEY, JSON.stringify(stripped));
      if (this._activeId) {
        localStorage.setItem(ACTIVE_KEY, this._activeId);
      } else {
        localStorage.removeItem(ACTIVE_KEY);
      }
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        _showToast('⚠️ Almacenamiento lleno. Borra algunas imágenes o campañas.', 'error');
      }
      console.warn('Could not save state:', e.message);
    }
  }

  _notify() {
    this._listeners.forEach(fn => fn(this.active));
  }

  onChange(fn) {
    this._listeners.push(fn);
    return () => {
      const i = this._listeners.indexOf(fn);
      if (i >= 0) this._listeners.splice(i, 1);
    };
  }

  /**
   * After loading from localStorage, rehydrate imgDataUrl from IndexedDB
   * for every token and vault preset in every campaign.
   * Call this once at startup (async) before first render.
   */
  async loadImages() {
    const rehydrate = async (item) => {
      if (item.imageId) {
        try {
          const url = await loadImage(item.imageId);
          if (url) item.imgDataUrl = url;
        } catch { /* ignore missing images */ }
      }
    };

    const tasks = [];
    for (const camp of this._campaigns) {
      for (const t of (camp.tokens || [])) tasks.push(rehydrate(t));
      for (const p of (camp.vault   || [])) tasks.push(rehydrate(p));
      for (const loc of (camp.locations || [])) {
        for (const t of (loc.tokens || [])) tasks.push(rehydrate(t));
      }
    }
    await Promise.all(tasks);
  }

  /* --- Campaign CRUD --- */
  get campaigns() { return this._campaigns; }
  get activeId() { return this._activeId; }

  get active() {
    return this._campaigns.find(c => c.id === this._activeId) || null;
  }

  _withActive(fn) {
    const c = this.active;
    if (!c) return null;
    const result = fn(c);
    c.updatedAt = Date.now();
    this._save();
    this._notify();
    return result;
  }

  createCampaign(name) {
    const c = createCampaignData(name);
    this._campaigns.push(c);
    this._activeId = c.id;
    this._save();
    this._notify();
    return c;
  }

  deleteCampaign(id) {
    const idx = this._campaigns.findIndex(c => c.id === id);
    if (idx < 0) return;
    // Delete associated images
    const campaign = this._campaigns[idx];
    campaign.tokens.forEach(t => {
      if (t.imageId) deleteImage(t.imageId).catch(() => {});
    });
    this._campaigns.splice(idx, 1);
    if (this._activeId === id) {
      this._activeId = this._campaigns.length > 0 ? this._campaigns[0].id : null;
    }
    this._save();
    this._notify();
  }

  switchCampaign(id) {
    if (this._campaigns.find(c => c.id === id)) {
      this._activeId = id;
      this._save();
      this._notify();
    }
  }

  /* --- Tokens --- */
  async addToken({ name, imageFile, maxHp, ac, initMod, count }) {
    const c = this.active;
    if (!c) return null;

    let imageId = null;
    let imgDataUrl = null;

    if (imageFile) {
      imageId = uid();
      const { compressImage } = await import('./utils.js');
      try {
        const compressed = await compressImage(imageFile);
        imgDataUrl = compressed.dataUrl;
        await saveImage(imageId, imgDataUrl);
      } catch (e) {
        console.warn('Image compression failed:', e);
      }
    }

    const token = {
      id: uid(),
      name: name || 'Criatura',
      imageId,
      imgDataUrl,
      x: 60 + Math.random() * 200,
      y: 60 + Math.random() * 200,
      hp: maxHp || 10,
      maxHp: maxHp || 10,
      ac: ac || 10,
      initMod: typeof initMod === 'number' ? initMod : 0,
      count: count || 1,
    };

    c.tokens.push(token);

    // Save to vault automatically if not already exists by name
    c.vault = c.vault || [];
    const presetName = token.name;
    const exists = c.vault.some(p => p.name.toLowerCase() === presetName.toLowerCase());
    if (!exists) {
      c.vault.push({
        id: uid(),
        name: presetName,
        imageId,
        imgDataUrl,
        maxHp: token.maxHp,
        ac: token.ac,
        initMod: token.initMod
      });
    }

    c.updatedAt = Date.now();
    this._save();
    this._notify();
    return token;
  }

  updateToken(id, updates) {
    return this._withActive(c => {
      const t = c.tokens.find(tk => tk.id === id);
      if (!t) return;
      Object.assign(t, updates);
      // Clamp HP
      if ('hp' in updates) t.hp = Math.max(0, Math.min(t.hp, t.maxHp));
    });
  }

  removeToken(id) {
    return this._withActive(c => {
      const idx = c.tokens.findIndex(t => t.id === id);
      if (idx < 0) return;
      const t = c.tokens[idx];
      if (t.imageId) deleteImage(t.imageId).catch(() => {});
      c.tokens.splice(idx, 1);
      // Also remove from initiative
      c.initiative = c.initiative.filter(e => e.refId !== id);
      this._fixTurnIndex(c);
    });
  }

  /* --- Players --- */
  addPlayer({ name, maxHp, ac }) {
    return this._withActive(c => {
      const p = {
        id: uid(),
        name: name || 'Jugador',
        hp: maxHp || 20,
        maxHp: maxHp || 20,
        ac: ac || 10,
      };
      c.players.push(p);
      return p;
    });
  }

  updatePlayer(id, updates) {
    return this._withActive(c => {
      const p = c.players.find(pl => pl.id === id);
      if (!p) return;
      Object.assign(p, updates);
      if ('hp' in updates) p.hp = Math.max(0, Math.min(p.hp, p.maxHp));
    });
  }

  removePlayer(id) {
    return this._withActive(c => {
      const idx = c.players.findIndex(p => p.id === id);
      if (idx < 0) return;
      c.players.splice(idx, 1);
      c.initiative = c.initiative.filter(e => e.refId !== id);
      this._fixTurnIndex(c);
    });
  }

  /* --- Initiative --- */
  generateInitiative() {
    return this._withActive(c => {
      const entries = [];

      c.tokens.forEach(t => {
        const mod = typeof t.initMod === 'number' ? t.initMod : 0;
        entries.push({
          id: uid(),
          refId: t.id,
          type: 'token',
          name: t.name,
          roll: Math.floor(Math.random() * 20) + 1 + Math.max(0, mod),
          hp: t.hp,
          maxHp: t.maxHp,
          ac: t.ac,
          initMod: mod,
        });
      });

      c.players.forEach(p => {
        entries.push({
          id: uid(),
          refId: p.id,
          type: 'player',
          name: p.name,
          roll: 0,
          hp: p.hp,
          maxHp: p.maxHp,
          ac: p.ac,
          initMod: 0,
        });
      });

      // Sort descending by roll
      entries.sort((a, b) => b.roll - a.roll);
      c.initiative = entries;
      c.activeTurnIndex = entries.length > 0 ? 0 : -1;
      c.round = entries.length > 0 ? 1 : 0;
    });
  }

  clearInitiative() {
    return this._withActive(c => {
      c.initiative = [];
      c.activeTurnIndex = -1;
      c.round = 0;
    });
  }

  updateInitiativeEntry(entryId, updates) {
    return this._withActive(c => {
      const e = c.initiative.find(en => en.id === entryId);
      if (!e) return;
      Object.assign(e, updates);
      // Sync HP back to source (directly, without triggering another _notify)
      if ('hp' in updates) {
        const hp = Math.max(0, Math.min(updates.hp, e.maxHp));
        e.hp = hp;
        if (e.type === 'token') {
          const t = c.tokens.find(tk => tk.id === e.refId);
          if (t) t.hp = hp;
        } else {
          const p = c.players.find(pl => pl.id === e.refId);
          if (p) p.hp = hp;
        }
      }
    });
  }

  sortInitiative() {
    return this._withActive(c => {
      const current = c.initiative[c.activeTurnIndex];
      c.initiative.sort((a, b) => b.roll - a.roll);
      if (current) {
        c.activeTurnIndex = c.initiative.findIndex(e => e.id === current.id);
        if (c.activeTurnIndex < 0) c.activeTurnIndex = 0;
      }
    });
  }

  nextTurn() {
    return this._withActive(c => {
      if (c.initiative.length === 0) return;
      c.activeTurnIndex++;
      if (c.activeTurnIndex >= c.initiative.length) {
        c.activeTurnIndex = 0;
        c.round++;
      }
    });
  }

  prevTurn() {
    return this._withActive(c => {
      if (c.initiative.length === 0) return;
      c.activeTurnIndex--;
      if (c.activeTurnIndex < 0) {
        c.activeTurnIndex = c.initiative.length - 1;
        c.round = Math.max(1, c.round - 1);
      }
    });
  }

  _fixTurnIndex(c) {
    if (c.initiative.length === 0) {
      c.activeTurnIndex = -1;
      c.round = 0;
    } else if (c.activeTurnIndex >= c.initiative.length) {
      c.activeTurnIndex = 0;
    }
  }

  /* --- Locations --- */
  _saveCurrentLocationState(c) {
    if (!c.locations) {
      const locId = uid();
      c.locations = [{
        id: locId,
        name: 'General',
        tokens: c.tokens || [],
        initiative: c.initiative || [],
        activeTurnIndex: c.activeTurnIndex !== undefined ? c.activeTurnIndex : -1,
        round: c.round || 0
      }];
      c.activeLocationId = locId;
    }
    const loc = c.locations.find(l => l.id === c.activeLocationId);
    if (loc) {
      loc.tokens = JSON.parse(JSON.stringify(c.tokens));
      loc.initiative = JSON.parse(JSON.stringify(c.initiative));
      loc.activeTurnIndex = c.activeTurnIndex;
      loc.round = c.round;
    }
  }

  createLocation(name) {
    return this._withActive(c => {
      this._saveCurrentLocationState(c);
      
      const locId = uid();
      const loc = {
        id: locId,
        name: name || 'Nueva Localización',
        tokens: [],
        initiative: [],
        activeTurnIndex: -1,
        round: 0
      };
      
      c.locations = c.locations || [];
      c.locations.push(loc);
      c.activeLocationId = locId;
      
      c.tokens = loc.tokens;
      c.initiative = loc.initiative;
      c.activeTurnIndex = loc.activeTurnIndex;
      c.round = loc.round;
      
      return loc;
    });
  }

  switchLocation(locId) {
    return this._withActive(c => {
      if (c.activeLocationId === locId) return;
      
      this._saveCurrentLocationState(c);
      
      const loc = c.locations.find(l => l.id === locId);
      if (!loc) return;
      
      c.activeLocationId = locId;
      
      c.tokens = loc.tokens || [];
      c.initiative = loc.initiative || [];
      c.activeTurnIndex = loc.activeTurnIndex !== undefined ? loc.activeTurnIndex : -1;
      c.round = loc.round || 0;
    });
  }

  deleteLocation(locId) {
    return this._withActive(c => {
      c.locations = c.locations || [];
      if (c.locations.length <= 1) return;
      
      const idx = c.locations.findIndex(l => l.id === locId);
      if (idx < 0) return;
      
      const loc = c.locations[idx];
      const tokensToDelete = loc.id === c.activeLocationId ? c.tokens : loc.tokens;
      tokensToDelete.forEach(t => {
        if (t.imageId) deleteImage(t.imageId).catch(() => {});
      });
      
      c.locations.splice(idx, 1);
      
      if (c.activeLocationId === locId) {
        const nextLoc = c.locations[0];
        c.activeLocationId = nextLoc.id;
        c.tokens = nextLoc.tokens || [];
        c.initiative = nextLoc.initiative || [];
        c.activeTurnIndex = nextLoc.activeTurnIndex !== undefined ? nextLoc.activeTurnIndex : -1;
        c.round = nextLoc.round || 0;
      }
    });
  }

  renameLocation(locId, newName) {
    return this._withActive(c => {
      c.locations = c.locations || [];
      const loc = c.locations.find(l => l.id === locId);
      if (loc) {
        loc.name = newName;
      }
    });
  }

  /* --- Vault --- */
  addTokenToVault(token) {
    return this._withActive(c => {
      c.vault = c.vault || [];
      const preset = {
        id: uid(),
        name: token.name,
        imageId: token.imageId,
        imgDataUrl: token.imgDataUrl,
        maxHp: token.maxHp,
        ac: token.ac,
        saveDc: token.saveDc
      };
      c.vault.push(preset);
    });
  }

  async addPresetToVault({ name, maxHp, ac, initMod, imageFile }) {
    const c = this.active;
    if (!c) return null;

    let imageId = null;
    let imgDataUrl = null;

    if (imageFile) {
      imageId = uid();
      const { compressImage } = await import('./utils.js');
      try {
        const compressed = await compressImage(imageFile);
        imgDataUrl = compressed.dataUrl;
        await saveImage(imageId, imgDataUrl);
      } catch (e) {
        console.warn('Image compression failed:', e);
      }
    }

    const preset = {
      id: uid(),
      name: name || 'Nueva Plantilla',
      imageId,
      imgDataUrl,
      maxHp: maxHp || 10,
      ac: ac || 10,
      initMod: typeof initMod === 'number' ? initMod : 0
    };

    c.vault = c.vault || [];
    c.vault.push(preset);
    c.updatedAt = Date.now();
    this._save();
    this._notify();
    return preset;
  }

  removePresetFromVault(presetId) {
    const c = this.active;
    if (!c) return;
    c.vault = c.vault || [];
    const idx = c.vault.findIndex(p => p.id === presetId);
    if (idx < 0) return;
    c.vault.splice(idx, 1);
    c.updatedAt = Date.now();
    this._save();
    this._notify();
  }

  spawnTokenFromVault(presetId) {
    return this._withActive(c => {
      c.vault = c.vault || [];
      const preset = c.vault.find(p => p.id === presetId);
      if (!preset) return null;

      const token = {
        id: uid(),
        name: preset.name,
        imageId: preset.imageId,
        imgDataUrl: preset.imgDataUrl,
        x: 60 + Math.random() * 200,
        y: 60 + Math.random() * 200,
        hp: preset.maxHp,
        maxHp: preset.maxHp,
        ac: preset.ac,
        initMod: typeof preset.initMod === 'number' ? preset.initMod : 0,
        count: 1
      };
      c.tokens.push(token);
      return token;
    });
  }

  /* --- Theme --- */
  setTheme(themeId) {
    return this._withActive(c => {
      c.theme = themeId;
    });
  }

  setCustomTheme(colors) {
    return this._withActive(c => {
      c.theme = 'custom';
      c.customTheme = colors;
    });
  }

  /* --- Sync HP from initiative to source --- */
  syncHpToSource(entryId) {
    const c = this.active;
    if (!c) return;
    const e = c.initiative.find(en => en.id === entryId);
    if (!e) return;
    if (e.type === 'token') {
      const t = c.tokens.find(tk => tk.id === e.refId);
      if (t) t.hp = e.hp;
    } else {
      const p = c.players.find(pl => pl.id === e.refId);
      if (p) p.hp = e.hp;
    }
    c.updatedAt = Date.now();
    this._save();
    this._notify();
  }
}

/* Singleton */
export const state = new StateManager();
