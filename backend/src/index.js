import express from 'express'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import helmet from 'helmet'
import cors from 'cors'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, mkdirSync } from 'fs'
import { IMAGES_ROOT } from './utils/imageStore.js'

import config from './config/index.js'
import logger from './utils/logger.js'
import apiRouter from './routes/index.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import { apiRateLimiter } from './middleware/rateLimiter.js'
import { registerSocketHandlers } from './socket/handlers.js'
import { resumeInterruptedJobs } from './services/JobResumeService.js'
import { bootstrapMysql } from './bootstrap-mysql.js'
import { mountTenancy } from './middleware/tenancy.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Express setup ────────────────────────────────────────────

const app = express()
const httpServer = createServer(app)

// Initialize MySQL connection pool (MVP)
bootstrapMysql()

// Mount tenancy middleware to bind organization scope
mountTenancy(app)

// ─── Socket.io setup ──────────────────────────────────────────

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.corsOrigin.split(',').map(o => o.trim()),
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 50 * 1024 * 1024, // 50MB for image transfers
})

io.on('connection', (socket) => registerSocketHandlers(socket))

// ─── Middleware ───────────────────────────────────────────────

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = config.corsOrigin.split(',').map(o => o.trim())
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
}))
app.use(cors(corsOptions))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// ─── Static: serve generated images ──────────────────────────
mkdirSync(IMAGES_ROOT, { recursive: true })

const imageStatic = express.static(IMAGES_ROOT, {
  maxAge: '7d',
  immutable: true,
})

app.use('/images', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  imageStatic(req, res, next)
})

// ─── API Routes ───────────────────────────────────────────────

app.use('/api', apiRateLimiter, apiRouter)

// ─── Serve frontend in production ────────────────────────────

if (config.isProd) {
  const distPath = resolve(__dirname, '../../frontend/dist')
  if (existsSync(distPath)) {
    app.use(express.static(distPath))
    app.get('*', (req, res) => {
      res.sendFile(resolve(distPath, 'index.html'))
    })
    logger.info(`Serving frontend from ${distPath}`)
  } else {
    logger.warn('Frontend dist not found. Run `pnpm build` in the frontend directory.')
  }
}

// ─── Error handling ───────────────────────────────────────────

app.use(notFound)
app.use(errorHandler)

// ─── Start server ─────────────────────────────────────────────

httpServer.listen(config.port, () => {
  logger.info(`🍌 PaperSketch JS Server running on http://localhost:${config.port}`)
  logger.info(`   Mode: ${config.nodeEnv}`)
  logger.info(`   Gemini: ${config.googleApiKey ? '✓ configured' : '✗ not configured'}`)
  logger.info(`   OpenAI: ${config.openaiApiKey ? '✓ configured' : '✗ not configured'}`)
  logger.info(`   Data dir: ${config.dataDir || '(not set – retrieval disabled)'}`)

  // Resume any jobs that were running before the last shutdown
  // Use setImmediate to avoid blocking the event loop during startup
  setImmediate(() => resumeInterruptedJobs())
})

export { io }
