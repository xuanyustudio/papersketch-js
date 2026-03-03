import { Router } from 'express'
import multer from 'multer'
import { PolishAgent } from '../agents/PolishAgent.js'
import llmService from '../services/LLMService.js'
import config from '../config/index.js'
import { normalizeAspectRatio } from '../utils/imageUtils.js'
import logger from '../utils/logger.js'

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
router.post('/', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, data: null, error: 'No image file uploaded' })
    }

    const editPrompt = req.body.editPrompt
    if (!editPrompt?.trim()) {
      return res.status(400).json({ success: false, data: null, error: 'editPrompt is required' })
    }

    const aspectRatio = normalizeAspectRatio(req.body.aspectRatio || '16:9')
    const taskName = req.body.taskName || 'diagram'
    const startTime = Date.now()

    const expConfig = {
      taskName,
      modelName: config.defaultModelName,
      imageModelName: config.defaultImageModelName,
      dataDir: config.dataDir,
      temperature: config.temperature,
    }

    const polishAgent = new PolishAgent({ expConfig, llmService })

    // Convert uploaded file to base64
    const imageBase64 = req.file.buffer.toString('base64')

    const { polishedBase64, suggestions } = await polishAgent.refineImage(imageBase64, aspectRatio)

    const processingTimeMs = Date.now() - startTime

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

export default router
