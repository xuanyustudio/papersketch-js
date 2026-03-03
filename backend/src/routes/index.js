import { Router } from 'express'
import { existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import generateRouter from './generate.js'
import refineRouter from './refine.js'
import historyRouter from './history.js'
import modelsRouter from './models.js'
import config from '../config/index.js'

const router = Router()
const __dirname = dirname(fileURLToPath(import.meta.url))
const envFilePath = resolve(__dirname, '../../.env')

router.get('/health', (req, res) => {
  const envFileExists = existsSync(envFilePath)
  res.json({
    success: true,
    data: {
      status: 'ok',
      version: '1.0.0',
      geminiConfigured: Boolean(config.googleApiKey),
      openaiConfigured: Boolean(config.openaiApiKey),
      dataDir: config.dataDir || null,
      envFileExists,
      envSetupHint: 'Create backend/.env from backend/.env.example before first run.',
    },
    error: null,
  })
})

router.use('/generate', generateRouter)
router.use('/refine', refineRouter)
router.use('/history', historyRouter)
router.use('/models', modelsRouter)

export default router
