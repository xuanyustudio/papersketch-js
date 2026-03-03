import { v4 as uuidv4 } from 'uuid'
import { RetrieverAgent } from '../agents/RetrieverAgent.js'
import { PlannerAgent } from '../agents/PlannerAgent.js'
import { StylistAgent } from '../agents/StylistAgent.js'
import { VisualizerAgent } from '../agents/VisualizerAgent.js'
import { CriticAgent } from '../agents/CriticAgent.js'
import { VanillaAgent } from '../agents/VanillaAgent.js'
import llmService from './LLMService.js'
import { rehydrateImages } from '../utils/imageStore.js'
import logger from '../utils/logger.js'

/**
 * PaperVizProcessor
 *
 * Orchestrates the multi-agent pipeline for one or more candidates in parallel.
 * Progress events are emitted via the onProgress and onCandidateComplete callbacks.
 */
export class PaperVizProcessor {
  /**
   * @param {object} expConfig
   * @param {object} [callbacks]
   * @param {Function} [callbacks.onProgress]          - (candidateId, stage, message, percent) => void
   * @param {Function} [callbacks.onCandidateComplete] - (candidateId, result) => void
   * @param {Function} [callbacks.onError]             - (candidateId, error) => void
   * @param {Function} [callbacks.onCheckpoint]        - (candidateId, stage, data) => void
   * @param {Function} [callbacks.onStepLog]           - (candidateId, stepEntry) => void — emitted after each step
   * @param {Function} [callbacks.onPlotRenderRequest] - async (candidateId, round, plotlySpec) => base64String
   */
  constructor(expConfig, callbacks = {}) {
    this.expConfig = expConfig
    this.onProgress = callbacks.onProgress || (() => {})
    this.onCandidateComplete = callbacks.onCandidateComplete || (() => {})
    this.onError = callbacks.onError || (() => {})
    this.onCheckpoint = callbacks.onCheckpoint || null
    this.onStepLog = callbacks.onStepLog || null
    this.onPlotRenderRequest = callbacks.onPlotRenderRequest || null
  }

  /**
   * Process a batch of candidate inputs in parallel.
   * @param {object[]} dataList - Array of input data objects
   * @param {number} [maxConcurrent=10]
   * @returns {Promise<object[]>} - Completed results
   */
  async processBatch(dataList, maxConcurrent = 10) {
    const results = []
    const semaphore = new Semaphore(maxConcurrent)

    const tasks = dataList.map((data, idx) =>
      semaphore.acquire().then(async (release) => {
        const t0 = Date.now()
        logger.info(`[Pipeline] Candidate ${idx} started  mode=${this.expConfig.expMode}`)
        try {
          const result = await this.#processOne(data, idx)
          results.push(result)
          this.onCandidateComplete(idx, result)
          logger.info(`[Pipeline] Candidate ${idx} finished  elapsed=${Date.now() - t0}ms`)
          return result
        } catch (err) {
          logger.error(`[Pipeline] Candidate ${idx} FAILED  elapsed=${Date.now() - t0}ms`, {
            error: err.message,
          })
          this.onError(idx, err.message)
          return null
        } finally {
          release()
        }
      })
    )

    await Promise.allSettled(tasks)
    return results.filter(Boolean)
  }

  async #processOne(data, candidateId) {
    const mode = this.expConfig.expMode
    const retrieval = this.expConfig.retrievalSetting
    const maxCriticRounds = data.max_critic_rounds ?? this.expConfig.maxCriticRounds ?? 3

    const progress = (stage, message, percent) => this.onProgress(candidateId, stage, message, percent)

    // Checkpoint helper — records intermediate state so we can resume after restart
    const checkpoint = (stage, d) => this.onCheckpoint?.(candidateId, stage, d)

    // Steps log — accumulates per-step records, stored in final result
    const steps = []

    // Step timing helper — logs start/end, collects output, calls onStepLog
    const step = async (label, fn) => {
      logger.info(`[Pipeline] C${candidateId} ▶ ${label}`)
      const startedAt = new Date().toISOString()
      const t0 = Date.now()
      let dataBefore = data
      try {
        const result = await fn()
        const durationMs = Date.now() - t0
        logger.info(`[Pipeline] C${candidateId} ✓ ${label}  ${durationMs}ms`)
        const output = extractStepOutput(label, result, this.expConfig.taskName)
        const entry = { name: label, label: STEP_LABELS[label] ?? label, startedAt, durationMs, status: 'done', output }
        steps.push(entry)
        this.onStepLog?.(candidateId, entry)
        data = result
        return result
      } catch (err) {
        const durationMs = Date.now() - t0
        logger.error(`[Pipeline] C${candidateId} ✗ ${label}  ${durationMs}ms  → ${err.message}`)
        const entry = { name: label, label: STEP_LABELS[label] ?? label, startedAt, durationMs, status: 'error', output: { error: err.message } }
        steps.push(entry)
        this.onStepLog?.(candidateId, entry)
        throw err
      }
    }

