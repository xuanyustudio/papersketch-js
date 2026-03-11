import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getJobStatus } from '../socket/handlers.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireOrg } from '../middleware/requireOrg.js'

const router = Router()

/**
 * POST /api/generate/start
 * Creates a job and returns a jobId.
 * Actual processing is triggered via WebSocket 'generate:start' event.
 */
router.post('/start', authMiddleware, requireOrg, (req, res) => {
  const {
    methodContent,
    caption,
    taskName = 'diagram',
    expMode = 'demo_full',
    retrievalSetting = 'auto',
    numCandidates = 3,
    aspectRatio = '16:9',
    maxCriticRounds = 3,
    modelName,
  } = req.body

  if (!methodContent?.trim()) {
    return res.status(400).json({ success: false, data: null, error: 'methodContent is required' })
  }
  if (!caption?.trim()) {
    return res.status(400).json({ success: false, data: null, error: 'caption is required' })
  }

  const jobId = uuidv4()
  
  // Return jobId and organizationId (socket handler will use it)
  res.json({ success: true, data: { jobId, organizationId: req.organizationId }, error: null })
})

/**
 * GET /api/generate/status/:jobId
 * Poll job status (fallback for environments without WebSocket)
 */
router.get('/status/:jobId', authMiddleware, requireOrg, (req, res) => {
  const { jobId } = req.params
  const status = getJobStatus(jobId)
  if (!status) {
    return res.status(404).json({ success: false, data: null, error: 'Job not found' })
  }
  res.json({ success: true, data: status, error: null })
})

export default router
