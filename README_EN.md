<div align="center">

# 🍌 PaperSketch JS / 智绘论文图

**Automated academic figure generation platform powered by Vue 3 + Node.js**

An enhanced JavaScript edition of [PaperBanana](https://github.com/dwzhu-pku/PaperBanana) and PaperVizAgent

[![Version](https://img.shields.io/badge/version-0.2.0-orange.svg)](./CHANGELOG.md)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.5-brightgreen.svg)](https://nodejs.org/)
[![Vue](https://img.shields.io/badge/vue-3.x-42b883.svg)](https://vuejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/xuanyustudio/papersketch-js/pulls)
[![Changelog](https://img.shields.io/badge/changelog-view-lightgrey.svg)](./CHANGELOG.md)

[中文](./README.md) · [Project Story](./docs/PROJECT_STORY.md) · [Architecture](./docs/ARCHITECTURE.md) · [API Docs](./docs/API.md) · [Deployment](./docs/DEPLOYMENT.md) · [Progress](./docs/PROGRESS.md)

</div>

---

## Screenshots

<table>
  <tr>
    <td><img src="./screenshot/home.png" alt="Generate Page" /></td>
    <td><img src="./screenshot/home2.png" alt="Candidate Results" /></td>
  </tr>
  <tr>
    <td align="center">📝 Generate Page (Input + Settings)</td>
    <td align="center">🎨 Multi-candidate Parallel Generation</td>
  </tr>
  <tr>
    <td><img src="./screenshot/history.png" alt="History" /></td>
    <td><img src="./screenshot/history-detail.png" alt="History Detail" /></td>
  </tr>
  <tr>
    <td align="center">📚 History List</td>
    <td align="center">🔍 Candidate Detail & Step Trace</td>
  </tr>
</table>

---

## What is it?

Paste your methodology section and figure caption — the system automatically runs a multi-agent pipeline to plan, generate, review, and iterate, producing a set of candidate academic figures saved locally.

```
Input: methodology text + figure caption
  ↓
Retriever → Planner → Stylist → Visualizer → Critic (multi-round)
  ↓
Output: candidate figures + step logs + local storage
```

---

## Key Features

| Feature | Description |
|---------|-------------|
| 🤖 Multi-agent pipeline | Retriever / Planner / Stylist / Visualizer / Critic |
| 🎛️ Three generation modes | Smart Iteration / Full Enhanced / Fast Direct |
| 🖼️ Parallel candidates | 1–5 candidates generated in parallel per job |
| 📊 Backend plot rendering | Plotly.js + Puppeteer headless, no frontend round-trip |
| ⚡ Real-time progress | WebSocket step-by-step progress per agent |
| 🔍 Step log tracing | Inspect intermediate outputs for each candidate |
| 💾 Local persistence | SQLite history + image files on disk |
| 🔄 Resume after restart | Checkpoint mechanism, auto-resumes interrupted jobs |
| 🧠 Multi-model support | Gemini / fal.ai / Doubao (configurable) |
| 🆘 Built-in Help Center | Beginner guide with principles, steps, and FAQ |

---

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | Vue 3 + Vite + Composition API |
| UI | Element Plus |
| State | Pinia |
| Plot Rendering | Plotly.js |
| Realtime | Socket.io |
| Backend | Node.js + Express |
| AI SDK | @google/genai + openai |
| Logging | Winston |
| Persistence | SQLite (node:sqlite) + local file system |

---

## Quick Start

### 1) Requirements

- Node.js >= 22.5 (requires built-in `node:sqlite`)
- pnpm (recommended) or npm

### 2) Install dependencies

```bash
cd backend && pnpm install
cd ../frontend && pnpm install
```

### 3) Configure environment

```bash
cd backend
cp .env.example .env
# Fill in your API keys and model config
```

> If the frontend shows a ".env missing" warning on startup, refer to `.env.example` to complete the configuration.

### 4) Start in development

```bash
# Terminal 1: backend
cd backend && pnpm dev

# Terminal 2: frontend
cd frontend && pnpm dev
```

Open `http://localhost:5173`

### 5) Production deploy

```bash
cd frontend && pnpm build
cd ../backend && pnpm start
```

Full deployment guide (Nginx / Docker / PM2): [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)

---

## Comparison with the Python Version

| Feature | Python (PaperBanana) | JS (PaperSketch JS) |
|---------|----------------------|---------------------|
| Statistical plots | matplotlib Python execution | Plotly spec + backend headless render |
| Web UI | Streamlit | Vue 3 + Element Plus |
| Real-time progress | Streamlit spinner | WebSocket live updates |
| History | None | SQLite + local image storage |
| Job recovery | None | Checkpoint + auto-resume |
| Multi-model | Limited | Gemini / fal.ai / Doubao |

---

## Contact

For questions, collaboration, or feedback:

- GitHub Issues: [Open an Issue](https://github.com/xuanyustudio/papersketch-js/issues)
- WeChat (please note your purpose when adding):

<img src="./screenshot/wx.jpg" alt="WeChat QR Code" width="180" />

---

## License

Apache-2.0
