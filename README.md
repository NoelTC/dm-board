# DM Board — Combat Tracker / Tablero de Combate

> 🌐 [English](#english) · [Español](#español)

![DM Board](https://img.shields.io/badge/TTRPG-DM%20Board-8b5cf6?style=flat-square) ![Offline](https://img.shields.io/badge/offline-100%25-22c55e?style=flat-square) ![Ollama](https://img.shields.io/badge/AI-Ollama%20local-f59e0b?style=flat-square) ![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

---

## English

A **100% local** web app for managing D&D and other TTRPG combat encounters.  
No server, no account, no cloud. Everything is saved in your browser.

### Features

- **Combat board** — draggable creature tokens with HP/AC panel
- **Multi-campaign** — separate data per campaign, switch without mixing
- **Locations / Scenes** — prepare multiple rooms per campaign and switch instantly
- **Creature Vault** — save creature templates and clone them with one click
- **Initiative tracker** — auto-roll with DEX modifier, turn advance, round counter
- **Players panel** — quick HP management for player characters
- **Themes** — 5 presets + fully custom color picker
- **Persistence** — saved in `localStorage` + `IndexedDB` (images)
- **Offline** — works without internet once loaded
- **Language** — switch between 🇪🇸 Spanish and 🇬🇧 English in the UI

### How to run

ES Modules require an HTTP server — opening the `.html` file directly won't work.

```bash
# Option A — Python (no extra installs)
cd dm-board
python3 -m http.server 8080

# Option B — Node.js
npx serve .
```

Then open `http://localhost:8080` in your browser.

### AI stat block reader (optional)

DM Board can read creature stat block images and automatically fill in Name, HP, AC and initiative modifier (DEX).

Requires **[Ollama](https://ollama.com)** with a vision model installed locally:

```bash
# Pick one model to install
ollama pull gemma4        # ~10 GB — best quality
ollama pull llava         # ~4 GB  — lighter
ollama pull minicpm-v     # ~5 GB  — great for structured text
```

> **Full privacy:** the image never leaves your machine. Ollama runs locally on port `11434`.

Once Ollama is running, upload the stat block image in the creature editor and click **🔍 Read stats automatically**.

### Keyboard shortcuts

| Key | Action |
|:---|:---|
| `Space` | Next initiative turn |
| `Ctrl+N` | New creature |
| `Ctrl+I` | Roll initiative |

### How to add a new language

1. Open [`js/i18n.js`](js/i18n.js)
2. Copy the `en` object and create a new entry (e.g. `fr: { ... }`)
3. Translate all values
4. In [`js/app.js`](js/app.js), update `initLangToggle()` to cycle through your new language

### Project structure

```
dm-board/
├── index.html          # Entry point
├── start.sh            # Quick-start script (macOS/Linux)
├── css/
│   ├── base.css        # Reset, layout, typography, buttons
│   ├── components.css  # Tokens, initiative, modal, tabs, vault
│   └── themes.css      # 5 theme palettes + custom
└── js/
    ├── app.js          # Main orchestrator, UI, creature editor
    ├── board.js        # Drag-and-drop board (pointer events)
    ├── i18n.js         # 🌐 Translations (ES/EN) — add strings here
    ├── state.js        # State + persistence (localStorage + IndexedDB)
    ├── themes.js       # Theme system
    └── utils.js        # Image compression, utilities
```

### Requirements

- Modern browser with ES Modules support (Chrome, Firefox, Edge, Safari)
- Python 3 or Node.js for the local server
- *(Optional)* Ollama for automatic stat block reading

---

## Español

Aplicación web **100% local** para gestionar combates de D&D y otros TTRPGs.  
Sin servidor externo, sin cuenta, sin datos en la nube. Todo se guarda en tu navegador.

### Características

- **Tablero de combate** — fichas de criaturas arrastrables con panel de vida/CA
- **Multi-campaña** — datos separados por campaña, cambiar sin mezclar
- **Localizaciones** — prepara varias salas/encuentros por campaña y cambia al instante
- **Almacén de criaturas** — guarda plantillas de enemigos y clónalos con un clic
- **Tracker de iniciativa** — tirada automática con mod. de DEX, avance de turnos, rondas
- **Panel de jugadores** — gestión rápida de vida para personajes jugadores
- **Temas** — 5 predefinidos + selector de colores personalizado
- **Persistencia** — guardado en `localStorage` + `IndexedDB` (imágenes)
- **Offline** — funciona sin conexión una vez cargada
- **Idioma** — cambia entre 🇪🇸 Español e 🇬🇧 Inglés desde la interfaz

### Cómo ejecutar

Los módulos ES necesitan un servidor HTTP — abrir el `.html` directamente no funciona.

```bash
# Opción A — Python (sin instalar nada extra)
cd dm-board
python3 -m http.server 8080

# Opción B — Node.js
npx serve .
```

Luego abre `http://localhost:8080` en tu navegador.

### Lectura automática de fichas con IA (opcional)

DM Board puede leer imágenes de fichas de criaturas y rellenar automáticamente el nombre, HP, CA y modificador de iniciativa (DEX).

Requiere **[Ollama](https://ollama.com)** con un modelo de visión instalado localmente:

```bash
# Elige un modelo
ollama pull gemma4        # ~10 GB — muy buena calidad
ollama pull llava         # ~4 GB  — más ligero
ollama pull minicpm-v     # ~5 GB  — excelente para texto estructurado
```

> **Privacidad total:** la imagen nunca sale de tu ordenador. Ollama corre en local en el puerto `11434`.

Una vez Ollama esté en marcha, sube la imagen al editor de criatura y pulsa **🔍 Leer estadísticas automáticamente**.

### Atajos de teclado

| Tecla | Acción |
|:---|:---|
| `Espacio` | Siguiente turno en iniciativa |
| `Ctrl+N` | Nueva criatura |
| `Ctrl+I` | Generar iniciativa |

### Cómo añadir un nuevo idioma

1. Abre [`js/i18n.js`](js/i18n.js)
2. Copia el objeto `es` y crea una nueva entrada (ej. `fr: { ... }`)
3. Traduce todos los valores
4. En [`js/app.js`](js/app.js), actualiza `initLangToggle()` para que cicle por el nuevo idioma

### Licencia

MIT — libre para usar, modificar y distribuir.
