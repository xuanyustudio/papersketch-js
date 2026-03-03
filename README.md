# 智绘论文图 / PaperSketch JS

基于 Vue 3 + Node.js 的学术论文插图自动生成平台，定位为 [PaperBanana](https://github.com/dwzhu-pku/PaperBanana) 和 PaperVizAgent 的 JavaScript 改进增强版本（JS Edition+）。

> 中文（默认） | English: [`README_EN.md`](./README_EN.md)

## 项目缘起

这个项目最初来自真实科研场景需求：  
2026 年元旦和老同学聚会后开始立项，他在中科院从事农业课题申报相关科研工作，存在持续且高频的论文配图需求。项目中途虽被其他方向打断，但最终决定先开源，以便让使用者与社区实时看到进度并参与迭代。

详细背景见：[`docs/PROJECT_STORY.md`](./docs/PROJECT_STORY.md)

## 文档导航

- 项目缘起与开发纪事：[`docs/PROJECT_STORY.md`](./docs/PROJECT_STORY.md)
- 开发进度与路线图：[`docs/PROGRESS.md`](./docs/PROGRESS.md)
- 系统架构：[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- API 文档：[`docs/API.md`](./docs/API.md)
- 部署文档：[`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)

## 功能特性

- **多 Agent 流水线**：Retriever → Planner → Stylist → Visualizer → Critic
- **并行候选生成**：最多同时生成 20 个候选图表
- **统计图后端渲染**：Plotly.js + headless 浏览器后端直接出图
- **实时进度推送**：WebSocket 展示每个 Agent 的处理进度
- **步骤日志可追踪**：每个候选的中间过程可查看、可回溯
- **本地持久化**：SQLite 历史记录 + 本地图片落盘
- **任务恢复能力**：支持中断后 checkpoint 恢复继续生成
- **多模型支持**：Gemini / fal.ai / Doubao 可切换

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Vue 3 + Vite + Composition API |
| UI 组件库 | Element Plus |
| 状态管理 | Pinia |
| 图表渲染 | Plotly.js |
| 实时通信 | Socket.io-client |
| 后端框架 | Node.js + Express |
| 实时通信 | Socket.io |
| AI SDK | @google/genai + openai |
| 日志 | Winston |
| 持久化 | SQLite + 本地文件系统 |

## 快速开始

### 1. 环境要求

- Node.js >= 18.0
- pnpm（推荐）或 npm

### 2. 安装依赖

```bash
# 安装后端依赖
cd backend
pnpm install

# 安装前端依赖
cd ../frontend
pnpm install
```

### 3. 配置环境变量

```bash
cd backend
cp .env.example .env
# 编辑 .env，填入 API Key 与模型配置
```

### 4. 配置数据目录（可选）

如需使用参考示例检索功能，需下载 [PaperBananaBench](https://huggingface.co/datasets/dwzhu/PaperBananaBench) 数据集，并在 `.env` 中设置 `DATA_DIR`。

未配置数据集时，系统自动降级为 `retrieval_setting=none`。

### 5. 启动开发服务器

```bash
# 终端1：后端
cd backend
pnpm dev

# 终端2：前端
cd frontend
pnpm dev
```

访问：`http://localhost:5173`

### 6. 生产部署

```bash
# 构建前端
cd frontend
pnpm build

# 启动后端（生产模式）
cd backend
pnpm start
```

完整部署方式见：[`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)

## 项目结构

```text
paperbanana-web/
├── backend/                   # Node.js 后端
│   └── src/
│       ├── agents/            # 多 Agent 实现
│       ├── services/          # LLM、渲染、流水线编排
│       ├── routes/            # REST API
│       ├── socket/            # WebSocket 事件处理
│       ├── middleware/        # 错误处理、限流
│       └── utils/             # 工具函数、提示词
├── frontend/                  # Vue 3 前端
│   └── src/
│       ├── views/
│       ├── components/
│       ├── stores/
│       ├── composables/
│       └── api/
└── docs/                      # 项目文档
```

## 与 Python 版本差异

| 特性 | Python 版 | JS 版 |
|------|-----------|-------|
| 统计图生成 | matplotlib 代码 + Python 执行 | Plotly figure JSON + 后端 headless 渲染 |
| Web UI | Streamlit | Vue 3 + Element Plus |
| 实时进度 | Streamlit spinner | WebSocket 实时推送 |
| 并发模型 | asyncio | Promise + EventEmitter |

## 开源说明

- 本项目受 PaperBanana 启发并进行工程化重写；
- 开源目标是持续可用、可追踪迭代，而非一次性 Demo；
- 欢迎通过 Issue/PR 反馈需求与问题。

## License

Apache-2.0
