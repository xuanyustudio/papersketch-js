import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { BaseAgent } from './BaseAgent.js'
import {
  DIAGRAM_SUGGESTION_SYSTEM_PROMPT,
  PLOT_SUGGESTION_SYSTEM_PROMPT,
  DIAGRAM_POLISH_SYSTEM_PROMPT,
  PLOT_POLISH_SYSTEM_PROMPT,
} from '../utils/prompts.js'
import { convertPngBase64ToJpgBase64 } from '../utils/imageUtils.js'
import config from '../config/index.js'
import logger from '../utils/logger.js'

export class PolishAgent extends BaseAgent {
  constructor(opts) {
    super(opts)
    const isPlot = this.expConfig.taskName === 'plot'
    this.suggestionSystemPrompt = isPlot ? PLOT_SUGGESTION_SYSTEM_PROMPT : DIAGRAM_SUGGESTION_SYSTEM_PROMPT
    this.polishSystemPrompt = isPlot ? PLOT_POLISH_SYSTEM_PROMPT : DIAGRAM_POLISH_SYSTEM_PROMPT
    this.taskConfig = isPlot
      ? { taskName: 'plot', styleGuideFile: 'neurips2025_plot_style_guide.md' }
      : { taskName: 'diagram', styleGuideFile: 'neurips2025_diagram_style_guide.md' }
  }

  /**
   * Two-step polish:
   * 1. Analyze image against style guide → suggestions
   * 2. Apply suggestions via image generation model
   *
   * @param {string} imageBase64 - Input image as base64 (no data URI prefix)
   * @param {string} [aspectRatio]
   * @returns {Promise<{polishedBase64: string|null, suggestions: string}>}
   */
  async refineImage(imageBase64, aspectRatio = '16:9') {
    const cfg = this.taskConfig
    const styleGuide = this.#loadStyleGuide(cfg.styleGuideFile)

    // Step 1: Generate improvement suggestions
    logger.info(`[PolishAgent] Step 1: Generating suggestions...`)
    const suggestions = await this.#generateSuggestions(imageBase64, styleGuide)

    // Step 2: Apply suggestions
    logger.info(`[PolishAgent] Step 2: Applying suggestions...`)
    const polishedBase64 = await this.#applyPolish(imageBase64, suggestions, aspectRatio)

    return { polishedBase64, suggestions }
  }

  async #generateSuggestions(imageBase64, styleGuide) {
    const userPrompt = `Here is the style guide:\n${styleGuide}\n\nPlease analyze the provided image against this style guide and list up to 10 specific improvement suggestions to make the image visually more appealing. If the image is already perfect, just say "No changes needed".`

    try {
      return await this.llmService.generateText({
        model: this.expConfig.modelName,
        systemPrompt: this.suggestionSystemPrompt,
        contents: [
          { type: 'text', text: userPrompt },
          { type: 'image', imageBase64, mimeType: 'image/jpeg' },
        ],
      })
    } catch (err) {
      logger.error('PolishAgent suggestion step failed', { error: err.message })
      return ''
    }
  }

  async #applyPolish(imageBase64, suggestions, aspectRatio) {
    if (!suggestions || suggestions.includes('No changes needed')) {
      return null
    }

    const userPrompt = `Please polish this image based on the following suggestions:\n\n${suggestions}\n\nPolished Image:`

    try {
      const base64Png = await this.llmService.generateImage({
        model: this.expConfig.imageModelName,
        systemPrompt: this.polishSystemPrompt,
        contents: [
          { type: 'text', text: userPrompt },
          { type: 'image', imageBase64, mimeType: 'image/jpeg' },
        ],
        aspectRatio,
        imageSize: '1k',
      })

      if (base64Png) {
        return await convertPngBase64ToJpgBase64(base64Png)
      }
      return null
    } catch (err) {
      logger.error('PolishAgent apply step failed', { error: err.message })
      return null
    }
  }

  #loadStyleGuide(filename) {
    const guidePath = resolve(config.styleGuidesDir, filename)
    if (existsSync(guidePath)) return readFileSync(guidePath, 'utf8')
    return '(Style guide not found)'
  }
}
