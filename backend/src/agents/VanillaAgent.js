import { BaseAgent } from './BaseAgent.js'
import { DIAGRAM_VANILLA_SYSTEM_PROMPT, PLOT_VANILLA_SYSTEM_PROMPT } from '../utils/prompts.js'
import { convertPngBase64ToJpgBase64 } from '../utils/imageUtils.js'
import logger from '../utils/logger.js'

export class VanillaAgent extends BaseAgent {
  constructor(opts) {
    super(opts)
    this.onPlotRenderRequest = opts.onPlotRenderRequest || null
    const isPlot = this.expConfig.taskName === 'plot'
    this.taskConfig = isPlot
      ? {
          taskName: 'plot',
          useImageGeneration: false,
          systemPrompt: PLOT_VANILLA_SYSTEM_PROMPT,
          promptTemplate: (content, visualIntent) =>
            `Generate a Plotly.js figure specification object for a statistical plot.\n\nRaw Data: ${content}\nVisual Intent: ${visualIntent}\n\nPlotly figure JSON:`,
        }
      : {
          taskName: 'diagram',
          useImageGeneration: true,
          systemPrompt: DIAGRAM_VANILLA_SYSTEM_PROMPT,
          promptTemplate: (content, visualIntent) =>
            `Generate a high-quality scientific diagram for an academic paper.\n\nMethodology Section: ${content}\nFigure Caption: ${visualIntent}\n\nDiagram:`,
        }
  }

  async process(data) {
    const cfg = this.taskConfig
    const taskName = cfg.taskName
    const content = typeof data.content === 'object' ? JSON.stringify(data.content) : data.content
    const visualIntent = data.visual_intent
    const prompt = cfg.promptTemplate(content, visualIntent)
    const aspectRatio = data.additional_info?.rounded_ratio || '16:9'

    try {
      if (cfg.useImageGeneration) {
        const base64Png = await this.llmService.generateImage({
          model: this.expConfig.imageModelName,
          systemPrompt: cfg.systemPrompt,
          contents: [{ type: 'text', text: prompt }],
          aspectRatio,
          imageSize: '1k',
        })

        if (base64Png) {
          const jpgBase64 = await convertPngBase64ToJpgBase64(base64Png)
          if (jpgBase64) data[`target_${taskName}_vanilla_base64_jpg`] = jpgBase64
        }
      } else {
        const raw = await this.llmService.generateText({
          model: this.expConfig.modelName,
          systemPrompt: cfg.systemPrompt,
          contents: [{ type: 'text', text: prompt }],
        })
        const plotlySpec = this.#parsePlotlySpec(raw)
        if (plotlySpec) {
          data[`target_${taskName}_vanilla_plotly_spec`] = plotlySpec
          if (this.onPlotRenderRequest) {
            const rendered = await this.onPlotRenderRequest(plotlySpec, `target_${taskName}_vanilla`)
            if (rendered) {
              data[`target_${taskName}_vanilla_base64_jpg`] = rendered.includes(',')
                ? rendered.split(',')[1]
                : rendered
            }
          }
        }
      }
    } catch (err) {
      logger.error('VanillaAgent process failed', { error: err.message })
    }

    return data
  }

  #parsePlotlySpec(raw) {
    try {
      const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/)
      return JSON.parse(jsonMatch ? jsonMatch[1] : raw.trim())
    } catch {
      return null
    }
  }
}
