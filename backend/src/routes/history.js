import { Router } from 'express'
import { historyService } from '../services/HistoryService.js'

const router = Router()

const MODE_ALIASES = {
  dev_planner_critic: 'demo_planner_critic',
  dev_full: 'demo_full',
}

const MODE_LABELS = {
  demo_planner_critic: '智能迭代（推荐）',
  demo_full: '全流程增强',
  vanilla: '快速直出',
}

function normalizeExpMode(mode) {
  if (!mode) return 'demo_full'
  return MODE_ALIASES[mode] || mode
}

function withModeLabel(job) {
  const normalized = normalizeExpMode(job?.exp_mode)
  return {
    ...job,
    exp_mode: normalized,
    exp_mode_label: MODE_LABELS[normalized] || normalized,
  }
}

/**
 * GET /api/history
 * List all jobs with pagination (no result blobs, metadata only)
 */
router.get('/', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 20))
  const result = historyService.listJobs({ page, pageSize })
  const jobs = (result.jobs || []).map(withModeLabel)
  res.json({ success: true, data: { ...result, jobs }, error: null })
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
  res.json({ success: true, data: withModeLabel(detail), error: null })
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
