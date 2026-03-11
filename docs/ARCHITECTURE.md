# 系统架构文档

> 文档导航：[`README（中文）`](../README.md) | [`README_EN`](../README_EN.md) | [`项目缘起`](./PROJECT_STORY.md) | [`开发进度`](./PROGRESS.md) | [`API`](./API.md) | [`部署`](./DEPLOYMENT.md)

## 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Vue 3)                        │
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │  Generate    │    │   Refine     │    │  Plotly       │  │
│  │  View        │    │   View       │    │  Renderer     │  │
│  └──────┬───────┘    └──────┬───────┘    └───────┬───────┘  │
│         │                   │                     │           │
│  ┌──────▼───────────────────▼─────────────────────▼───────┐  │
│  │              Pinia Store + Socket.io Client              │  │
│  └──────────────────────────┬────────────────────────────┘  │
│                             │                                 │
│  ┌──────────────────────────▼────────────────────────────┐  │
│  │                    Vue Router + Auth                    │  │
│  │  LoginView / AdminView / (Generate/Refine/History)       │  │
│  └──────────────────────────┬────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────┘
                               │  WebSocket + HTTP
┌─────────────────────────────▼───────────────────────────────┐
│                      Node.js Backend                          │
│                                                               │
│  ┌────────────────────┐   ┌──────────────────────────────┐  │
│  │   REST API          │   │   Socket.io Server             │  │
│  │   /api/generate     │   │   generate:start               │  │
│  │   /api/refine       │   │   (plotly 渲染在后端完成)      │  │
│  │   /api/auth/*       │   │                                │  │
│  │   /api/admin/*      │   │                                │  │
│  └─────────┬──────────┘   └───────────────┬──────────────┘  │
│            │                               │                  │
│  ┌─────────▼───────────────────────────────▼────────────┐   │
│  │                  Middleware Layer                     │   │
│  │  authMiddleware / requireOrg / tenancy                │   │
│  └──────────────────────────┬───────────────────────────┘   │
│            │                               │                  │
│  ┌─────────▼───────────────────────────────▼────────────┐   │
│  │                  PaperVizProcessor                     │   │
│  │  (流水线编排 + 并发任务管理)                           │   │
│  └──────────────────────────┬───────────────────────────┘   │
│                              │                                │
│  ┌───────────────────────────▼──────────────────────────┐   │
│  │                    Agent 体系                          │   │
│  │                                                        │   │
│  │  RetrieverAgent → PlannerAgent → StylistAgent          │   │
│  │       ↓                                                │   │
│  │  VisualizerAgent ←────── CriticAgent                   │   │
│  │  (循环最多3轮)                                         │   │
│  └──────────────────────────┬───────────────────────────┘   │
│                              │                                │
│  ┌───────────────────────────▼──────────────────────────┐   │
│  │                    LLMService                          │   │
│  │  Gemini API (@google/genai)  │  OpenAI API (openai)   │   │
│  └───────────────────────────────────────────────────────┘   │
│                              │                                │
│  ┌───────────────────────────▼──────────────────────────┐   │
│  │                    Data Layer                           │   │
│  │  MySQL (用户/组织/积分) + SQLite (历史记录)             │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Vue 3)                        │
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │  Generate    │    │   Refine     │    │  Plotly       │  │
│  │  View        │    │   View       │    │  Renderer     │  │
│  └──────┬───────┘    └──────┬───────┘    └───────┬───────┘  │
│         │                   │                     │           │
│  ┌──────▼───────────────────▼─────────────────────▼───────┐  │
│  │              Pinia Store + Socket.io Client              │  │
│  └──────────────────────────┬────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────┘
                               │  WebSocket + HTTP
┌─────────────────────────────▼───────────────────────────────┐
│                      Node.js Backend                          │
│                                                               │
│  ┌────────────────────┐   ┌──────────────────────────────┐  │
│  │   REST API          │   │   Socket.io Server           │  │
│  │   /api/generate     │   │   generate:start             │  │
│  │   /api/refine       │   │   (plotly 渲染在后端完成)      │  │
│  │   /api/health       │   │                              │  │
│  └─────────┬──────────┘   └───────────────┬──────────────┘  │
│            │                               │                  │
│  ┌─────────▼───────────────────────────────▼────────────┐   │
│  │                  PaperVizProcessor                     │   │
│  │  (流水线编排 + 并发任务管理)                           │   │
│  └──────────────────────────┬───────────────────────────┘   │
│                              │                                │
│  ┌───────────────────────────▼──────────────────────────┐   │
│  │                    Agent 体系                          │   │
│  │                                                        │   │
│  │  RetrieverAgent → PlannerAgent → StylistAgent          │   │
│  │       ↓                                                │   │
│  │  VisualizerAgent ←────── CriticAgent                   │   │
│  │  (循环最多3轮)                                         │   │
│  └──────────────────────────┬───────────────────────────┘   │
│                              │                                │
│  ┌───────────────────────────▼──────────────────────────┐   │
│  │                    LLMService                          │   │
│  │  Gemini API (@google/genai)  │  OpenAI API (openai)   │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 关键流程

### 1. 图表（Diagram）生成流程

```
用户输入
  │
  ▼
WebSocket: generate:start
  │
  ▼
[并行 N 个候选]
  │
  ├─ RetrieverAgent  ── Gemini文本模型 ──> top10 参考ID列表
  │
  ├─ PlannerAgent    ── Gemini文本模型 ──> 详细图像描述
  │                      (in-context learning，含参考图片)
  │
  ├─ StylistAgent    ── Gemini文本模型 ──> 美化后的描述
  │                      (基于NeurIPS风格指南)
  │
  └─ [Critic 循环，最多3轮]
       │
       ├─ VisualizerAgent ── Gemini图像生成 ──> base64 图片
       │
       └─ CriticAgent     ── Gemini文本模型 ──> 修订描述
              │
       (若"No changes needed" 则提前终止)
  │
  ▼
WebSocket: generate:candidate_complete (每完成一个候选时)
  │
  ▼
WebSocket: generate:all_complete
```

### 2. 统计图（Plot）生成流程

统计图流程的关键差异：**先生成 Plotly figure JSON，再由后端 headless 渲染为图片**。  
该路径适用于 Visualizer 流程，也适用于 `vanilla`（快速直出）模式。

```
VisualizerAgent
  │── Gemini文本模型 ──> Plotly figure JSON
  │
  ▼
Backend PlotlyRenderService (headless)
  │── Plotly.toImage(..., { scale: 3 }) ──> base64 PNG
  │
  ▼
CriticAgent
  │── Gemini文本模型(多模态) ──> 修订后的描述
  │
  ▼
[下一轮 Critic 循环 或 完成]
```

### 3. 图片精炼（Refine）流程

```
用户上传图片 + 描述修改需求
  │
  ▼
POST /api/refine
  │
  ├─ PolishAgent
  │    ├─ [Step 1] Gemini文本模型 分析图片 + 风格指南 → 改进建议列表
  │    └─ [Step 2] Gemini图像生成 应用建议 → 高清精炼图片
  │
  ▼
返回精炼后的图片（base64）
```

## Agent 体系设计

### BaseAgent

```javascript
class BaseAgent {
  constructor({ expConfig, llmService })
  // 子类必须实现：
  async process(data) {}
}
```

所有 Agent 通过 `LLMService` 调用 AI，不直接依赖 SDK，便于切换模型提供商。

### LLMService

统一封装 Gemini 和 OpenAI 调用，提供重试机制：

```javascript
class LLMService {
  async generateText({ model, systemPrompt, contents, config })
  async generateImage({ model, prompt, imageInput, config })
  async #callWithRetry(fn, maxAttempts, retryDelay)
}
```

### PaperVizProcessor

根据 `expMode` 编排 Agent 流水线：

| 显示名（前端） | expMode（API） | 流水线 |
|---------|--------|--------|
| 快速直出 | `vanilla` | VanillaAgent |
| 智能迭代（推荐） | `demo_planner_critic` | Retriever → Planner → Visualizer → Critic(×N) |
| 全流程增强 | `demo_full` | Retriever → Planner → Stylist → Visualizer → Critic(×N) |

> 兼容说明：历史中的 `dev_planner_critic`、`dev_full` 会被归一化映射到 `demo_planner_critic`、`demo_full`。

## WebSocket 事件协议

### Client → Server

| 事件 | 数据 | 说明 |
|------|------|------|
| `generate:start` | `{ jobId, inputs[], expMode, retrievalSetting, modelName }` | 开始生成任务 |
| （无） | — | plot 渲染在后端本地完成，无需客户端回传 |

### Server → Client

| 事件 | 数据 | 说明 |
|------|------|------|
| `generate:progress` | `{ jobId, candidateId, stage, message, percent }` | 进度更新 |
| （无） | — | plot 渲染在后端本地完成，无需客户端事件 |
| `generate:candidate_complete` | `{ jobId, candidateId, result }` | 单个候选完成 |
| `generate:all_complete` | `{ jobId, results[] }` | 所有候选完成 |
| `generate:error` | `{ jobId, candidateId, error }` | 出错 |

## 数据目录结构

```
DATA_DIR/
└── PaperBananaBench/
    ├── diagram/
    │   ├── images/          # 参考图表图片
    │   ├── ref.json         # 参考示例元数据（200条）
    │   └── test.json        # 测试集
    └── plot/
        ├── images/
        ├── ref.json
        └── test.json
```

`DATA_DIR` 通过环境变量配置，不设置时系统自动降级为 `retrieval_setting=none`。

## 风格指南

`style_guides/` 目录包含从 NeurIPS 2025 论文中自动提炼的审美指南，StylistAgent 和 PolishAgent 在运行时读取：

- `neurips2025_diagram_style_guide.md`：图表审美规范
- `neurips2025_plot_style_guide.md`：统计图审美规范

需将原项目 `style_guides/` 目录软链接或复制到本项目根目录。
