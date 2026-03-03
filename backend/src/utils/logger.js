import { createLogger, format, transports } from 'winston'
import config from '../config/index.js'

const { combine, timestamp, colorize, printf, errors } = format

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
    return `${timestamp} [${level}] ${stack || message}${metaStr}`
  })
)

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  format.json()
)

const logger = createLogger({
  level: config.logLevel,
  format: config.isProd ? prodFormat : devFormat,
  transports: [new transports.Console()],
})

export default logger
