import { BaseAgent } from './BaseAgent.js'
import {
  DIAGRAM_VISUALIZER_SYSTEM_PROMPT,
  PLOT_VISUALIZER_SYSTEM_PROMPT,
} from '../utils/prompts.js'
import { convertPngBase64ToJpgBase64 } from '../utils/imageUtils.js'
import logger from '../utils/logger.js'

/**
 * VisualizerAgent
 *
 * For DIAGRAM tasks: calls image generation API (Gemini/GPT-image) directly.
 * For PLOT tasks: calls text model to generate Plotly spec JSON,
 *   then emits an event for the frontend to render and return the image.
 *
 * The eventEmitter and socketCallback allow the Critic loop to wait
 * for the frontend to render the Plotly chart and return the base64 image.
 */
export class VisualizerAgent extends BaseAgent {
  /**
   * @param {object} opts
   * @param {Function} [opts.onPlotRenderRequest] - async (plotSpec) => base64ImageString
   *   Called for plot tasks to request frontend rendering.
   */
  constructor(opts) {
    super(opts)
    this.onPlotRenderRequest = opts.onPlotRenderRequest || null

    const isPlot = this.expConfig.taskName === 'plot'
    this.taskConfig = isPlot
      ? {
          taskName: 'plot',
          useImageGeneration: false,
          systemPrompt: PLOT_VISUALIZER_SYSTEM_PROMPT,
          promptTemplate: (desc) =>
            `Generate a Plotly.js figure specification object for a statistical plot based on the following detailed description. The output must be a complete, valid JSON object with "data" and optional "layout"/"config", directly usable by Plotly.newPlot().\n\nCRITICAL LANGUAGE RULE: ALL text in the spec (layout.title.text, axis titles, data[*].name, annotations, tick labels) MUST match the language of the Description below. If the Description is in Chinese, use Simplified Chinese (简体中文); if it is in English, use English. Do NOT mix languages.\n\nDescription:\n${desc}\n\nPlotly figure JSON:`,
        }
      : {
          taskName: 'diagram',
          useImageGeneration: true,
          systemPrompt: DIAGRAM_VISUALIZER_SYSTEM_PROMPT,
          promptTemplate: (desc) =>
            `Render an image based on the following detailed description: ${desc}\nNote that do not include figure titles in the image. Diagram: `,
        }
  }

  async process(data) {
    const cfg = this.taskConfig
    const taskName = cfg.taskName

    // Collect all description keys that need visualization
    // Helper: check if image already generated (in memory as base64 OR saved to disk as URL)
    const imageExists = (key) => !!(data[`${key}_base64_jpg`] || data[`${key}_image_url`])

    const descKeysToProcess = []
    for (const key of [`target_${taskName}_desc0`, `target_${taskName}_stylist_desc0`]) {
      if (data[key] && !imageExists(key)) {
        descKeysToProcess.push(key)
      }
    }
    for (let round = 0; round < 3; round++) {
      const key = `target_${taskName}_critic_desc${round}`
      if (data[key] && !imageExists(key)) {
        const suggKey = `target_${taskName}_critic_suggestions${round}`
        if (data[suggKey]?.trim() === 'No changes needed.' && round > 0) {
          const prevKey = `target_${taskName}_critic_desc${round - 1}_base64_jpg`
          const prevUrlKey = `target_${taskName}_critic_desc${round - 1}_image_url`
          if (data[prevKey]) {
            data[`${key}_base64_jpg`] = data[prevKey]
            continue
          } else if (data[prevUrlKey]) {
            data[`${key}_image_url`] = data[prevUrlKey]
            continue
          }
        }
        descKeysToProcess.push(key)
      }
    }

    for (const descKey of descKeysToProcess) {
      const desc = data[descKey]
      if (cfg.useImageGeneration) {
        await this.#generateImage(data, descKey, desc)
      } else {
        await this.#generatePlotly(data, descKey, desc)
      }
    }

    return data
  }

  async #generateImage(data, descKey, desc) {
    const cfg = this.taskConfig
    const prompt = cfg.promptTemplate(desc)
    const aspectRatio = data.additional_info?.rounded_ratio || '16:9'

    try {
      const base64Png = await this.llmService.generateImage({
        model: this.expConfig.imageModelName,
        systemPrompt: cfg.systemPrompt,
        contents: [{ type: 'text', text: prompt }],
        aspectRatio,
        imageSize: '1k',
      })

      if (base64Png) {
        const jpgBase64 = await convertPngBase64ToJpgBase64(base64Png)
        if (jpgBase64) data[`${descKey}_base64_jpg`] = jpgBase64
        else logger.warn(`Image conversion failed for ${descKey}`)
      }
    } catch (err) {
      logger.error(`Image generation failed for ${descKey}`, { error: err.message })
    }
  }

  async #generatePlotly(data, descKey, desc) {
    const cfg = this.taskConfig
    const prompt = cfg.promptTemplate(desc)

    try {
      const raw = await this.llmService.generateText({
        model: this.expConfig.modelName,
        systemPrompt: cfg.systemPrompt,
        contents: [{ type: 'text', text: prompt }],
      })

      // Parse Plotly figure JSON
      const plotlySpec = this.#parsePlotlySpec(raw)
      if (!plotlySpec) {
        logger.warn(`Failed to parse Plotly spec for ${descKey}`)
        data[`${descKey}_plotly_error`] = 'Failed to parse Plotly figure JSON'
        return
      }

      // Keep both keys for backward compatibility with old history/frontends.
      data[`${descKey}_plotly_spec`] = plotlySpec

      // Request frontend rendering via callback
      if (this.onPlotRenderRequest) {
        const imageBase64 = await this.onPlotRenderRequest(plotlySpec, descKey)
        if (imageBase64) {
          const stripped = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64
          data[`${descKey}_base64_jpg`] = stripped
        } else {
          logger.warn(`Frontend did not return image for ${descKey}`)
          data[`${descKey}_base64_jpg`] = null
        }
      }
    } catch (err) {
      logger.error(`Plotly generation failed for ${descKey}`, { error: err.message })
    }
  }

  #parsePlotlySpec(raw) {
    try {
      const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/)
      const jsonStr = jsonMatch ? jsonMatch[1] : raw.trim()
      return JSON.parse(jsonStr)
    } catch {
      try {
        const braceStart = raw.indexOf('{')
        const braceEnd = raw.lastIndexOf('}')
        if (braceStart !== -1 && braceEnd !== -1) {
          return JSON.parse(raw.slice(braceStart, braceEnd + 1))
        }
      } catch {}
      return null
    }
  }
}
