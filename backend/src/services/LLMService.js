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
      // 中转站支持：替换 Gemini API 的 base URL，并指定 API 版本
      geminiOpts.httpOptions = {
        ...(config.geminiBaseUrl ? { baseUrl: config.geminiBaseUrl } : {}),
        apiVersion: config.geminiApiVersion,
      }
      this.gemini = new GoogleGenAI(geminiOpts)
      logger.info(`Gemini initialized via ${config.geminiBaseUrl || 'Google official API'}  apiVersion=${config.geminiApiVersion}`)

      // 中转站通常也兼容 OpenAI /chat/completions 格式，供非 Gemini 模型（如 DeepSeek）使用
      // baseURL 取中转站地址 + /v1；API key 与 Gemini 共用
      const relayBase = config.geminiBaseUrl
        ? `${config.geminiBaseUrl.replace(/\/$/, '')}/v1`
        : 'https://api.openai.com/v1'
      this.relay = new OpenAI({ apiKey: config.googleApiKey, baseURL: relayBase })
      logger.info(`Relay (OpenAI-compat) initialized via ${relayBase}`)
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
    // Route: Gemini models → GoogleGenAI SDK; everything else → OpenAI-compat relay
    const isGemini = this.#isGeminiModel(model)
    const fn = isGemini
      ? () => this.#callGeminiText({ model, systemPrompt, contents, genConfig, inputLen, imgCount })
      : () => this.#callRelayText({ model, systemPrompt, contents, inputLen, imgCount })
    const result = await this.#callWithRetry(fn, config.textMaxRetryAttempts, config.retryDelayMs)
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
  async generateImage({ model, systemPrompt, contents, aspectRatio = '16:9', imageSize = '1k', referenceImageBase64 = null }) {
    logger.info(`[LLM] generateImage  model=${model}  aspectRatio=${aspectRatio}`)
    const t0 = Date.now()

    let result
    if (model.includes('gpt-image')) {
      const fn = () => this.#callOpenAIImage({ model, contents })
      result = await this.#callWithRetry(fn, config.maxRetryAttempts, 30000)
    } else if (model.startsWith('doubao-') && model.includes('i2i')) {
      const fn = () => this.#callDoubaoI2IImage({ model, contents, referenceImageBase64 })
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

  // ─── Private: model routing ───────────────────────────────

  /** Gemini 模型名以 "gemini-" 开头（或 "models/gemini-"） */
  #isGeminiModel(model) {
    return model.startsWith('gemini-') || model.startsWith('models/gemini-')
  }

  // ─── Private: OpenAI-compat relay text (DeepSeek / Claude / etc.) ─

  async #callRelayText({ model, systemPrompt, contents, inputLen = 0, imgCount = 0 }) {
    if (!this.relay) throw new Error('Relay not initialized (GOOGLE_API_KEY / GEMINI_BASE_URL not set)')

    const relayUrl = `${this.relay.baseURL}/chat/completions`
    logger.info(`[LLM] → POST ${relayUrl}  model=${model}`)

    const messages = []
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })

    // Build user message; image parts are passed as vision content blocks if supported
    const userContent = contents.map((c) => {
      if (c.type === 'text') return { type: 'text', text: c.text }
      if (c.type === 'image') {
        return {
          type: 'image_url',
          image_url: { url: `data:${c.mimeType || 'image/jpeg'};base64,${c.imageBase64}` },
        }
      }
      return { type: 'text', text: '' }
    })
    // If only text parts, simplify to string
    messages.push({
      role: 'user',
      content: userContent.every((p) => p.type === 'text')
        ? userContent.map((p) => p.text).join('')
        : userContent,
    })

    const textTimeoutMs = this.#computeTextTimeoutMs(inputLen, imgCount)
    const timeoutSec = Math.round(textTimeoutMs / 1000)
    logger.info(`[LLM] generateText  timeout=${timeoutSec}s  dynamic=${config.textTimeoutDynamicEnabled ? 'on' : 'off'}`)

    const apiCall = this.relay.chat.completions.create({
      model,
      messages,
      temperature: config.temperature,
      max_tokens: config.maxOutputTokens,
    })

    const response = await this.#withTimeout(apiCall, textTimeoutMs, `Text generation timeout (${timeoutSec}s)`)
    return response.choices?.[0]?.message?.content ?? ''
  }

  // ─── Private: Gemini text ──────────────────────────────────

  async #callGeminiText({ model, systemPrompt, contents, genConfig, inputLen = 0, imgCount = 0 }) {
    if (!this.gemini) throw new Error('Google API key not configured')

    const base = (config.geminiBaseUrl || 'https://generativelanguage.googleapis.com').replace(/\/$/, '')
    logger.info(`[LLM] → POST ${base}/${config.geminiApiVersion}/models/${model}:generateContent`)
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

    const textTimeoutMs = this.#computeTextTimeoutMs(inputLen, imgCount)
    const timeoutSec = Math.round(textTimeoutMs / 1000)
    logger.info(`[LLM] generateText  timeout=${timeoutSec}s  dynamic=${config.textTimeoutDynamicEnabled ? 'on' : 'off'}`)
    const response = await this.#withTimeout(apiCall, textTimeoutMs, `Text generation timeout (${timeoutSec}s)`)
    return response.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  }

  // ─── Private: Gemini image generation ─────────────────────

  async #callGeminiImage({ model, systemPrompt, contents, aspectRatio, imageSize }) {
    if (!this.gemini) throw new Error('Google API key not configured')

    const base = (config.geminiBaseUrl || 'https://generativelanguage.googleapis.com').replace(/\/$/, '')
    logger.info(`[LLM] → POST ${base}/${config.geminiApiVersion}/models/${model}:generateContent  (image)`)

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
      const imageTimeoutMs = Math.max(config.imageTimeoutMs || 180000, 1000)
      const timeoutSec = Math.round(imageTimeoutMs / 1000)
      response = await this.#withTimeout(apiCall, imageTimeoutMs, `Image generation timeout (${timeoutSec}s)`)
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

    const falBase = config.falBaseUrl || 'https://fal.run'
    logger.info(`[LLM] → fal.ai subscribe  endpoint=${falBase}  model=${model}`)

    const textPart = contents.find((c) => c.type === 'text')
    const prompt = textPart?.text ?? ''
    const imageSize = this.#falImageSize(aspectRatio)

    const startTs = Date.now()
    const heartbeat = setInterval(() => {
      logger.info(`[LLM] fal.ai waiting...  elapsed=${Math.round((Date.now() - startTs) / 1000)}s`)
    }, 30000)

    let imageUrl
    try {
      const imageTimeoutMs = Math.max(config.imageTimeoutMs || 180000, 1000)
      const timeoutSec = Math.round(imageTimeoutMs / 1000)
      const result = await this.#withTimeout(
        fal.subscribe(model, {
          input: { prompt, image_size: imageSize, num_images: 1 },
        }),
        imageTimeoutMs,
        `fal.ai image generation timeout (${timeoutSec}s)`,
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

  #computeTextTimeoutMs(inputLen, imgCount) {
    const base = Math.max(config.textTimeoutMs || 120000, 1000)
    if (!config.textTimeoutDynamicEnabled) return base

    const baseChars = Math.max(config.textTimeoutBaseChars || 3000, 1)
    const addPerChars = Math.max(config.textTimeoutAddPerChars || 1000, 1)
    const addMs = Math.max(config.textTimeoutAddMs || 10000, 0)
    const perImageMs = Math.max(config.textTimeoutPerImageMs || 15000, 0)
    const maxMs = Math.max(config.textTimeoutMaxMs || 240000, base)

    const extraChars = Math.max((inputLen || 0) - baseChars, 0)
    const charBuckets = Math.ceil(extraChars / addPerChars)
    const dynamicMs = base + charBuckets * addMs + Math.max(imgCount || 0, 0) * perImageMs
    return Math.min(dynamicMs, maxMs)
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

    const doubaoBase = config.doubaoBaseUrl.replace(/\/$/, '').replace(/\/v1$/, '')
    logger.info(`[LLM] → POST ${doubaoBase}/v1/images/generations  model=${model}`)

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

  // ─── Private: Doubao image-to-image editing ───────────────

  async #callDoubaoI2IImage({ model, contents, referenceImageBase64 }) {
    if (!this.doubao) throw new Error('Doubao API key not configured')
    if (!config.doubaoBaseUrl) throw new Error('Doubao base URL not configured (set DOUBAO_BASE_URL)')

    // Resolve reference image: prefer explicit param, then fall back to any image in contents
    const imgBase64 = referenceImageBase64
      || contents.find((c) => c.type === 'image')?.imageBase64
      || null

    if (!imgBase64) {
      // No input image available — i2i is not usable for initial generation; skip gracefully
      logger.warn(`[LLM] Doubao i2i model "${model}" has no reference image (initial generation). Skipping — use a t2i model for first-round generation.`)
      return null
    }

    const textPart = contents.find((c) => c.type === 'text')
    const prompt = textPart?.text ?? ''

    // Strip trailing /v1 if already present in base URL to avoid /v1/v1/... duplication
    const doubaoBase = config.doubaoBaseUrl.replace(/\/$/, '').replace(/\/v1$/, '')
    logger.info(`[LLM] → POST ${doubaoBase}/v1/images/generations  model=${model}  (i2i)`)

    const response = await fetch(`${doubaoBase}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.doubaoApiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        image: `data:image/jpeg;base64,${imgBase64}`,
        response_format: 'b64_json',
        size: '1k',
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Doubao i2i API error: HTTP ${response.status} - ${errText}`)
    }

    const json = await response.json()
    const b64 = json?.data?.[0]?.b64_json
    if (b64) return b64

    const imageUrl = json?.data?.[0]?.url ?? null
    if (imageUrl) {
      const imgRes = await fetch(imageUrl)
      if (!imgRes.ok) throw new Error(`Failed to download Doubao i2i image: HTTP ${imgRes.status}`)
      const buf = Buffer.from(await imgRes.arrayBuffer())
      return buf.toString('base64')
    }

    const preview = JSON.stringify(json)?.slice(0, 300)
    throw new Error(`Doubao i2i response has no image. Raw: ${preview}`)
  }

  // ─── Private: retry helper ─────────────────────────────────

  /** Categorise an error for clearer log messages */
  #classifyError(err) {
    const raw = err.message ?? ''
    // Unwrap JSON error bodies from relay/proxy responses
    const msg = this.#unwrapErrMsg(raw)
    const status = err.status ?? err.response?.status

    if (msg.includes('timeout') || msg.includes('Timeout')) return '⏱ TIMEOUT'
    if (msg.includes('insufficient_quota') || msg.includes('quota failed')) return '💰 QUOTA_EXCEEDED'
    if (msg.includes('not found') || msg.includes('is not supported') || msg.includes('"code":"404"') || status === 404) return '🔍 MODEL_NOT_FOUND'
    if (msg.includes('RESOURCE_EXHAUSTED') || status === 429) return '🚦 RATE_LIMITED'
    if (status === 500 || status === 503 || msg.includes('overloaded')) return '🔥 SERVER_ERROR'
    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT')) return '🌐 NETWORK_ERROR'
    if (status === 401 || status === 403) return '🔑 AUTH_ERROR'
    // shell_api_error / empty message from relay — treat as transient server error
    if (raw.includes('shell_api_error') || raw.trim() === '' || msg.trim() === '') return '🔥 SERVER_ERROR'
    return '❓ UNKNOWN'
  }

  /** Unwrap the inner `message` string from a stringified JSON error body */
  #unwrapErrMsg(raw) {
    try {
      const outer = JSON.parse(raw)
      // e.g. {"error":{"message":"...", "type":"..."}}
      return outer?.error?.message ?? outer?.message ?? raw
    } catch {
      return raw
    }
  }

  /** True only for transient errors that are worth retrying */
  #isRetryable(err) {
    const raw = err.message ?? ''
    const msg = this.#unwrapErrMsg(raw)
    const status = err.status ?? err.response?.status

    // Never retry permanent errors
    if (msg.includes('not found') || msg.includes('is not supported') || msg.includes('"code":"404"') || status === 404) return false
    if (msg.includes('insufficient_quota') || msg.includes('quota failed')) return false
    if (status === 401 || status === 403) return false

    // shell_api_error with blank message = relay hiccup → retry
    if (raw.includes('shell_api_error') || raw.trim() === '' || msg.trim() === '') return true

    // Retry transient errors (including timeout)
    return (
      msg.toLowerCase().includes('timeout') ||
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
