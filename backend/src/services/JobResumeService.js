/**
 * JobResumeService
 *
 * On server startup, scans SQLite for jobs that were still 'running'
 * when the process last exited (crash, restart, ctrl-c, etc.) and
 * resumes each unfinished candidate from its last checkpoint.
 *
 * Runs silently — no WebSocket needed. Results are saved directly to
 * SQLite so the user can view them in the History page.
 */

import config from '../config/index.js'
import { historyService } from './HistoryService.js'
import { PaperVizProcessor } from './PaperVizProcessor.js'
import { createCheckpointSnapshot } from '../utils/imageStore.js'
import { renderPlotlySpecToBase64 } from './PlotlyRenderService.js'
import logger from '../utils/logger.js'

/**
 * Called once after the HTTP server starts.
 * Finds interrupted jobs and re-queues their unfinished candidates.
 */
export async function resumeInterruptedJobs() {
  let interrupted
  try {
    interrupted = historyService.getInterruptedJobs()
  } catch (err) {
    logger.error('JobResumeService: failed to query interrupted jobs', { error: err.message })
    return
  }

  if (interrupted.length === 0) return

  logger.info(`JobResumeService: found ${interrupted.length} interrupted job(s), resuming...`)

  for (const job of interrupted) {
    // Run each job resume in the background (non-blocking)
    resumeJob(job).catch((err) =>
      logger.error(`JobResumeService: resume failed for job ${job.id}`, { error: err.message })
    )
  }
}

async function resumeJob(job) {
  const jobId = job.id
  const taskName = job.task_name || 'diagram'
  const maxCriticRounds = job.max_critic_rounds ?? 3

  logger.info(`[Resume] Job ${jobId} (${job.exp_mode}, ${taskName}, ${job.num_candidates} candidates)`)

  // Build expConfig from stored job params (same shape as buildExpConfig in handlers.js)
  const expConfig = {
    taskName,
    expMode: job.exp_mode || 'demo_full',
    retrievalSetting: job.retrieval_setting || 'none',
    modelName: job.model_name || config.defaultModelName,
    imageModelName: config.defaultImageModelName,
    maxCriticRounds,
    dataDir: config.dataDir,
    temperature: config.temperature,
  }

  // Build base input data from stored fields
  const baseInput = {
    filename: 'web_input',
    caption: job.caption || '',
    content: job.method_content || '',
    visual_intent: job.caption || '',
    additional_info: { rounded_ratio: job.aspect_ratio || '16:9' },
    max_critic_rounds: maxCriticRounds,
  }

  // Determine which candidates still need processing
  const numCandidates = job.num_candidates || 1
  const savedMap = new Map(
    (job.savedCandidates || []).map((c) => [c.candidateIdx, c])
  )

  const dataList = []
  const candidateIds = []

  for (let i = 0; i < numCandidates; i++) {
    const saved = savedMap.get(i)

    // Skip already finished candidates
    if (saved?.status === 'completed' || saved?.status === 'error') continue

    // Merge checkpoint data into the fresh input so completed steps are skipped
    const checkpointData = saved?.checkpointData || null
    const inputData = {
      ...JSON.parse(JSON.stringify(baseInput)),
      filename: `candidate_${i}`,
      candidate_id: i,
      ...(checkpointData || {}),
    }

    dataList.push(inputData)
    candidateIds.push(i)
  }

  if (dataList.length === 0) {
    // All candidates already done — mark job complete
    historyService.completeJob(jobId, 0)
    logger.info(`[Resume] Job ${jobId}: all candidates already finished, marking complete`)
    return
  }

  logger.info(`[Resume] Job ${jobId}: resuming ${dataList.length} candidate(s): [${candidateIds.join(', ')}]`)

  const startedAt = Date.now()

  // Map dataList index → real candidateId
  const processor = new PaperVizProcessor(expConfig, {
    // No onProgress (silent mode)
    onProgress: () => {},

    onCheckpoint: (dataListIdx, stage, data) => {
      const candidateId = candidateIds[dataListIdx]
      try {
        const snap = createCheckpointSnapshot(jobId, candidateId, data, taskName)
        historyService.saveCheckpoint(jobId, candidateId, stage, snap)
      } catch (e) {
        logger.warn(`[Resume] Checkpoint save failed ${jobId}/${candidateId}/${stage}`, { error: e.message })
      }
    },

    onCandidateComplete: (dataListIdx, result) => {
      const candidateId = candidateIds[dataListIdx]
      historyService.saveCandidateResult(jobId, candidateId, result, taskName)
      logger.info(`[Resume] Job ${jobId} candidate ${candidateId} completed`)
    },

    onError: (dataListIdx, error) => {
      const candidateId = candidateIds[dataListIdx]
      historyService.saveCandidateError(jobId, candidateId, error)
      logger.warn(`[Resume] Job ${jobId} candidate ${candidateId} failed: ${error}`)
    },

    onPlotRenderRequest: async (dataListIdx, round, plotlySpec) => {
      return renderPlotlySpecToBase64(plotlySpec, { width: 1200, height: 750, scale: 3 })
    },
  })

  try {
    await processor.processBatch(dataList, config.maxConcurrentJobs || 3)
    historyService.completeJob(jobId, Date.now() - startedAt)
    logger.info(`[Resume] Job ${jobId} fully completed`)
  } catch (err) {
    historyService.completeJob(jobId, 0)
    logger.error(`[Resume] Job ${jobId} fatal error`, { error: err.message })
  }
}
