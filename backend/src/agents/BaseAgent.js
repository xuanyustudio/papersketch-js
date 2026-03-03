/**
 * Base class for all PaperBanana agents.
 * Each agent receives the shared expConfig and llmService,
 * and must implement the process() method.
 */
export class BaseAgent {
  /**
   * @param {object} opts
   * @param {import('../config/index.js').default} opts.expConfig
   * @param {import('../services/LLMService.js').LLMService} opts.llmService
   */
  constructor({ expConfig, llmService }) {
    if (!expConfig) throw new Error('expConfig is required')
    if (!llmService) throw new Error('llmService is required')
    this.expConfig = expConfig
    this.llmService = llmService
  }

  /**
   * Process a data item through this agent.
   * @param {object} data - The data dict passed through the pipeline
   * @returns {Promise<object>} - Updated data dict
   */
  async process(data) {
    throw new Error(`${this.constructor.name}.process() is not implemented`)
  }
}
