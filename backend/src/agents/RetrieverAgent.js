import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { BaseAgent } from './BaseAgent.js'
import {
  DIAGRAM_RETRIEVER_SYSTEM_PROMPT,
  PLOT_RETRIEVER_SYSTEM_PROMPT,
} from '../utils/prompts.js'
import logger from '../utils/logger.js'

export class RetrieverAgent extends BaseAgent {
  constructor(opts) {
    super(opts)
    const isPlot = this.expConfig.taskName === 'plot'
    this.systemPrompt = isPlot ? PLOT_RETRIEVER_SYSTEM_PROMPT : DIAGRAM_RETRIEVER_SYSTEM_PROMPT
    this.taskConfig = isPlot
      ? {
          taskName: 'plot',
          refLimit: null,
          targetLabels: ['Visual Intent', 'Raw Data'],
          candidateLabels: ['Plot ID', 'Visual Intent', 'Raw Data'],
          candidateType: 'Plot',
          outputKey: 'top10_references',
          instructionSuffix:
            'select the Top 10 most relevant plots. Output strictly valid JSON with a single list of the exact ids.',
          resultKey: 'top10_plots',
        }
      : {
          taskName: 'diagram',
          refLimit: 200,
          targetLabels: ['Caption', 'Methodology section'],
          candidateLabels: ['Diagram ID', 'Caption', 'Methodology section'],
          candidateType: 'Diagram',
          outputKey: 'top10_references',
          instructionSuffix:
            'select the Top 10 most relevant diagrams. Output strictly valid JSON with a single list of the exact ids.',
          resultKey: 'top10_diagrams',
        }
  }

  async process(data, retrievalSetting = 'auto') {
    const cfg = this.taskConfig
    const refFile = this.#refFilePath(cfg.taskName)

    // Graceful fallback when dataset not present
    if (['auto', 'random'].includes(retrievalSetting) && !existsSync(refFile)) {
      logger.warn(`Reference file not found at ${refFile}, falling back to retrieval_setting=none`)
      retrievalSetting = 'none'
    }

    if (retrievalSetting === 'manual') {
      const manualFile = this.#manualFilePath(cfg.taskName)
      if (!existsSync(manualFile)) {
        logger.warn(`Manual reference file not found, falling back to none`)
        retrievalSetting = 'none'
      }
    }

    switch (retrievalSetting) {
      case 'none':
        data.top10_references = []
        data.retrieved_examples = []
        break
      case 'manual':
        data.top10_references = this.#loadManualReferences(cfg)
        data.retrieved_examples = []
        break
      case 'random':
        data.top10_references = this.#loadRandomReferences(cfg)
        data.retrieved_examples = []
        break
      case 'auto':
        data.top10_references = await this.#retrieveAndParse(data, cfg)
        data.retrieved_examples = []
        break
      default:
        throw new Error(`Unknown retrieval_setting: ${retrievalSetting}`)
    }

    return data
  }

  #refFilePath(taskName) {
    if (!this.expConfig.dataDir) return '/nonexistent'
    return resolve(this.expConfig.dataDir, taskName, 'ref.json')
  }

  #manualFilePath(taskName) {
    if (!this.expConfig.dataDir) return '/nonexistent'
    return resolve(this.expConfig.dataDir, taskName, 'agent_selected_12.json')
  }

  #loadManualReferences(cfg) {
    const file = this.#manualFilePath(cfg.taskName)
    const items = JSON.parse(readFileSync(file, 'utf8')).slice(0, 10)
    return items.map((i) => i.id)
  }

  #loadRandomReferences(cfg) {
    const file = this.#refFilePath(cfg.taskName)
    const pool = JSON.parse(readFileSync(file, 'utf8'))
    const ids = pool.map((i) => i.id)
    const n = Math.min(10, ids.length)
    const shuffled = [...ids].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, n)
  }

  async #retrieveAndParse(data, cfg) {
    const content = typeof data.content === 'object' ? JSON.stringify(data.content) : String(data.content)
    const visualIntent = data.visual_intent

    let userPrompt = `**Target Input**\n- ${cfg.targetLabels[0]}: ${visualIntent}\n- ${cfg.targetLabels[1]}: ${content}\n\n**Candidate Pool**\n`

    const file = this.#refFilePath(cfg.taskName)
    let pool = JSON.parse(readFileSync(file, 'utf8'))
    if (cfg.refLimit) pool = pool.slice(0, cfg.refLimit)

    for (let idx = 0; idx < pool.length; idx++) {
      const item = pool[idx]
      userPrompt += `Candidate ${cfg.candidateType} ${idx + 1}:\n`
      userPrompt += `- ${cfg.candidateLabels[0]}: ${item.id}\n`
      userPrompt += `- ${cfg.candidateLabels[1]}: ${item.visual_intent}\n`
      userPrompt += `- ${cfg.candidateLabels[2]}: ${String(item.content)}\n\n`
    }

    userPrompt += `Now, based on the Target Input and the Candidate Pool, ${cfg.instructionSuffix}`

    const raw = await this.llmService.generateText({
      model: this.expConfig.modelName,
      systemPrompt: this.systemPrompt,
      contents: [{ type: 'text', text: userPrompt }],
    })

    return this.#parseResult(raw, cfg)
  }

  #parseResult(raw, cfg) {
    try {
      const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(cleaned)
      return parsed[cfg.resultKey] ?? []
    } catch {
      const match = raw.match(/"[^"]+"/g)
      return match ? match.map((s) => s.replace(/"/g, '')) : []
    }
  }
}
