import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { BaseAgent } from './BaseAgent.js'
import { DIAGRAM_PLANNER_SYSTEM_PROMPT, PLOT_PLANNER_SYSTEM_PROMPT } from '../utils/prompts.js'

export class PlannerAgent extends BaseAgent {
  constructor(opts) {
    super(opts)
    const isPlot = this.expConfig.taskName === 'plot'
    this.systemPrompt = isPlot ? PLOT_PLANNER_SYSTEM_PROMPT : DIAGRAM_PLANNER_SYSTEM_PROMPT
    this.taskConfig = isPlot
      ? {
          taskName: 'plot',
          contentLabel: 'Plot Raw Data',
          visualIntentLabel: 'Visual Intent of the Desired Plot',
        }
      : {
          taskName: 'diagram',
          contentLabel: 'Methodology Section',
          visualIntentLabel: 'Diagram Caption',
        }
  }

  async process(data) {
    const cfg = this.taskConfig

    const rawContent = data.content
    const content = typeof rawContent === 'object' ? JSON.stringify(rawContent) : rawContent
    const description = data.visual_intent

    const contentList = []

    // Build in-context learning examples
    let examples = data.retrieved_examples || []
    if (!examples.length && data.top10_references?.length) {
      examples = this.#loadExamplesFromDisk(data.top10_references, cfg.taskName)
    }

    let userPrompt = ''
    for (let idx = 0; idx < examples.length; idx++) {
      const item = examples[idx]
      userPrompt += `Example ${idx + 1}:\n`
      const itemContent = typeof item.content === 'object' ? JSON.stringify(item.content) : item.content
      userPrompt += `${cfg.contentLabel}: ${itemContent}\n`
      userPrompt += `${cfg.visualIntentLabel}: ${item.visual_intent}\nReference ${cfg.taskName.charAt(0).toUpperCase() + cfg.taskName.slice(1)}: `

      contentList.push({ type: 'text', text: userPrompt })

      // Attach reference image
      const imgPath = this.#resolveImagePath(cfg.taskName, item.path_to_gt_image)
      if (imgPath && existsSync(imgPath)) {
        const imgBase64 = readFileSync(imgPath).toString('base64')
        contentList.push({ type: 'image', imageBase64: imgBase64, mimeType: 'image/jpeg' })
      }
      userPrompt = ''
    }

    userPrompt += `Now, based on the following ${cfg.contentLabel.toLowerCase()} and ${cfg.visualIntentLabel.toLowerCase()}, provide a detailed description for the figure to be generated.\n`
    userPrompt += `${cfg.contentLabel}: ${content}\n${cfg.visualIntentLabel}: ${description}\n`
    userPrompt += 'Detailed description of the target figure to be generated'
    if (cfg.taskName === 'diagram') userPrompt += ' (do not include figure titles)'
    userPrompt += ':'
    contentList.push({ type: 'text', text: userPrompt })

    const response = await this.llmService.generateText({
      model: this.expConfig.modelName,
      systemPrompt: this.systemPrompt,
      contents: contentList,
    })

    data[`target_${cfg.taskName}_desc0`] = response.trim()
    return data
  }

  #loadExamplesFromDisk(refIds, taskName) {
    if (!this.expConfig.dataDir) return []
    const refFile = resolve(this.expConfig.dataDir, taskName, 'ref.json')
    if (!existsSync(refFile)) return []
    const pool = JSON.parse(readFileSync(refFile, 'utf8'))
    const map = Object.fromEntries(pool.map((i) => [i.id, i]))
    return refIds.filter((id) => map[id]).map((id) => map[id])
  }

  #resolveImagePath(taskName, relPath) {
    if (!relPath || !this.expConfig.dataDir) return null
    return resolve(this.expConfig.dataDir, taskName, relPath)
  }
}
