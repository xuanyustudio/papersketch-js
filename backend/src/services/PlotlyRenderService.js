import puppeteer from 'puppeteer'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import logger from '../utils/logger.js'

const require = createRequire(import.meta.url)
const plotlyBundlePath = require.resolve('plotly.js-dist-min')
const plotlyBundle = readFileSync(plotlyBundlePath, 'utf8')

let browserPromise = null

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
  }
  return browserPromise
}

/**
 * Render Plotly spec to PNG data URI in backend (headless browser).
 * @param {object} spec Plotly figure spec: { data, layout?, config? }
 * @param {object} opts
 * @param {number} [opts.width=1200]
 * @param {number} [opts.height=750]
 * @param {number} [opts.scale=3]
 * @returns {Promise<string|null>} data:image/png;base64,... or null
 */
export async function renderPlotlySpecToDataUrl(spec, opts = {}) {
  if (!spec || typeof spec !== 'object') return null
  const width = opts.width || 1200
  const height = opts.height || 750
  const scale = opts.scale || 3

  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setViewport({ width, height, deviceScaleFactor: 1 })
    await page.setContent(
      `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            html, body { margin: 0; padding: 0; background: #fff; }
            #plot { width: ${width}px; height: ${height}px; }
          </style>
        </head>
        <body>
          <div id="plot"></div>
          <script>${plotlyBundle}</script>
        </body>
      </html>`,
      { waitUntil: 'load' },
    )

    await page.evaluate(async (inputSpec) => {
      const gd = document.getElementById('plot')
      const data = Array.isArray(inputSpec?.data) ? inputSpec.data : []
      const layout = { paper_bgcolor: '#ffffff', plot_bgcolor: '#ffffff', ...(inputSpec?.layout || {}) }
      const config = { displayModeBar: false, responsive: false, ...(inputSpec?.config || {}) }
      await window.Plotly.newPlot(gd, data, layout, config)
    }, spec)

    const dataUrl = await page.evaluate(
      async ({ width: w, height: h, scale: s }) => {
        const gd = document.getElementById('plot')
        return window.Plotly.toImage(gd, { format: 'png', width: w, height: h, scale: s })
      },
      { width, height, scale },
    )
    return dataUrl || null
  } catch (err) {
    logger.error('[PlotlyRender] Failed to render spec', { error: err.message })
    return null
  } finally {
    await page.close().catch(() => {})
  }
}

export async function renderPlotlySpecToBase64(spec, opts = {}) {
  const dataUrl = await renderPlotlySpecToDataUrl(spec, opts)
  if (!dataUrl) return null
  return dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
}

