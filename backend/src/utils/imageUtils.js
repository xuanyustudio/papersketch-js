import sharp from 'sharp'

/**
 * Convert PNG base64 string to JPEG base64 string
 * @param {string} pngBase64 - Base64 encoded PNG (with or without data URI prefix)
 * @returns {Promise<string|null>} Base64 encoded JPEG without data URI prefix
 */
export async function convertPngBase64ToJpgBase64(pngBase64) {
  try {
    const base64Data = pngBase64.includes(',') ? pngBase64.split(',')[1] : pngBase64
    const pngBuffer = Buffer.from(base64Data, 'base64')
    const jpgBuffer = await sharp(pngBuffer)
      .jpeg({ quality: 95 })
      .toBuffer()
    return jpgBuffer.toString('base64')
  } catch (err) {
    return null
  }
}

/**
 * Resize an image buffer to fit within maxDimension while preserving aspect ratio
 * @param {Buffer} imageBuffer
 * @param {number} maxDimension
 * @returns {Promise<Buffer>}
 */
export async function resizeImage(imageBuffer, maxDimension = 2048) {
  return sharp(imageBuffer)
    .resize(maxDimension, maxDimension, { fit: 'inside', withoutEnlargement: true })
    .toBuffer()
}

/**
 * Get image dimensions from buffer
 * @param {Buffer} imageBuffer
 * @returns {Promise<{width: number, height: number}>}
 */
export async function getImageDimensions(imageBuffer) {
  const meta = await sharp(imageBuffer).metadata()
  return { width: meta.width, height: meta.height }
}

/**
 * Strip the data URI prefix from a base64 string
 * @param {string} base64
 * @returns {string}
 */
export function stripDataUri(base64) {
  return base64.includes(',') ? base64.split(',')[1] : base64
}

/**
 * Map aspect ratio string to Gemini's format
 * @param {string} ratio - e.g. "16:9", "21:9", "3:2", "1:1"
 * @returns {string}
 */
export function normalizeAspectRatio(ratio) {
  const valid = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9']
  return valid.includes(ratio) ? ratio : '16:9'
}
