# PaperSketch JS / 智绘论文图

A Vue 3 + Node.js platform for academic figure generation, positioned as an enhanced JavaScript edition of [PaperBanana](https://github.com/dwzhu-pku/PaperBanana) and PaperVizAgent.

> English | 中文（默认）: [`README.md`](./README.md)

## Documentation Map

- Project story: [`docs/PROJECT_STORY.md`](./docs/PROJECT_STORY.md)
- Progress & roadmap: [`docs/PROGRESS.md`](./docs/PROGRESS.md)
- Architecture: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- API reference: [`docs/API.md`](./docs/API.md)
- Deployment: [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)

## Key Features

- Multi-agent pipeline: Retriever -> Planner -> Stylist -> Visualizer -> Critic
- Parallel candidate generation (up to 20 candidates)
- Plot generation via backend Plotly headless rendering
- Real-time progress updates through WebSocket
- Step logs for each candidate (traceable intermediate outputs)
- Local persistence (SQLite + local image storage)
- Resume support with checkpoints after restart
- Multi-model support (Gemini / fal.ai / Doubao)

## Tech Stack

| Layer | Stack |
|------|------|
| Frontend | Vue 3 + Vite + Composition API |
| UI | Element Plus |
| State | Pinia |
| Plot Rendering | Plotly.js |
| Realtime | Socket.io-client |
| Backend | Node.js + Express |
| AI SDK | @google/genai + openai |
| Logging | Winston |
| Persistence | SQLite + local file system |

## Quick Start

### 1) Requirements

- Node.js >= 18.0
- pnpm (recommended) or npm

### 2) Install dependencies

```bash
# backend
cd backend
pnpm install

# frontend
cd ../frontend
pnpm install
```

### 3) Configure environment

```bash
cd backend
cp .env.example .env
# edit .env
```

### 4) Optional dataset config

To enable retrieval examples, download [PaperBananaBench](https://huggingface.co/datasets/dwzhu/PaperBananaBench) and set `DATA_DIR` in `.env`.

### 5) Run in development

```bash
# terminal 1
cd backend
pnpm dev

# terminal 2
cd frontend
pnpm dev
```

Open `http://localhost:5173`.

## License

Apache-2.0

