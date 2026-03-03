import { Router } from 'express'
import config from '../config/index.js'
import { IMAGE_MODELS } from '../config/models.js'

const router = Router()

/**
 * GET /api/models/image
 * Returns the list of image models with availability status
 */
router.get('/image', (req, res) => {
  const models = IMAGE_MODELS.map((m) => {
    let available = false
    if (m.provider === 'gemini') available = Boolean(config.googleApiKey)
    else if (m.provider === 'fal') available = Boolean(config.falApiKey)
    else if (m.provider === 'openai') available = Boolean(config.openaiApiKey)
    else if (m.provider === 'doubao') available = Boolean(config.doubaoApiKey && config.doubaoBaseUrl)
    return { ...m, available, isDefault: m.id === config.defaultImageModelName }
  })

  res.json({
    success: true,
    data: models,
    error: null,
    meta: {
      defaultImageModelName: config.defaultImageModelName || '',
    },
  })
})

export default router