    // Create Plotly render callback bound to this candidate
    const plotlyCallback = this.onPlotRenderRequest
      ? async (spec, descKey) => {
          const round = this.#extractRoundFromDescKey(descKey)
          return this.onPlotRenderRequest(candidateId, round, spec)
        }
      : null

    const mkConfig = (extra = {}) => ({ ...this.expConfig, ...extra })

    // Instantiate agents
    const retrieverAgent = new RetrieverAgent({ expConfig: mkConfig(), llmService })
    const plannerAgent = new PlannerAgent({ expConfig: mkConfig(), llmService })
    const stylistAgent = new StylistAgent({ expConfig: mkConfig(), llmService })
    const visualizerAgent = new VisualizerAgent({
      expConfig: mkConfig(),
      llmService,
      onPlotRenderRequest: plotlyCallback,
    })
    const criticAgent = new CriticAgent({ expConfig: mkConfig(), llmService })
    const vanillaAgent = new VanillaAgent({ expConfig: mkConfig(), llmService })

    let result
    switch (mode) {
      case 'vanilla':
        result = await this.#runVanilla(data, vanillaAgent, progress, checkpoint, step)
        break
      case 'dev_planner':
      case 'demo_planner':
        result = await this.#runPlannerOnly(data, retrieverAgent, plannerAgent, visualizerAgent, retrieval, progress, checkpoint, step)
        break
      case 'dev_planner_stylist':
        result = await this.#runPlannerStylist(data, retrieverAgent, plannerAgent, stylistAgent, visualizerAgent, retrieval, progress, checkpoint, step)
        break
      case 'dev_planner_critic':
      case 'demo_planner_critic':
        result = await this.#runPlannerCritic(data, retrieverAgent, plannerAgent, visualizerAgent, criticAgent, retrieval, maxCriticRounds, progress, checkpoint, step)
        break
      case 'dev_full':
      case 'demo_full':
      default:
        result = await this.#runFull(data, retrieverAgent, plannerAgent, stylistAgent, visualizerAgent, criticAgent, retrieval, maxCriticRounds, progress, checkpoint, step)
    }
    // Attach accumulated step log to result
    result._steps = steps
    return result
  }

  // ─── Pipeline variants ────────────────────────────────────

  async #runVanilla(data, vanillaAgent, progress, checkpoint, step) {
    const t = this.expConfig.taskName
    if (!data[`target_${t}_vanilla_base64_jpg`] && !data[`target_${t}_vanilla_image_url`]) {
      progress('vanilla', '直接生成图像中，约需 1-3 分钟...', 20)
      data = await step('Vanilla', () => vanillaAgent.process(data))
      checkpoint('vanilla', data)
    }
    progress('done', '完成', 100)
    return data
  }

  async #runPlannerOnly(data, retrieverAgent, plannerAgent, visualizerAgent, retrieval, progress, checkpoint, step) {
    const t = this.expConfig.taskName

    if (!data.top_k_diagrams && !data.top_k_plots) {
      progress('retriever', '检索参考示例...', 10)
      data = await step('Retriever', () => retrieverAgent.process(data, retrieval))
      checkpoint('retriever', data)
    }

    if (!data[`target_${t}_desc0`]) {
      progress('planner', '规划图像描述...', 30)
      data = await step('Planner', () => plannerAgent.process(data))
      checkpoint('planner', data)
    }

    if (!data[`target_${t}_desc0_base64_jpg`] && !data[`target_${t}_desc0_image_url`]) {
      progress('visualizer', '图像生成中，约需 1-3 分钟，请耐心等待...', 70)
      data = await step('Visualizer[0]', () => visualizerAgent.process(data))
      checkpoint('visualizer_0', data)
    }

    progress('done', '完成', 100)
    return data
  }

  async #runPlannerStylist(data, retrieverAgent, plannerAgent, stylistAgent, visualizerAgent, retrieval, progress, checkpoint, step) {
    const t = this.expConfig.taskName

    if (!data.top_k_diagrams && !data.top_k_plots) {
      progress('retriever', '检索参考示例...', 10)
      data = await step('Retriever', () => retrieverAgent.process(data, retrieval))
      checkpoint('retriever', data)
    }

    if (!data[`target_${t}_desc0`]) {
      progress('planner', '规划图像描述...', 25)
      data = await step('Planner', () => plannerAgent.process(data))
      checkpoint('planner', data)
    }

    if (!data[`target_${t}_stylist_desc0`]) {
      progress('stylist', '应用 NeurIPS 风格指南...', 50)
      data = await step('Stylist', () => stylistAgent.process(data))
      checkpoint('stylist', data)
    }

    if (!data[`target_${t}_stylist_desc0_base64_jpg`] && !data[`target_${t}_stylist_desc0_image_url`]
      && !data[`target_${t}_desc0_base64_jpg`] && !data[`target_${t}_desc0_image_url`]) {
      progress('visualizer', '图像生成中，约需 1-3 分钟，请耐心等待...', 75)
      data = await step('Visualizer[0]', () => visualizerAgent.process(data))
      checkpoint('visualizer_0', data)
    }

    progress('done', '完成', 100)
    return data
  }

  async #runPlannerCritic(data, retrieverAgent, plannerAgent, visualizerAgent, criticAgent, retrieval, maxRounds, progress, checkpoint, step) {
    const t = this.expConfig.taskName

    if (!data.top_k_diagrams && !data.top_k_plots) {
      progress('retriever', '检索参考示例...', 5)
      data = await step('Retriever', () => retrieverAgent.process(data, retrieval))
      checkpoint('retriever', data)
    }

    if (!data[`target_${t}_desc0`]) {
      progress('planner', '规划图像描述...', 15)
      data = await step('Planner', () => plannerAgent.process(data))
      checkpoint('planner', data)
    }

    if (!data[`target_${t}_desc0_base64_jpg`] && !data[`target_${t}_desc0_image_url`]) {
      progress('visualizer', '第 1 轮图像生成，约需 1-3 分钟...', 30)
      data = await step('Visualizer[0]', () => visualizerAgent.process(data))
      checkpoint('visualizer_0', data)
    }

    for (let round = 0; round < maxRounds; round++) {
      data.current_critic_round = round
      const pctBase = 30 + (round + 1) * (60 / maxRounds)

      if (!data[`target_${t}_critic_desc${round}`]) {
        data = rehydrateImages(data)
        progress('critic', `Critic 第 ${round + 1}/${maxRounds} 轮审查中...`, pctBase - 10)
        data = await step(`Critic[${round}]`, () => criticAgent.process(data, 'planner'))
        checkpoint(`critic_${round}`, data)
      }

      if (data[`target_${t}_critic_suggestions${round}`]?.trim() === 'No changes needed.') {
        logger.info(`[Pipeline] C${data.candidate_id ?? '?'} Critic early-stop at round ${round}`)
        break
      }

      const imgKey = `target_${t}_critic_desc${round}`
      if (!data[`${imgKey}_base64_jpg`] && !data[`${imgKey}_image_url`]) {
        progress('visualizer', `Critic 第 ${round + 1} 轮反馈后重新生成图像，约需 1-3 分钟...`, pctBase)
        data = await step(`Visualizer[${round + 1}]`, () => visualizerAgent.process(data))
        checkpoint(`visualizer_${round + 1}`, data)
      }
    }

    progress('done', '完成', 100)
    return data
  }

  async #runFull(data, retrieverAgent, plannerAgent, stylistAgent, visualizerAgent, criticAgent, retrieval, maxRounds, progress, checkpoint, step) {
    const t = this.expConfig.taskName

    if (!data.top_k_diagrams && !data.top_k_plots) {
      progress('retriever', '检索参考示例...', 5)
      data = await step('Retriever', () => retrieverAgent.process(data, retrieval))
      checkpoint('retriever', data)
    }

    if (!data[`target_${t}_desc0`]) {
      progress('planner', '规划图像描述...', 15)
      data = await step('Planner', () => plannerAgent.process(data))
      checkpoint('planner', data)
    }

    if (!data[`target_${t}_stylist_desc0`]) {
      progress('stylist', '应用 NeurIPS 风格指南...', 30)
      data = await step('Stylist', () => stylistAgent.process(data))
      checkpoint('stylist', data)
    }

    if (!data[`target_${t}_stylist_desc0_base64_jpg`] && !data[`target_${t}_stylist_desc0_image_url`]
      && !data[`target_${t}_desc0_base64_jpg`] && !data[`target_${t}_desc0_image_url`]) {
      progress('visualizer', '第 1 轮图像生成，约需 1-3 分钟，请耐心等待...', 45)
      data = await step('Visualizer[0]', () => visualizerAgent.process(data))
      checkpoint('visualizer_0', data)
    }

    for (let round = 0; round < maxRounds; round++) {
      data.current_critic_round = round
      const pctBase = 45 + (round + 1) * (50 / maxRounds)

      if (!data[`target_${t}_critic_desc${round}`]) {
        data = rehydrateImages(data)
        progress('critic', `Critic 第 ${round + 1}/${maxRounds} 轮审查中...`, pctBase - 8)
        data = await step(`Critic[${round}]`, () => criticAgent.process(data, 'stylist'))
        checkpoint(`critic_${round}`, data)
      }

      if (data[`target_${t}_critic_suggestions${round}`]?.trim() === 'No changes needed.') {
        logger.info(`[Pipeline] C${data.candidate_id ?? '?'} Critic early-stop at round ${round}`)
        break
      }

      const imgKey = `target_${t}_critic_desc${round}`
      if (!data[`${imgKey}_base64_jpg`] && !data[`${imgKey}_image_url`]) {
        progress('visualizer', `Critic 第 ${round + 1} 轮反馈后重新生成图像，约需 1-3 分钟...`, pctBase)
        data = await step(`Visualizer[${round + 1}]`, () => visualizerAgent.process(data))
        checkpoint(`visualizer_${round + 1}`, data)
      }
    }

    progress('done', '完成', 100)
    return data
  }

  #extractRoundFromDescKey(descKey) {
    const match = descKey.match(/critic_desc(\d+)/)
    if (match) return parseInt(match[1], 10)
    return 0
  }
}

