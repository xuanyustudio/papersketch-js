# Changelog

所有显著变更均记录在此文件。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

---

## [Unreleased]

### 计划中
- 批量任务导入（多段方法节 / 多图注）
- 模板库（常见论文图结构）
- 更细粒度错误分类与用户侧可读提示

---

## [0.2.0] - 2026-03-04

### 新增
- **手动精炼历史存档**：PolishAgent 精炼完成后自动保存原图 + 精炼后图 + 建议到 `refine_history` 表，历史页新增"手动精炼"标签页可查阅、删除
- **Doubao i2i 图生图支持**：新增 `doubao-seededit-3-0-i2i-250628` 模型，用于 PolishAgent 手动精炼，配置项 `IMAGE_POLISH_MODEL_NAME` 独立于主流水线
- **OpenAI 兼容中转**：`generateText` 支持通过 OpenAI 兼容接口调用 DeepSeek 等非 Gemini 文本模型，无需额外适配
- **生成图语言自适应**：所有系统提示词更新，图中标签/注释/标题随输入语言自动切换（中文输入→中文输出，英文输入→英文输出）
- **API 请求 URL 日志**：每次 LLM API 调用前打印完整请求 URL，便于排查中转站配置问题

### 修复
- **历史记录三图同链接 bug**：`imageStore.js` 正则从 `\w+` 改为 `[^_]+`，修复 Planner / Stylist / Critic R1 缩略图全部指向同一图片的问题
- **Critic 精炼图不进历史**：实现 `repairStepsImageUrls`，精炼轮次图片保存后回填到步骤日志 URL，历史详情步骤追溯完整显示
- **i2i 模型用作初始生成崩溃**：i2i 无参考图时改为优雅返回 `null` 并打印警告，不再抛出异常中断流水线
- **Doubao URL 重复 `/v1/v1/`**：`doubaoBaseUrl` 末尾 `/v1` 自动去重，防止拼接 URL 出现双重路径
- **Doubao i2i `size` 参数 451 错误**：从无效值 `adaptive` 修正为合法值 `1k`
- **Gemini API 版本默认 `v1beta`**：`geminiApiVersion` 硬编码为 `v1`，移除多余的 `GEMINI_API_VERSION` 环境变量

### 变更
- `DEFAULT_IMAGE_MODEL_NAME` 语义明确为主流水线（t2i）专用；i2i 模型请配置 `IMAGE_POLISH_MODEL_NAME`
- 历史页改为标签页布局：「生成历史」+「手动精炼」

---

## [0.1.0] - 2026-03-03

### 新增
- Vue 3 + Node.js 重写基础架构（原 Python PaperBanana）
- 多 Agent 流水线：Retriever / Planner / Stylist / Visualizer / Critic
- 三种生成模式：智能迭代 / 全流程增强 / 快速直出
- WebSocket 实时进度推送与步骤日志
- SQLite 本地历史记录（`node:sqlite` 内置模块）
- 生成图片本地硬盘持久化（`data/images/`）
- Checkpoint 机制：后端重启后自动续跑未完成任务
- 多模型支持：Gemini / fal.ai / 豆包（Doubao）
- Plotly.js + Puppeteer 后端 headless 统计图渲染
- 历史记录页支持重绘、步骤溯源、图片下载
- 流水线模式统一展示名（`exp_mode_label`）
- 动态文本超时策略（按 prompt 长度自动延长）
- 内置帮助中心页面（新手引导 + 高级原理）
- 侧边栏品牌名：智绘论文图 / PaperSketch JS

### 修复
- `better-sqlite3` 原生模块在 Windows 编译失败 → 改用 `node:sqlite`
- 历史图片显示"破图" → 补全 Vite 代理 `/images` 路径
- Critic 60s 超时导致候选失败 → 超时时间提升至 120s 并支持重试
- 模型 404 被误判为限流并重试 → 精确 `MODEL_NOT_FOUND` 错误分类
- `SettingsPanel` 频繁 429 → 模块级缓存 + 豁免限流路由

---

[Unreleased]: https://github.com/xuanyustudio/papersketch-js/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/xuanyustudio/papersketch-js/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/xuanyustudio/papersketch-js/releases/tag/v0.1.0
