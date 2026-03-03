import rateLimit from 'express-rate-limit'
import config from '../config/index.js'

export const apiRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  // Skip lightweight / read-only endpoints that don't need throttling
  skip: (req) => {
    const p = req.path
    return p === '/health' || p.startsWith('/models') || p.startsWith('/history')
  },
  message: {
    success: false,
    data: null,
    error: 'Too many requests, please try again later.',
  },
})
