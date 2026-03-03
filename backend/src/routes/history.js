import { Router } from 'express'
import { historyService } from '../services/HistoryService.js'

const router = Router()

/**
 * GET /api/history
 * List all jobs with pagination (no result blobs, metadata only)
 */
router.get('/', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 20))
  const result = historyService.listJobs({ page, pageSize })
  res.json({ success: true, data: result, error: null })
})

/**
 * GET /api/history/:jobId
 * Get full job detail including all candidate results (with images)
 */
router.get('/:jobId', (req, res) => {
  const detail = historyService.getJobDetail(req.params.jobId)
  if (!detail) {
    return res.status(404).json({ success: false, data: null, error: 'Job not found' })
  }
  res.json({ success: true, data: detail, error: null })
})

/**
 * DELETE /api/history/:jobId
 * Delete a job and all its candidates
 */
router.delete('/:jobId', (req, res) => {
  historyService.deleteJob(req.params.jobId)
  res.json({ success: true, data: { deleted: true }, error: null })
})

export default router
