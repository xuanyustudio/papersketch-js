import { jsonrepair } from 'jsonrepair'
import { BaseAgent } from './BaseAgent.js'
import { DIAGRAM_CRITIC_SYSTEM_PROMPT, PLOT_CRITIC_SYSTEM_PROMPT } from '../utils/prompts.js'
import logger from '../utils/logger.js'

export class CriticAgent extends BaseAgent {
  constructor(opts) {
    super(opts)
    const isPlot = this.expConfig.taskName === 'plot'
    this.systemPrompt = isPlot ? PLOT_CRITIC_SYSTEM_PROMPT : DIAGRAM_CRITIC_SYSTEM_PROMPT
    this.taskConfig = isPlot
      ? {
          taskName: 'plot',
          critiqueTarget: 'Target Plot for Critique:',
          contextLabels: ['Raw Data', 'Visual Intent'],
        }
      : {
          taskName: 'diagram',
          critiqueTarget: 'Target Diagram for Critique:',
          contextLabels: ['Methodology Section', 'Figure Caption'],
        }
  }

  /**
   * @param {object} data
   * @param {string} [source] - 'stylist' | 'planner'
   */
  async process(data, source = 'stylist') {
    const cfg = this.taskConfig
    const taskName = cfg.taskName
    const roundIdx = data.current_critic_round ?? 0

    let descKey, base64Key
    if (roundIdx === 0) {
      if (source === 'stylist') {
        descKey = `target_${taskName}_stylist_desc0`
        base64Key = `target_${taskName}_stylist_desc0_base64_jpg`
      } else {
        descKey = `target_${taskName}_desc0`
        base64Key = `target_${taskName}_desc0_base64_jpg`
      }
    } else {
      descKey = `target_${taskName}_critic_desc${roundIdx - 1}`
      base64Key = `target_${taskName}_critic_desc${roundIdx - 1}_base64_jpg`
    }

    const detailedDescription = data[descKey]
    const imageBase64 = data[base64Key]
    const contentStr = typeof data.content === 'object' ? JSON.stringify(data.content) : data.content
    const visualIntent = data.visual_intent

    const contents = [{ type: 'text', text: cfg.critiqueTarget }]

    if (imageBase64 && imageBase64.length > 100) {
      contents.push({ type: 'image', imageBase64, mimeType: 'image/jpeg' })
    } else {
      logger.warn(`[Critic] No valid image for round ${roundIdx}, using text-only mode`)
      contents.push({
        type: 'text',
        text: '\n[SYSTEM NOTICE] The image could not be generated based on the current description. Please check the description for errors and provide a revised version.',
      })
    }

    contents.push({
      type: 'text',
      text: `Detailed Description: ${detailedDescription}\n${cfg.contextLabels[0]}: ${contentStr}\n${cfg.contextLabels[1]}: ${visualIntent}\nYour Output:`,
    })

    const raw = await this.llmService.generateText({
      model: this.expConfig.modelName,
      systemPrompt: this.systemPrompt,
      contents,
    })

    const result = this.#parseJson(raw)
    const criticSuggestions = result.critic_suggestions ?? 'No changes needed.'
    let revisedDescription = result.revised_description ?? 'No changes needed.'

    if (revisedDescription.trim() === 'No changes needed.') {
      revisedDescription = detailedDescription
    }

    data[`target_${taskName}_critic_suggestions${roundIdx}`] = criticSuggestions
    data[`target_${taskName}_critic_desc${roundIdx}`] = revisedDescription

    return data
  }

  #parseJson(raw) {
    try {
      const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim()
      try {
        return JSON.parse(cleaned)
      } catch {
        return JSON.parse(jsonrepair(cleaned))
      }
    } catch {
      return {}
    }
  }
}
