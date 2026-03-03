import logger from '../utils/logger.js'

export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500
  const message = err.message || 'Internal Server Error'

  logger.error(`${req.method} ${req.path} → ${status}`, { error: message, stack: err.stack })

  res.status(status).json({
    success: false,
    data: null,
    error: message,
  })
}

export function notFound(req, res) {
  res.status(404).json({
    success: false,
    data: null,
    error: `Route ${req.method} ${req.path} not found`,
  })
}
