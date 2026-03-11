# API 文档

> 文档导航：[`README（中文）`](../README.md) | [`README_EN`](../README_EN.md) | [`项目缘起`](./PROJECT_STORY.md) | [`开发进度`](./PROGRESS.md) | [`系统架构`](./ARCHITECTURE.md) | [`部署`](./DEPLOYMENT.md)

## REST API

### 基础 URL

开发环境：`http://localhost:3000/api`

所有响应均为 JSON 格式：
```json
{ "success": true, "data": {}, "error": null }
```

---

### GET /api/health

健康检查。

**响应：**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "version": "1.0.0",
    "geminiConfigured": true,
    "openaiConfigured": false
  }
}
```

---

### POST /api/auth/register

用户注册。

**请求体：**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "用户名"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "userId": 1,
    "email": "user@example.com",
    "name": "用户名",
    "organizationId": 1
  }
}
```

---

### POST /api/auth/login

用户登录。

**请求体：**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "userId": 1,
      "email": "user@example.com",
      "name": "用户名",
      "organizationId": 1,
      "role": "user"
    }
  }
}
```

---

### GET /api/auth/me

获取当前用户信息（需认证）。

**请求头：**
```
Authorization: Bearer <token>
```

**响应：**
```json
{
  "success": true,
  "data": {
    "userId": 1,
    "email": "user@example.com",
    "name": "用户名",
    "organizationId": 1,
    "role": "user",
    "points": 100
  }
}
```

---

### GET /api/organization

获取当前用户所属组织信息（需认证）。

**响应：**
```json
{
  "success": true,
  "data": {
    "orgId": 1,
    "name": "团队名称",
    "totalPoints": 1000,
    "usedPoints": 100,
    "memberCount": 5
  }
}
```

---

### POST /api/admin/user/:userId/points

管理员调整用户积分（需管理员权限）。

**请求体：**
```json
{
  "points": 500,
  "action": "add" // "add" | "set"
}
```

---

### GET /api/admin/users

管理员获取用户列表（需管理员权限）。

查询参数：`page`, `pageSize`, `orgId`

---

### POST /api/generate/start

创建一个生成任务，返回 jobId。任务进度和结果通过 WebSocket 推送。

**请求体：**
```json
{
  "methodContent": "## Methodology...",
  "caption": "Figure 1: Overview of our framework...",
  "taskName": "diagram",
  "expMode": "demo_full",
  "retrievalSetting": "auto",
  "numCandidates": 5,
  "aspectRatio": "16:9",
  "maxCriticRounds": 3,
  "modelName": "gemini-2.5-pro-preview-06-05"
}
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `methodContent` | string | 是 | 论文方法节内容（支持 Markdown） |
| `caption` | string | 是 | 图注 |
| `taskName` | `"diagram"` \| `"plot"` | 否 | 任务类型，默认 `"diagram"` |
| `expMode` | string | 否 | 流水线模式，默认 `"demo_full"`（`demo_planner_critic`=智能迭代、`demo_full`=全流程增强、`vanilla`=快速直出） |
| `retrievalSetting` | `"auto"` \| `"random"` \| `"none"` | 否 | 检索策略，默认 `"auto"` |
| `numCandidates` | number | 否 | 并行候选数量 1-5，默认 3 |
| `aspectRatio` | `"16:9"` \| `"21:9"` \| `"3:2"` \| `"1:1"` | 否 | 图片宽高比，默认 `"16:9"` |
| `maxCriticRounds` | number | 否 | Critic 最大轮数 1-3，默认 3 |
| `modelName` | string | 否 | 覆盖默认文本模型名称 |

**响应：**
```json
{
  "success": true,
  "data": {
    "jobId": "job_1234567890_abc123"
  }
}
```

---

### GET /api/generate/status/:jobId

查询任务状态（轮询备用，推荐使用 WebSocket）。

**响应：**
```json
{
  "success": true,
  "data": {
    "jobId": "job_1234567890_abc123",
    "status": "running",
    "completedCandidates": 2,
    "totalCandidates": 5,
    "results": []
  }
}
```

`status` 可能值：`"queued"` | `"running"` | `"completed"` | `"failed"`

---

### GET /api/history

历史任务列表（分页）。

查询参数：`page`（默认 1）、`pageSize`（默认 20，最大 50）

返回中的每个任务会包含：

- `exp_mode`：归一化后的内部模式值（如 `demo_full`）
- `exp_mode_label`：用户可直接显示的模式名（如“全流程增强”）

---

### GET /api/history/:jobId

历史任务详情（含候选结果、步骤日志）。

返回同样包含 `exp_mode` 与 `exp_mode_label`，前端优先展示 `exp_mode_label`。

---

### POST /api/refine

对已有图片进行 AI 精炼（润色/升分辨率）。

**请求体（multipart/form-data）：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `image` | File | 是 | 上传的图片文件（PNG/JPG，最大 10MB） |
| `editPrompt` | string | 是 | 修改描述 |
| `aspectRatio` | string | 否 | 输出宽高比，默认 `"16:9"` |
| `imageSize` | `"2K"` \| `"4K"` | 否 | 输出分辨率，默认 `"2K"` |
| `taskName` | string | 否 | 任务类型，默认 `"diagram"` |

**响应：**
```json
{
  "success": true,
  "data": {
    "imageBase64": "data:image/png;base64,iVBORw0KGgo...",
    "suggestions": "1. Improve color contrast...",
    "processingTimeMs": 8500
  }
}
```

---

## WebSocket API

连接地址：`ws://localhost:3000`（Socket.io）

### 连接与认证

```javascript
import { io } from 'socket.io-client'

const socket = io('http://localhost:3000', {
  transports: ['websocket'],
  reconnectionAttempts: Infinity
})
```

---

### generate:start

**Client → Server**：启动生成任务。

```javascript
socket.emit('generate:start', {
  jobId: 'job_xxx',        // 由 POST /api/generate/start 返回
  // 其余参数同 REST API
})
```

---

### generate:progress

**Server → Client**：进度更新。

```javascript
socket.on('generate:progress', ({ jobId, candidateId, stage, message, percent }) => {
  // stage: 'retriever' | 'planner' | 'stylist' | 'visualizer' | 'critic'
  // percent: 0-100
})
```

---

> 说明：`plot` 任务的 Plotly 渲染现已在后端完成，不再通过 WebSocket 在前端回传渲染结果。

### generate:candidate_complete

**Server → Client**：单个候选生成完成。

```javascript
socket.on('generate:candidate_complete', ({ jobId, candidateId, result }) => {
  // result 包含所有阶段的图片 base64 和描述
})
```

`result` 结构（diagram 任务）：
```json
{
  "candidateId": 0,
  "target_diagram_desc0": "...",
  "target_diagram_desc0_base64_jpg": "base64...",
  "target_diagram_stylist_desc0": "...",
  "target_diagram_stylist_desc0_base64_jpg": "base64...",
  "target_diagram_critic_desc0": "...",
  "target_diagram_critic_desc0_base64_jpg": "base64...",
  "target_diagram_critic_suggestions0": "...",
  "target_diagram_critic_desc1": "...",
  "target_diagram_critic_desc1_base64_jpg": "base64..."
}
```

---

### generate:all_complete

**Server → Client**：所有候选生成完成。

```javascript
socket.on('generate:all_complete', ({ jobId, results, totalTimeMs }) => {
  // results: 所有候选的 result 数组
})
```

---

### generate:error

**Server → Client**：某个候选生成出错。

```javascript
socket.on('generate:error', ({ jobId, candidateId, error }) => {
  // error: 错误信息字符串
})
```
