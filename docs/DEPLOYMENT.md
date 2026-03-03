# 部署文档

> 文档导航：[`README（中文）`](../README.md) | [`README_EN`](../README_EN.md) | [`项目缘起`](./PROJECT_STORY.md) | [`开发进度`](./PROGRESS.md) | [`系统架构`](./ARCHITECTURE.md) | [`API`](./API.md)

## 开发环境

### 前置要求

- Node.js >= 18.0.0
- pnpm（推荐）：`npm install -g pnpm`

### 启动步骤

```bash
# 1. 安装依赖
cd backend && pnpm install
cd ../frontend && pnpm install

# 2. 配置环境变量
cd ../backend
cp .env.example .env
# 编辑 .env

# 3. 启动后端（支持热更新）
pnpm dev

# 4. 新终端：启动前端
cd ../frontend
pnpm dev
```

访问 http://localhost:5173

## 生产环境部署

### 方式一：PM2 部署

```bash
# 构建前端
cd frontend
pnpm build
# 产物在 frontend/dist/

# 安装 PM2
npm install -g pm2

# 启动后端（后端同时 serve 前端静态文件）
cd backend
NODE_ENV=production pnpm start

# 或使用 PM2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

`backend/ecosystem.config.cjs`：
```javascript
module.exports = {
  apps: [{
    name: 'papersketch-js',
    script: 'src/index.js',
    cwd: './backend',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

### 方式二：Docker 部署

```dockerfile
# Dockerfile（放在项目根目录）
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

FROM node:20-alpine
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --production
COPY backend/ .
COPY --from=frontend-build /app/frontend/dist ./public
EXPOSE 3000
CMD ["node", "src/index.js"]
```

```bash
docker build -t papersketch-js .
docker run -p 3000:3000 \
  -e GOOGLE_API_KEY=your_key \
  -e DEFAULT_MODEL_NAME=gemini-2.5-pro-preview-06-05 \
  -e DEFAULT_IMAGE_MODEL_NAME=gemini-2.0-flash-preview-image-generation \
  papersketch-js
```

### 方式三：Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /var/www/papersketch/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

## 环境变量说明

| 变量名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| `GOOGLE_API_KEY` | 是* | Google Gemini API Key | `AIza...` |
| `OPENAI_API_KEY` | 否 | OpenAI API Key（使用 gpt-image 时需要） | `sk-...` |
| `DEFAULT_MODEL_NAME` | 是 | 默认文本推理模型 | `gemini-2.5-pro-preview-06-05` |
| `DEFAULT_IMAGE_MODEL_NAME` | 是 | 默认图像生成模型 | `gemini-2.0-flash-preview-image-generation` |
| `PORT` | 否 | 后端监听端口，默认 3000 | `3000` |
| `DATA_DIR` | 否 | PaperBananaBench 数据集根目录 | `/data/PaperBananaBench` |
| `STYLE_GUIDES_DIR` | 否 | 风格指南目录，默认 `../style_guides` | `/app/style_guides` |
| `MAX_CONCURRENT_JOBS` | 否 | 最大并发任务数，默认 10 | `10` |
| `RATE_LIMIT_WINDOW_MS` | 否 | 限流时间窗口（毫秒），默认 60000 | `60000` |
| `RATE_LIMIT_MAX` | 否 | 时间窗口内最大请求数，默认 20 | `20` |
| `LOG_LEVEL` | 否 | 日志级别，默认 `info` | `debug` |
| `CORS_ORIGIN` | 否 | 允许的前端源，默认 `http://localhost:5173` | `https://your-domain.com` |

*使用 Gemini 模型时必填

## 性能与限流

- 每个 IP 默认每分钟最多发起 20 次 API 请求
- 单任务最多并行 20 个候选
- 建议使用支持高并发的 API Key（Gemini Pro tier）
- Critic 循环每轮约 30-60 秒，完整流程（5候选×3轮）约 3-5 分钟

## 故障排查

**问题：WebSocket 连接失败**
- 检查防火墙是否放行 WebSocket
- Nginx 配置需包含 `Upgrade` 和 `Connection` 头

**问题：图像生成返回空**
- 检查 `DEFAULT_IMAGE_MODEL_NAME` 是否为支持图像生成的模型
- Gemini 图像生成模型需要特殊权限，确认 API Key 已启用

**问题：检索功能不可用**
- 确认 `DATA_DIR` 路径正确且包含 `ref.json`
- 无数据集时系统自动使用 `retrieval_setting=none`，不影响核心功能
