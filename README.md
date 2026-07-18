# DM Board — Tablero de Combate para Dungeon Master

Aplicación web **100% local** para gestionar combates de D&D y otros TTRPGs.  
Sin servidor externo, sin cuenta, sin datos en la nube. Todo se guarda en tu navegador.

![DM Board](https://img.shields.io/badge/TTRPG-DM%20Board-8b5cf6?style=flat-square) ![Offline](https://img.shields.io/badge/offline-100%25-22c55e?style=flat-square) ![Ollama](https://img.shields.io/badge/AI-Ollama%20local-f59e0b?style=flat-square)

---

## Características

- **Tablero de combate** — fichas con imágenes arrastrables, panel de vida/CA adjunto
- **Multi-campaña** — datos separados por campaña, cambiar entre ellas sin mezclar
- **Localizaciones** — prepara varias salas/encuentros por campaña y cambia entre ellas al instante
- **Almacén de criaturas (Vault)** — guarda plantillas de enemigos y clónalos con un clic
- **Iniciativa** — orden automático con modificador de DEX, avance de turnos, rondas
- **Jugadores** — panel separado con gestión de vida rápida
- **Temas** — 5 predefinidos + personalizado con selector de colores
- **Persistencia** — todo guardado en `localStorage` + `IndexedDB` (imágenes)
- **Offline** — funciona sin conexión una vez cargada

---

## Cómo ejecutar

La app usa módulos ES, necesita servirse desde un servidor HTTP local (no sirve abrir el `.html` directamente):

```bash
# Opción A — Python (sin instalar nada extra)
cd dm-board
python3 -m http.server 8080

# Opción B — Node.js
npx serve .
```

Luego abre `http://localhost:8080` en tu navegador.

---

## Lectura automática de fichas con IA (opcional)

DM Board puede leer imágenes de fichas de criaturas (stat blocks) y rellenar automáticamente el nombre, HP, CA y modificador de iniciativa (DEX).

Requiere **[Ollama](https://ollama.com)** con un modelo de visión instalado localmente:

```bash
# Instalar un modelo de visión (elige uno)
ollama pull gemma4        # ~10 GB — muy buena calidad
ollama pull llava         # ~4 GB  — más ligero
ollama pull minicpm-v     # ~5 GB  — excelente para texto estructurado
```

> **Privacidad total:** la imagen nunca sale de tu ordenador. Ollama corre localmente en el puerto `11434`.

Una vez Ollama esté en marcha, sube la imagen de la ficha al editor de criatura y pulsa **🔍 Leer estadísticas automáticamente**.

---

## Atajos de teclado

| Tecla | Acción |
|:---|:---|
| `Espacio` | Siguiente turno en iniciativa |
| `Ctrl+N` | Nueva criatura |
| `Ctrl+I` | Generar iniciativa |

---

## Estructura del proyecto

```
dm-board/
├── index.html          # Punto de entrada
├── start.sh            # Script de arranque rápido (macOS/Linux)
├── css/
│   ├── base.css        # Reset, layout, tipografía, botones
│   ├── components.css  # Tokens, iniciativa, modal, tabs, vault
│   └── themes.css      # 5 paletas de tema + custom
└── js/
    ├── app.js          # Orquestador principal, UI, editor de criaturas
    ├── board.js        # Tablero drag-and-drop (pointer events)
    ├── state.js        # Estado + persistencia (localStorage + IndexedDB)
    ├── themes.js       # Sistema de temas
    └── utils.js        # Compresión de imágenes, utilidades
```

---

## Requisitos

- Navegador moderno con soporte ES Modules (Chrome, Firefox, Edge, Safari)
- Python 3 o Node.js para el servidor local
- *(Opcional)* Ollama para la lectura automática de fichas

## Licencia

MIT — libre para usar, modificar y distribuir.
