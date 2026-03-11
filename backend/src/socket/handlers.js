import { v4 as uuidv4 } from 'uuid'
import { PaperVizProcessor } from '../services/PaperVizProcessor.js'
import { PolishAgent } from '../agents/PolishAgent.js'
import llmService from '../services/LLMService.js'
import { historyService } from '../services/HistoryService.js'
import { pointsService, calculateGeneratePoints } from '../services/pointsService.js'
import { createCheckpointSnapshot } from '../utils/imageStore.js'
import { renderPlotlySpecToBase64 } from '../services/PlotlyRenderService.js'
import config from '../config/index.js'
import logger from '../utils/logger.js'

// In-memory job store (use Redis for multi-instance production)
const jobs = new Map()

/**
 * Build an expConfig object from socket request params
 */
function buildExpConfig(params) {
  const maxCriticRounds = Math.min(Math.max(parseInt(params.maxCriticRounds || 3, 10), 1), 3)
  return {
    taskName: params.taskName || 'diagram',
    expMode: params.expMode || 'demo_full',
    retrievalSetting: params.retrievalSetting || 'auto',
    modelName: params.modelName || config.defaultModelName,
    imageModelName: params.imageModelName || config.defaultImageModelName,
    maxCriticRounds,
    dataDir: config.dataDir,
    temperature: config.temperature,
  }
}

/**
 * Register all Socket.io event handlers for a connection
 * @param {import('socket.io').Socket} socket
 */
export function registerSocketHandlers(socket) {
  logger.info(`Client connected: ${socket.id}`)

  // ─── generate:start ───────────────────────────────────────
  socket.on('generate:start', async (params) => {
    const jobId = params.jobId || uuidv4()
    const organizationId = params.organizationId
    const userId = params.userId
    logger.info(`[Job ${jobId}] Starting generation`, {
      expMode: params.expMode,
      numCandidates: params.numCandidates,
      organizationId,
      userId,
    })

    try {
      // 计算积分并扣除
      const numCandidates = Math.min(Math.max(parseInt(params.numCandidates || 3, 10), 1), 5)
      const maxCriticRounds = Math.min(Math.max(parseInt(params.maxCriticRounds || 3, 10), 1), 3)
      const pointsCost = calculateGeneratePoints(numCandidates, maxCriticRounds)
      logger.info(`[Job ${jobId}] Points cost: ${pointsCost}`)
      
      // 扣除积分
      if (userId) {
        logger.info(`[Job ${jobId}] Deducting points for user ${userId}`)
        const deductResult = await pointsService.deductPoints(userId, pointsCost)
        logger.info(`[Job ${jobId}] Points deduction result:`, deductResult)
        if (!deductResult.success) {
          socket.emit('generate:error', { 
            jobId, 
            candidateId: -1, 
            error: `积分不足，需要 ${pointsCost} 积分，当前余额 ${deductResult.currentPoints}` 
          })
          return
        }
        logger.info(`[Points] Deducted ${pointsCost} points for user ${userId}, remaining: ${deductResult.currentPoints}`)
      }

      const expConfig = buildExpConfig(params)

      // Build input data list
      const baseInput = {
        filename: 'web_input',
        caption: params.caption,
        content: params.methodContent,
        visual_intent: params.caption,
        additional_info: { rounded_ratio: params.aspectRatio || '16:9' },
        max_critic_rounds: maxCriticRounds,
      }

      const dataList = Array.from({ length: numCandidates }, (_, i) => ({
        ...JSON.parse(JSON.stringify(baseInput)),
        filename: `candidate_${i}`,
        candidate_id: i,
      }))

      // Store job metadata (memory + DB)
      jobs.set(jobId, {
        status: 'running',
        totalCandidates: numCandidates,
        completedCandidates: 0,
        results: [],
        startedAt: Date.now(),
      })

      // Persist to SQLite
      historyService.createJob({
        jobId,
        expMode: params.expMode || 'demo_full',
        taskName: params.taskName || 'diagram',
        retrievalSetting: params.retrievalSetting || 'auto',
        numCandidates,
        aspectRatio: params.aspectRatio || '16:9',
        modelName: params.modelName,
        methodContent: params.methodContent,
        caption: params.caption,
        maxCriticRounds,
        organizationId,
        pointsCost,
      })

      // ─── Plotly render callback (for plot tasks): backend local render ────────────
      const onPlotRenderRequest = async (candidateId, round, plotlySpec) => {
        const t0 = Date.now()
        const imageBase64 = await renderPlotlySpecToBase64(plotlySpec, { width: 1200, height: 750, scale: 3 })
        logger.info(`[PlotlyRender] job=${jobId} candidate=${candidateId} round=${round} elapsed=${Date.now() - t0}ms`)
        return imageBase64
      }

      // ─── Processor callbacks ──────────────────────────────────
      const processor = new PaperVizProcessor(expConfig, {
        onProgress: (candidateId, stage, message, percent) => {
          socket.emit('generate:progress', { jobId, candidateId, stage, message, percent })
        },
        onCheckpoint: (candidateId, stage, data) => {
          try {
            const taskName = params.taskName || 'diagram'
            const snap = createCheckpointSnapshot(jobId, candidateId, data, taskName)
            historyService.saveCheckpoint(jobId, candidateId, stage, snap)
          } catch (e) {
            logger.warn(`Checkpoint save failed for ${jobId}/${candidateId}/${stage}`, { error: e.message })
          }
        },

        onStepLog: (candidateId, stepEntry) => {
          socket.emit('generate:step_log', { jobId, candidateId, step: stepEntry })
        },
        onCandidateComplete: (candidateId, result) => {
          const job = jobs.get(jobId)
          if (job) {
            job.completedCandidates++
            job.results.push(result)
          }
          // Persist to DB + save images to disk
          historyService.saveCandidateResult(jobId, candidateId, result, params.taskName || 'diagram')
          socket.emit('generate:candidate_complete', { jobId, candidateId, result })
        },
        onError: (candidateId, error) => {
          // Persist error to DB
          if (candidateId >= 0) {
            historyService.saveCandidateError(jobId, candidateId, error)
          }
          socket.emit('generate:error', { jobId, candidateId, error })
        },
        onPlotRenderRequest: expConfig.taskName === 'plot' ? onPlotRenderRequest : null,
      })

      const startedAt = jobs.get(jobId)?.startedAt || Date.now()
      const results = await processor.processBatch(dataList, config.maxConcurrentJobs)
      const totalTimeMs = Date.now() - startedAt
      const job = jobs.get(jobId)
      if (job) job.status = 'completed'

      // Mark job complete in DB
      historyService.completeJob(jobId, totalTimeMs)

      socket.emit('generate:all_complete', { jobId, results, totalTimeMs })
      logger.info(`[Job ${jobId}] All ${results.length} candidates completed`)
    } catch (err) {
      const job = jobs.get(jobId)
      if (job) job.status = 'failed'
      historyService.completeJob(jobId, 0)
      logger.error(`[Job ${jobId}] Fatal error`, { error: err.message })
      socket.emit('generate:error', { jobId, candidateId: -1, error: err.message })
    }
  })

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`)
  })
}

/**
 * Get job status (for REST API polling)
 */
export function getJobStatus(jobId) {
  const job = jobs.get(jobId)
  if (!job) return null
  return {
    jobId,
    status: job.status,
    completedCandidates: job.completedCandidates,
    totalCandidates: job.totalCandidates,
    results: job.status === 'completed' ? job.results : [],
  }
}
