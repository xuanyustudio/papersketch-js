import { writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { Router } from 'express'
import multer from 'multer'
import { PolishAgent } from '../agents/PolishAgent.js'
import llmService from '../services/LLMService.js'
import { historyService } from '../services/HistoryService.js'
import { pointsService, calculateRefinePoints } from '../services/pointsService.js'
import config from '../config/index.js'
import { normalizeAspectRatio } from '../utils/imageUtils.js'
import { IMAGES_ROOT } from '../utils/imageStore.js'
import logger from '../utils/logger.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireOrg } from '../middleware/requireOrg.js'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'))
    }
    cb(null, true)
  },
})

/**
 * POST /api/refine
 * Refine/polish an uploaded image using AI.
 */
router.post('/', authMiddleware, requireOrg, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, data: null, error: 'No image file uploaded' })
    }

    const editPrompt = req.body.editPrompt
    if (!editPrompt?.trim()) {
      return res.status(400).json({ success: false, data: null, error: 'editPrompt is required' })
    }

    // 扣除积分 (100 积分)
    const userId = req.user.userId
    const pointsCost = calculateRefinePoints()
    const deductResult = await pointsService.deductPoints(userId, pointsCost)
    if (!deductResult.success) {
      return res.status(400).json({ 
        success: false, 
        data: null, 
        error: `积分不足，需要 ${pointsCost} 积分，当前余额 ${deductResult.currentPoints}` 
      })
    }
    logger.info(`[Points] Deducted ${pointsCost} points for refine, user ${userId}, remaining: ${deductResult.currentPoints}`)

    const aspectRatio = normalizeAspectRatio(req.body.aspectRatio || '16:9')
    const taskName = req.body.taskName || 'diagram'
    const startTime = Date.now()

    const expConfig = {
      taskName,
      modelName: config.defaultModelName,
      imageModelName: config.polishImageModelName || config.defaultImageModelName,
      dataDir: config.dataDir,
      temperature: config.temperature,
    }

    const polishAgent = new PolishAgent({ expConfig, llmService })

    // Convert uploaded file to base64
    const imageBase64 = req.file.buffer.toString('base64')

    const { polishedBase64, suggestions } = await polishAgent.refineImage(imageBase64, aspectRatio)

    const processingTimeMs = Date.now() - startTime

    // Save images to disk and record in refine_history
    const dir = resolve(IMAGES_ROOT, 'refine')
    mkdirSync(dir, { recursive: true })
    const ts = Date.now()

    let originalImageUrl = null
    let polishedImageUrl = null
    try {
      const origPath = resolve(dir, `${ts}_original.jpg`)
      writeFileSync(origPath, Buffer.from(imageBase64, 'base64'))
      originalImageUrl = `/images/refine/${ts}_original.jpg`
    } catch (e) {
      logger.warn('Refine: failed to save original image', { error: e.message })
    }

    if (polishedBase64) {
      try {
        const polPath = resolve(dir, `${ts}_polished.jpg`)
        writeFileSync(polPath, Buffer.from(polishedBase64, 'base64'))
        polishedImageUrl = `/images/refine/${ts}_polished.jpg`
      } catch (e) {
        logger.warn('Refine: failed to save polished image', { error: e.message })
      }
    }

    historyService.saveRefineRecord({
      taskName,
      modelName: expConfig.imageModelName,
      originalImageUrl,
      polishedImageUrl,
      suggestions,
      processingTimeMs,
      noChanges: !polishedBase64,
      organizationId: req.organizationId,
      pointsCost,
    })

    if (polishedBase64) {
      res.json({
        success: true,
        data: {
          imageBase64: `data:image/jpeg;base64,${polishedBase64}`,
          suggestions,
          processingTimeMs,
        },
        error: null,
      })
    } else {
      // No changes needed or generation failed — return original
      res.json({
        success: true,
        data: {
          imageBase64: `data:image/jpeg;base64,${imageBase64}`,
          suggestions: suggestions || 'No changes needed.',
          processingTimeMs,
          noChanges: true,
        },
        error: null,
      })
    }
  } catch (err) {
    logger.error('Refine endpoint error', { error: err.message })
    next(err)
  }
})

/** GET /api/refine/history — list manual polish records */
router.get('/history', authMiddleware, requireOrg, (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10)
    const pageSize = parseInt(req.query.pageSize || '20', 10)
    const data = historyService.listRefineHistory({ page, pageSize, organizationId: req.organizationId })
    res.json({ success: true, data, error: null })
  } catch (err) {
    next(err)
  }
})

/** DELETE /api/refine/history/:id */
router.delete('/history/:id', authMiddleware, requireOrg, (req, res, next) => {
  try {
    historyService.deleteRefineRecord(parseInt(req.params.id, 10), req.organizationId)
    res.json({ success: true, data: null, error: null })
  } catch (err) {
    next(err)
  }
})

export default router
