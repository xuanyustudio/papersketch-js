import { GoogleGenAI } from '@google/genai'
import OpenAI from 'openai'
import { fal } from '@fal-ai/client'
import config from '../config/index.js'
import logger from '../utils/logger.js'

/**
 * Unified LLM service wrapping Gemini and OpenAI.
 * All agents call this service instead of SDKs directly,
 * keeping API keys in one place and enabling easy model switching.
 */
export class LLMService {
  constructor() {
    if (config.googleApiKey) {
      const geminiOpts = { apiKey: config.googleApiKey }
      // 中转站支持：替换 Gemini API 的 base URL
      if (config.geminiBaseUrl) {
        geminiOpts.httpOptions = { baseUrl: config.geminiBaseUrl }
      }
      this.gemini = new GoogleGenAI(geminiOpts)
      logger.info(`Gemini initialized via ${config.geminiBaseUrl || 'Google official API'}`)
    }
    if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey })
    }
    if (config.doubaoApiKey) {
      this.doubao = new OpenAI({
        apiKey: config.doubaoApiKey,
        baseURL: config.doubaoBaseUrl || undefined,
      })
      logger.info(`Doubao initialized via ${config.doubaoBaseUrl || 'default endpoint'}`)
    }
    if (config.falApiKey) {
      fal.config({
        credentials: config.falApiKey,
        // proxyUrl routes all fal requests through a custom relay
        ...(config.falBaseUrl && config.falBaseUrl !== 'https://fal.run'
          ? { proxyUrl: config.falBaseUrl }
          : {}),
      })
      logger.info(`fal.ai initialized via ${config.falBaseUrl || 'https://fal.run'}`)
    }
  }

  /**
   * Generate text (or multimodal) content.
   * @param {object} opts
   * @param {string} opts.model - Model name
   * @param {string} opts.systemPrompt - System instruction
   * @param {Array}  opts.contents - Content parts: [{type:'text',text:''} | {type:'image',imageBase64:'',mimeType:''}]
   * @param {object} [opts.genConfig] - Additional GenerateContentConfig overrides
   * @returns {Promise<string>} - Text response
   */
  async generateText({ model, systemPrompt, contents, genConfig = {} }) {
    const inputLen = contents.reduce((s, c) => s + (c.text?.length ?? 0), 0)
    const imgCount = contents.filter((c) => c.type === 'image').length
    logger.info(`[LLM] generateText  model=${model}  inputChars=${inputLen}  images=${imgCount}`)
    const t0 = Date.now()
    const fn = () => this.#callGeminiText({ model, systemPrompt, contents, genConfig })
    const result = await this.#callWithRetry(fn, config.maxRetryAttempts, config.retryDelayMs)
    logger.info(`[LLM] generateText  ✓ done  elapsed=${Date.now() - t0}ms  outputChars=${result?.length ?? 0}`)
    return result
  }

  /**
   * Generate an image using a generative image model.
   * @param {object} opts
   * @param {string} opts.model - Model name
   * @param {string} opts.systemPrompt - System instruction
   * @param {Array}  opts.contents - Content parts (text + optional input image)
   * @param {string} [opts.aspectRatio] - e.g. '16:9'
   * @param {string} [opts.imageSize] - e.g. '1k'
   * @returns {Promise<string|null>} - Base64 PNG string (no data URI prefix)
   */
  async generateImage({ model, systemPrompt, contents, aspectRatio = '16:9', imageSize = '1k' }) {
    logger.info(`[LLM] generateImage  model=${model}  aspectRatio=${aspectRatio}`)
    const t0 = Date.now()

    let result
    if (model.includes('gpt-image')) {
      const fn = () => this.#callOpenAIImage({ model, contents })
      result = await this.#callWithRetry(fn, config.maxRetryAttempts, 30000)
    } else if (model.startsWith('doubao-')) {
      const fn = () => this.#callDoubaoImage({ model, contents })
      result = await this.#callWithRetry(fn, config.maxRetryAttempts, 30000)
    } else if (model.startsWith('fal-ai/')) {
      const fn = () => this.#callFalImage({ model, contents, aspectRatio })
      result = await this.#callWithRetry(fn, config.maxRetryAttempts, 30000)
    } else {
      const fn = () => this.#callGeminiImage({ model, systemPrompt, contents, aspectRatio, imageSize })
      result = await this.#callWithRetry(fn, config.maxRetryAttempts, 30000)
    }

    const elapsed = Date.now() - t0
    if (result) {
      logger.info(`[LLM] generateImage  done  elapsed=${elapsed}ms  base64Len=${result.length}`)
    } else {
      logger.warn(`[LLM] generateImage  done but returned null  elapsed=${elapsed}ms  (model may not have produced an image)`)
    }
    return result
  }

  // ─── Private: Gemini text ──────────────────────────────────

  async #callGeminiText({ model, systemPrompt, contents, genConfig }) {
    if (!this.gemini) throw new Error('Google API key not configured')

    const parts = this.#buildParts(contents)

    const apiCall = this.gemini.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: systemPrompt,
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens,
        candidateCount: 1,
        ...genConfig,
      },
    })

    // 60s timeout for text generation
    const response = await this.#withTimeout(apiCall, 60000, 'Text generation timeout (60s)')
    return response.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  }

  // ─── Private: Gemini image generation ─────────────────────

  async #callGeminiImage({ model, systemPrompt, contents, aspectRatio, imageSize }) {
    if (!this.gemini) throw new Error('Google API key not configured')

    const parts = this.#buildParts(contents)

    const apiCall = this.gemini.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: systemPrompt,
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens,
        candidateCount: 1,
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio, imageSize },
      },
    })

    // Heartbeat: log every 30s so we know the call is still running
    const startTs = Date.now()
    const heartbeat = setInterval(() => {
      logger.info(`[LLM] generateImage  still waiting...  elapsed=${Math.round((Date.now() - startTs) / 1000)}s`)
    }, 30000)

    let response
    try {
      // 3-minute timeout for image generation
      response = await this.#withTimeout(apiCall, 180000, 'Image generation timeout (3min)')
    } finally {
      clearInterval(heartbeat)
    }

    const candidate = response.candidates?.[0]
    if (!candidate) return null

    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData?.data) {
        return part.inlineData.data
      }
    }
    return null
  }

  // ─── Private: fal.ai image generation ─────────────────────

  /** Map aspect ratio string to fal.ai image_size enum */
  #falImageSize(aspectRatio) {
    const map = {
      '16:9': 'landscape_16_9',
      '21:9': 'landscape_16_9',
      '3:2': 'landscape_4_3',
      '4:3': 'landscape_4_3',
      '1:1': 'square_hd',
      '9:16': 'portrait_16_9',
    }
    return map[aspectRatio] || 'landscape_16_9'
  }

  async #callFalImage({ model, contents, aspectRatio }) {
    if (!config.falApiKey) throw new Error('FAL API key not configured')

    const textPart = contents.find((c) => c.type === 'text')
    const prompt = textPart?.text ?? ''
    const imageSize = this.#falImageSize(aspectRatio)

    const startTs = Date.now()
    const heartbeat = setInterval(() => {
      logger.info(`[LLM] fal.ai waiting...  elapsed=${Math.round((Date.now() - startTs) / 1000)}s`)
    }, 30000)

    let imageUrl
    try {
      const result = await this.#withTimeout(
        fal.subscribe(model, {
          input: { prompt, image_size: imageSize, num_images: 1 },
        }),
        180000,
        'fal.ai image generation timeout (3min)',
      )
      imageUrl = result?.data?.images?.[0]?.url ?? result?.images?.[0]?.url ?? null
    } finally {
      clearInterval(heartbeat)
    }

    if (!imageUrl) return null

    // Download image URL and convert to base64
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) throw new Error(`Failed to download fal.ai image: HTTP ${imgRes.status}`)
    const buf = Buffer.from(await imgRes.arrayBuffer())
    return buf.toString('base64')
  }

  // ─── Private: helpers ──────────────────────────────────────

  #buildParts(contents) {
    return contents.map((c) => {
      if (c.type === 'text') return { text: c.text }
      if (c.type === 'image') {
        return { inlineData: { mimeType: c.mimeType || 'image/jpeg', data: c.imageBase64 } }
      }
      throw new Error(`Unknown content type: ${c.type}`)
    })
  }

  #withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(label)), ms)
      ),
    ])
  }

  // ─── Private: OpenAI image generation ─────────────────────

  async #callOpenAIImage({ model, contents }) {
    if (!this.openai) throw new Error('OpenAI API key not configured')

    const textPart = contents.find((c) => c.type === 'text')
    const prompt = textPart?.text ?? ''

    const response = await this.openai.images.generate({
      model,
      prompt,
      size: '1536x1024',
      quality: 'high',
      response_format: 'b64_json',
    })

    return response.data?.[0]?.b64_json ?? null
  }

  // ─── Private: Doubao image generation ─────────────────────

  async #callDoubaoImage({ model, contents }) {
    if (!this.doubao) throw new Error('Doubao API key not configured')
    if (!config.doubaoBaseUrl) {
      throw new Error('Doubao base URL not configured (set DOUBAO_BASE_URL)')
    }

    const textPart = contents.find((c) => c.type === 'text')
    const prompt = textPart?.text ?? ''

    const response = await this.doubao.images.generate({
      model,
      prompt,
      response_format: 'b64_json',
    })

    const b64 = response?.data?.[0]?.b64_json
    if (b64) return b64

    const imageUrl = response?.data?.[0]?.url ?? response?.output?.[0]?.url ?? null
    if (!imageUrl) {
      const preview = JSON.stringify(response)?.slice(0, 500)
      throw new Error(`Doubao image response has no image content (no b64_json/url). Raw: ${preview}`)
    }
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) throw new Error(`Failed to download doubao image: HTTP ${imgRes.status}`)
    const buf = Buffer.from(await imgRes.arrayBuffer())
    return buf.toString('base64')
  }

  // ─── Private: retry helper ─────────────────────────────────

  /** Categorise an error for clearer log messages */
  #classifyError(err) {
    const msg = err.message ?? ''
    const status = err.status ?? err.response?.status

    if (msg.includes('timeout') || msg.includes('Timeout')) return '⏱ TIMEOUT'
    if (msg.includes('insufficient_quota') || msg.includes('quota failed')) return '💰 QUOTA_EXCEEDED'
    if (msg.includes('not found') || msg.includes('is not supported') || msg.includes('"code":"404"') || status === 404) return '🔍 MODEL_NOT_FOUND'
    if (msg.includes('RESOURCE_EXHAUSTED') || status === 429) return '🚦 RATE_LIMITED'
    if (status === 500 || status === 503 || msg.includes('overloaded')) return '🔥 SERVER_ERROR'
    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT')) return '🌐 NETWORK_ERROR'
    if (status === 401 || status === 403) return '🔑 AUTH_ERROR'
    return '❓ UNKNOWN'
  }

  /** True only for transient errors that are worth retrying */
  #isRetryable(err) {
    const msg = err.message ?? ''
    const status = err.status ?? err.response?.status

    // Never retry permanent errors
    if (msg.includes('not found') || msg.includes('is not supported') || msg.includes('"code":"404"') || status === 404) return false
    if (msg.includes('insufficient_quota') || msg.includes('quota failed')) return false
    if (status === 401 || status === 403) return false

    // Retry transient errors
    return (
      status === 429 ||
      status === 500 ||
      status === 503 ||
      msg.includes('RESOURCE_EXHAUSTED') ||
      msg.includes('overloaded')
    )
  }

  async #callWithRetry(fn, maxAttempts, retryDelay) {
    let lastError
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const t0 = Date.now()
      try {
        return await fn()
      } catch (err) {
        lastError = err
        const elapsed = Date.now() - t0
        const category = this.#classifyError(err)

        if (!this.#isRetryable(err) || attempt === maxAttempts) {
          logger.error(
            `[LLM] ${category}  attempt=${attempt}/${maxAttempts}  elapsed=${elapsed}ms  → giving up`,
            { error: err.message }
          )
          throw err
        }

        logger.warn(
          `[LLM] ${category}  attempt=${attempt}/${maxAttempts}  elapsed=${elapsed}ms  → retry in ${retryDelay}ms`,
          { error: err.message }
        )
        await new Promise((r) => setTimeout(r, retryDelay))
      }
    }
    throw lastError
  }
}

export default new LLMService()
