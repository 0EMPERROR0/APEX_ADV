# A.P.E.X — Native Windows Desktop Application

A state-of-the-art multimodal AI agent built as a **native Windows desktop application** using **Python, PySide6, Qt WebEngine, and React**.

The application launches directly in its own standalone native window via:

```powershell
python main.py
```

It does **not** open Chrome, Edge, or an external browser window. All interface components, sound-reactive orb visualizations, live transcripts, file uploads, and settings run locally inside the embedded Qt WebEngine runtime.

---

## Architecture Overview

```text
A.P.E.X Architecture
┌─────────────────────────────────────────────────────────────┐
│                 PySide6 Native Desktop Window               │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │               Qt WebEngine (Embedded)                 │  │
│  │                                                       │  │
│  │   React + TypeScript UI (Compiled in /dist)           │  │
│  │   - Central Sound-Reactive Neural Orb                 │  │
│  │   - 5 Visualization Presets (Singularity, etc.)       │  │
│  │   - Docked Live Transcript Pane (Show/Hide)           │  │
│  │   - Manual Prompt & File Upload Tray                  │  │
│  │   - Voice Session Controls & Theme Switcher           │  │
│  └──────────────────────────┬────────────────────────────┘  │
│                             │ Qt WebChannel Transport       │
│  ┌──────────────────────────▼────────────────────────────┐  │
│  │               Python Desktop Bridge                   │  │
│  │            (desktop/bridge.py - QObject)              │  │
│  │   - Slots: sendMessage, synthesizeSpeech, etc.        │  │
│  │   - Signals: stateChanged, responseReceived, etc.     │  │
│  │   - Worker QThreads for non-blocking execution        │  │
│  └──────────────────────────┬────────────────────────────┘  │
│                             │                               │
│  ┌──────────────────────────▼────────────────────────────┐  │
│  │             Python Agent Service & Gemini             │  │
│  │               (desktop/agent_service.py)              │  │
│  │   - Secure API Key Handling (never exposed to UI)     │  │
│  │   - Multimodal Analysis (Images, PDFs, Audio, Code)   │  │
│  │   - Gemini TTS Speech Synthesis (Base64 WAV)          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

```text
APEX_ADV/
├── main.py                  # Python desktop entry point (python main.py)
├── desktop/
│   ├── __init__.py          # Package initialization
│   ├── window.py            # PySide6 native QMainWindow & Qt WebEngine view
│   ├── bridge.py            # Qt WebChannel QObject bridge
│   └── agent_service.py     # Python Gemini AI multimodal & TTS engine
├── dist/                    # Compiled static React assets (built via Vite)
│   ├── index.html           # Root entry with relative asset links (./assets/...)
│   └── assets/              # JavaScript, CSS, and font bundles
├── src/                     # React + TypeScript source code
│   ├── App.tsx              # Main interface & stage
│   ├── components/          # AudioOrb, LiveTranscript, PromptBar, TopNav
│   └── utils/
│       ├── desktopBridge.ts # Qt WebChannel connector with browser fallback
│       ├── qwebchannel.js   # Standard Qt WebChannel client library
│       └── audioEngine.ts   # Web Audio API analyzer & speech playback
├── build_desktop.bat        # Automated one-click Windows setup & launch script
├── pyinstaller.spec         # PyInstaller spec for building standalone APEX.exe
├── requirements.txt         # Python desktop dependencies (PySide6, etc.)
├── package.json             # Node.js dependencies & scripts
├── vite.config.ts           # Vite build config with base: './' for local files
└── README.md                # Documentation & Windows instructions
```

---

## Windows Setup & Launch Instructions

### Prerequisites
1. **Python 3.10+** (Ensure "Add Python to PATH" is checked during installation)
2. **Node.js 18+** (from [nodejs.org](https://nodejs.org))
3. A Google Gemini API Key

---

### Step-by-Step Installation (PowerShell or Command Prompt)

#### 1. Open Windows Terminal / PowerShell
Navigate to the project root directory:
```powershell
cd path\to\APEX_ADV
```

#### 2. Create and Activate a Python Virtual Environment
```powershell
python -m venv venv
.\venv\Scripts\activate
```

#### 3. Install Python Desktop Dependencies
```powershell
pip install -r requirements.txt
```

#### 4. Configure Your Gemini API Key
Create a `.env` file in the project root:
```ini
GEMINI_API_KEY="your_actual_gemini_api_key_here"
```

#### 5. Install Node.js Dependencies & Build Frontend
Build the React interface into local static files:
```powershell
npm install
npm run build
```
*(This produces the compiled assets in `./dist/index.html` with relative paths `./assets/...` that load directly into Qt WebEngine without a web server.)*

#### 6. Launch the Native Desktop Application
```powershell
python main.py
```

The application will immediately launch in its own native Windows frame titled **"A.P.E.X — Autonomous Desktop Agent"**.

---

## Automated One-Click Windows Setup

You can also run the provided batch script:
```powershell
.\build_desktop.bat
```
This automatically verifies Python and Node.js, creates the virtual environment, installs dependencies, builds the frontend, and launches `python main.py`.

---

## Packaging as a Standalone Windows Executable (.exe)

To bundle the application into a standalone Windows `.exe` that does **not** require Node.js or Python to be installed on target machines:

1. Ensure the frontend is built:
   ```powershell
   npm run build
   ```

2. Run PyInstaller with the provided specification:
   ```powershell
   pyinstaller pyinstaller.spec
   ```

3. The final packaged application will be generated in:
   ```text
   dist\APEX\APEX.exe
   ```

Double-clicking `APEX.exe` launches the native desktop app with zero external browser dependencies.

---

## Communication Bridge Protocol

The Python backend and React frontend communicate via **Qt WebChannel** (`apexBridge`):

| Slot / Method | Description |
|---|---|
| `bridge.sendMessage(json)` | Sends multimodal conversation to Python worker thread |
| `bridge.synthesizeSpeech(text, voice)` | Requests TTS WAV audio generation on Python side |
| `bridge.startVoiceSession()` | Signals start of microphone voice session |
| `bridge.stopVoiceSession()` | Signals termination of voice session |
| `bridge.emergencyStop()` | Aborts active background model generation immediately |
| `bridge.getSettings()` | Retrieves persisted JSON settings |
| `bridge.saveSettings(json)` | Persists application settings to local storage |

| Signal | Description |
|---|---|
| `stateChanged(state)` | Emits `'idle'`, `'listening'`, `'thinking'`, `'speaking'`, or `'error'` |
| `responseReceived(json)` | Delivers model text answer to React UI |
| `audioPlaybackReady(b64)` | Delivers synthesized speech audio to Web Audio visualizer |
| `errorOccurred(msg)` | Delivers error notices to the UI banner |

---

## Verification & Environment Notes

- **Verified in Development Sandbox**:
  - React + TypeScript code builds cleanly (`npm run build`).
  - Linting passes with zero errors (`tsc --noEmit`).
  - Relative asset paths (`./assets/...`) confirmed in `dist/index.html`.
  - Python scripts (`main.py`, `desktop/window.py`, `desktop/bridge.py`, `desktop/agent_service.py`) and PyInstaller specification syntax verified.
  - Hybrid fallback ensures that while running in web preview mode (such as the AI Studio dev server), the application communicates via Express proxy routes, while on Windows desktop it communicates via the native PySide6 `apexBridge`.
- **Requires Windows Desktop Environment**:
  - Running native GUI display windows (`PySide6.QtWidgets.QApplication`) requires a desktop windowing environment (Windows 10/11 or X11/Wayland with graphical display).
