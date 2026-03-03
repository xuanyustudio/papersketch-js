import 'dotenv/config'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import yaml from 'js-yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = resolve(__dirname, '../../../..')

function loadYamlConfig() {
  const yamlPath = resolve(ROOT_DIR, 'PaperBanana-main', 'configs', 'model_config.yaml')
  if (existsSync(yamlPath)) {
    try {
      return yaml.load(readFileSync(yamlPath, 'utf8')) || {}
    } catch {
      return {}
    }
  }
  return {}
}

const yamlConfig = loadYamlConfig()

function getVal(envKey, yamlPath, defaultVal = '') {
  const envVal = process.env[envKey]
  if (envVal) return envVal
  const parts = yamlPath.split('.')
  let cur = yamlConfig
  for (const p of parts) {
    cur = cur?.[p]
    if (cur == null) return defaultVal
  }
  return cur || defaultVal
}

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',

  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  googleApiKey: getVal('GOOGLE_API_KEY', 'api_keys.google_api_key'),
  openaiApiKey: getVal('OPENAI_API_KEY', 'api_keys.openai_api_key'),
  geminiBaseUrl: process.env.GEMINI_BASE_URL || '',
  geminiApiVersion: 'v1',

  falApiKey: process.env.FAL_API_KEY || '',
  falBaseUrl: process.env.FAL_BASE_URL || 'https://fal.run',
  doubaoApiKey: process.env.DOUBAO_API_KEY || '',
  doubaoBaseUrl: process.env.DOUBAO_BASE_URL || '',

  defaultModelName: getVal('DEFAULT_MODEL_NAME', 'defaults.model_name'),
  defaultImageModelName: getVal('DEFAULT_IMAGE_MODEL_NAME', 'defaults.image_model_name'),

  dataDir: process.env.DATA_DIR || '',
  styleGuidesDir: process.env.STYLE_GUIDES_DIR || resolve(ROOT_DIR, 'PaperBanana-main', 'style_guides'),

  maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || '10', 10),

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '20', 10),
  },

  logLevel: process.env.LOG_LEVEL || 'info',

  temperature: 1.0,
  maxOutputTokens: 50000,
  maxRetryAttempts: 5,
  retryDelayMs: 5000,
  textTimeoutMs: parseInt(process.env.TEXT_TIMEOUT_MS || '120000', 10),
  imageTimeoutMs: parseInt(process.env.IMAGE_TIMEOUT_MS || '180000', 10),
  textMaxRetryAttempts: parseInt(process.env.TEXT_MAX_RETRY_ATTEMPTS || '2', 10),
  textTimeoutDynamicEnabled: process.env.TEXT_TIMEOUT_DYNAMIC_ENABLED !== 'false',
  textTimeoutBaseChars: parseInt(process.env.TEXT_TIMEOUT_BASE_CHARS || '3000', 10),
  textTimeoutAddPerChars: parseInt(process.env.TEXT_TIMEOUT_ADD_PER_CHARS || '1000', 10),
  textTimeoutAddMs: parseInt(process.env.TEXT_TIMEOUT_ADD_MS || '10000', 10),
  textTimeoutMaxMs: parseInt(process.env.TEXT_TIMEOUT_MAX_MS || '240000', 10),
  textTimeoutPerImageMs: parseInt(process.env.TEXT_TIMEOUT_PER_IMAGE_MS || '15000', 10),
}

export default config
