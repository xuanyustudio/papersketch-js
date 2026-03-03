# 贡献指南 / Contributing Guide

感谢你愿意为 **智绘论文图 / PaperSketch JS** 贡献代码或反馈！

> English version follows below.

---

## 中文

### 参与方式

- **报告 Bug**：使用 [Bug Report 模板](./.github/ISSUE_TEMPLATE/bug_report.md) 提交 Issue
- **功能建议**：使用 [Feature Request 模板](./.github/ISSUE_TEMPLATE/feature_request.md) 提交 Issue
- **直接贡献代码**：Fork → 修改 → 提交 Pull Request

### 开发环境

```bash
# 1. Fork 并克隆
git clone https://github.com/YOUR_USERNAME/papersketch-js.git
cd papersketch-js

# 2. 安装依赖
cd backend && pnpm install
cd ../frontend && pnpm install

# 3. 配置环境变量
cd backend && cp .env.example .env
# 编辑 .env 填入你的 API Key

# 4. 启动
cd backend && pnpm dev      # 终端 1
cd frontend && pnpm dev     # 终端 2
```

### 提交规范

提交消息请使用语义化前缀：

| 前缀 | 说明 |
|------|------|
| `feat:` | 新功能 |
| `fix:` | Bug 修复 |
| `docs:` | 文档修改 |
| `refactor:` | 代码重构 |
| `chore:` | 构建/依赖/配置 |

示例：`feat: 新增批量任务导入功能`

### Pull Request 要求

- 描述清楚改动目的和验证方式
- 不要提交 `backend/.env`、`data/`、`node_modules/`
- 重大变更请先开 Issue 讨论

---

## English

### How to Contribute

- **Report a Bug**: Open an issue using the [Bug Report template](./.github/ISSUE_TEMPLATE/bug_report.md)
- **Suggest a Feature**: Open an issue using the [Feature Request template](./.github/ISSUE_TEMPLATE/feature_request.md)
- **Submit Code**: Fork → change → open a Pull Request

### Commit Style

Use semantic prefixes: `feat:` / `fix:` / `docs:` / `refactor:` / `chore:`

### Pull Request Rules

- Describe what changed and how you tested it
- Do not commit `backend/.env`, `data/`, or `node_modules/`
- For major changes, open an Issue first to discuss
