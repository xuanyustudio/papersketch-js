import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { BaseAgent } from './BaseAgent.js'
import { DIAGRAM_STYLIST_SYSTEM_PROMPT, PLOT_STYLIST_SYSTEM_PROMPT } from '../utils/prompts.js'
import config from '../config/index.js'

export class StylistAgent extends BaseAgent {
  constructor(opts) {
    super(opts)
    const isPlot = this.expConfig.taskName === 'plot'
    this.systemPrompt = isPlot ? PLOT_STYLIST_SYSTEM_PROMPT : DIAGRAM_STYLIST_SYSTEM_PROMPT
    this.taskConfig = isPlot
      ? {
          taskName: 'plot',
          styleGuideFile: 'neurips2025_plot_style_guide.md',
          contextLabels: ['Raw Data', 'Visual Intent of the Desired Plot'],
        }
      : {
          taskName: 'diagram',
          styleGuideFile: 'neurips2025_diagram_style_guide.md',
          contextLabels: ['Methodology Section', 'Diagram Caption'],
        }
  }

  async process(data) {
    const cfg = this.taskConfig
    const inputKey = `target_${cfg.taskName}_desc0`
    const outputKey = `target_${cfg.taskName}_stylist_desc0`

    const detailedDescription = data[inputKey]
    const styleGuide = this.#loadStyleGuide(cfg.styleGuideFile)

    const rawContent = data.content
    const contentStr = typeof rawContent === 'object' ? JSON.stringify(rawContent) : rawContent

    const userPrompt = [
      `Detailed Description: ${detailedDescription}`,
      `Style Guidelines: ${styleGuide}`,
      `${cfg.contextLabels[0]}: ${contentStr}`,
      `${cfg.contextLabels[1]}: ${data.visual_intent}`,
      'Your Output:',
    ].join('\n')

    const response = await this.llmService.generateText({
      model: this.expConfig.modelName,
      systemPrompt: this.systemPrompt,
      contents: [{ type: 'text', text: userPrompt }],
    })

    data[outputKey] = response
    return data
  }

  #loadStyleGuide(filename) {
    const guidePath = resolve(config.styleGuidesDir, filename)
    if (existsSync(guidePath)) {
      return readFileSync(guidePath, 'utf8')
    }
    return '(Style guide not found – using default aesthetic standards)'
  }
}
