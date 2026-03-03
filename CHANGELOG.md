# Changelog

所有显著变更均记录在此文件。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

---

## [Unreleased]

### 计划中
- 批量任务导入（多段方法节 / 多图注）
- 模板库（常见论文图结构）
- 更细粒度错误分类与用户侧可读提示

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

[Unreleased]: https://github.com/xuanyustudio/papersketch-js/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/xuanyustudio/papersketch-js/releases/tag/v0.1.0