// ─── Step label mapping ───────────────────────────────────────

const STEP_LABELS = {
  Retriever: '检索参考示例',
  Planner: 'Planner：规划描述',
  Stylist: 'Stylist：风格优化',
  Vanilla: 'Vanilla：直接生成',
}
// Dynamic labels (Visualizer/Critic with round index) are handled in extractStepOutput

/**
 * Extract a small, serialisable output summary for a pipeline step.
 * IMPORTANT: never include raw base64 image data here.
 */
function extractStepOutput(stepName, data, taskType) {
  const t = taskType || 'diagram'

  if (stepName === 'Retriever') {
    const examples = data.top_k_diagrams || data.top_k_plots || []
    const names = examples.slice(0, 8).map((e) => e.filename || e.id || String(e)).filter(Boolean)
    return { type: 'retriever', count: examples.length, example_names: names }
  }

  if (stepName === 'Planner') {
    return {
      type: 'text',
      text: data[`target_${t}_desc0`] || '',
    }
  }

  if (stepName === 'Stylist') {
    return {
      type: 'text',
      text: data[`target_${t}_stylist_desc0`] || '',
    }
  }

  if (stepName === 'Vanilla') {
    return {
      type: 'text',
      text: data[`target_${t}_vanilla_desc`] || data[`target_${t}_desc0`] || '',
      image_url: data[`target_${t}_vanilla_image_url`] || null,
    }
  }

  const visMatch = stepName.match(/^Visualizer\[(\d+)\]$/)
  if (visMatch) {
    const round = parseInt(visMatch[1], 10)
    let imageUrl = null
    let descText = ''
    if (round === 0) {
      imageUrl = data[`target_${t}_stylist_desc0_image_url`]
        || data[`target_${t}_desc0_image_url`]
        || null
      descText = data[`target_${t}_stylist_desc0`] || data[`target_${t}_desc0`] || ''
    } else {
      const criticRound = round - 1
      imageUrl = data[`target_${t}_critic_desc${criticRound}_image_url`] || null
      descText = data[`target_${t}_critic_desc${criticRound}`] || ''
    }
    return { type: 'image', round, image_url: imageUrl, desc_text: descText }
  }

  const criticMatch = stepName.match(/^Critic\[(\d+)\]$/)
  if (criticMatch) {
    const round = parseInt(criticMatch[1], 10)
    const suggestions = data[`target_${t}_critic_suggestions${round}`] || ''
    const revisedDesc = data[`target_${t}_critic_desc${round}`] || ''
    const earlyStop = suggestions.trim() === 'No changes needed.'
    return { type: 'critic', round, suggestions, revised_desc: revisedDesc, early_stop: earlyStop }
  }

  return { type: 'unknown' }
}

// ─── Semaphore utility ────────────────────────────────────────

class Semaphore {
  constructor(max) {
    this.max = max
    this.count = 0
    this.queue = []
  }

  acquire() {
    return new Promise((resolve) => {
      if (this.count < this.max) {
        this.count++
        resolve(() => this.#release())
      } else {
        this.queue.push(resolve)
      }
    })
  }

  #release() {
    this.count--
    if (this.queue.length > 0) {
      this.count++
      const next = this.queue.shift()
      next(() => this.#release())
    }
  }
}
