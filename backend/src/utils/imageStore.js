import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import logger from './logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const IMAGES_ROOT = resolve(__dirname, '../../../data/images')

// Stage name map for readable filenames
// critic_desc{n} → critic_r{n+1} so the filename matches the UI label (Critic R1, R2, R3...)
const STAGE_FILENAME = {
  desc0: 'planner',
  stylist_desc0: 'stylist',
  critic_desc0: 'critic_r1',
  critic_desc1: 'critic_r2',
  critic_desc2: 'critic_r3',
  critic_desc3: 'critic_r4',
  vanilla: 'vanilla',
}

/**
 * Save a base64 image to disk.
 * @param {string} jobId
 * @param {number} candidateIdx
 * @param {string} stageKey  - e.g. "desc0", "stylist_desc0", "critic_desc0"
 * @param {string} base64    - raw base64 string (no data URI prefix)
 * @param {string} taskName  - "diagram" | "plot"
 * @returns {string} relative URL path, e.g. "/images/jobId/candidate_0/planner.jpg"
 */
export function saveImage(jobId, candidateIdx, stageKey, base64, taskName = 'diagram') {
  try {
    const dir = resolve(IMAGES_ROOT, jobId, `candidate_${candidateIdx}`)
    mkdirSync(dir, { recursive: true })

    const filename = `${STAGE_FILENAME[stageKey] || stageKey}.jpg`
    const filePath = resolve(dir, filename)

    const buffer = Buffer.from(base64, 'base64')
    writeFileSync(filePath, buffer)

    return `/images/${jobId}/candidate_${candidateIdx}/${filename}`
  } catch (err) {
    logger.error(`imageStore.saveImage failed — image will be kept in DB as base64 fallback`, {
      error: err.message,
      jobId,
      candidateIdx,
      stageKey,
    })
    return null
  }
}

/**
 * Extract all base64 image keys from a candidate result,
 * save each to disk, and return a "lean" result with _image_url keys.
 *
 * Original key:   target_diagram_desc0_base64_jpg
 * Replaced with:  target_diagram_desc0_image_url = "/images/..."
 *
 * Also back-fills _steps[].output.image_url with the resolved URLs so that
 * the history step log can display clickable thumbnails.
 */
export function persistResultImages(jobId, candidateIdx, result, taskName = 'diagram') {
  if (!result) return result

  const lean = { ...result }

  // Find all keys ending in _base64_jpg
  const base64Keys = Object.keys(lean).filter((k) => k.endsWith('_base64_jpg'))

  for (const key of base64Keys) {
    const base64 = lean[key]
    if (!base64 || base64.length < 100) continue

    // Extract stage key: target_diagram_<stageKey>_base64_jpg → <stageKey>
    // Use [^_]+ (not \w+) so the task name part doesn't greedily consume underscores
    const match = key.match(/^target_[^_]+_(.+)_base64_jpg$/)
    const stageKey = match ? match[1] : key

    const url = saveImage(jobId, candidateIdx, stageKey, base64, taskName)
    if (url) {
      const urlKey = key.replace('_base64_jpg', '_image_url')
      lean[urlKey] = url
      // Only strip base64 from DB when the file was successfully saved
      delete lean[key]
    }
    // If saveImage failed, keep base64 in lean as emergency fallback so the
    // image is never silently lost. The record will be larger but still usable.
  }

  // Back-fill _steps[].output.image_url using the now-resolved _image_url keys.
  // During pipeline execution steps are recorded before images are saved to disk,
  // so image_url is null at capture time but the URLs are available after this function runs.
  lean._steps = repairStepsImageUrls(lean._steps, lean, taskName)

  return lean
}

/**
 * Back-fill image_url inside each _steps entry using the top-level _image_url keys
 * that were resolved by persistResultImages.
 */
function repairStepsImageUrls(steps, leanResult, taskName) {
  if (!Array.isArray(steps) || !steps.length) return steps
  const t = taskName || 'diagram'

  return steps.map((s) => {
    if (s.output?.type === 'image' && !s.output.image_url) {
      const round = s.output.round ?? 0
      let imageUrl = null
      if (round === 0) {
        imageUrl = leanResult[`target_${t}_stylist_desc0_image_url`]
          || leanResult[`target_${t}_desc0_image_url`]
          || null
      } else {
        const criticRound = round - 1
        imageUrl = leanResult[`target_${t}_critic_desc${criticRound}_image_url`] || null
      }
      if (imageUrl) {
        return {
          ...s,
          output: { ...s.output, image_url: imageUrl, image_in_memory_only: false },
        }
      }
    }

    // Vanilla step: the output type is 'text' but may carry an image_url
    if (s.output?.type === 'text' && s.name === 'Vanilla' && !s.output.image_url) {
      const imageUrl = leanResult[`target_${t}_vanilla_image_url`] || null
      if (imageUrl) {
        return {
          ...s,
          output: { ...s.output, image_url: imageUrl, has_image: true, image_in_memory_only: false },
        }
      }
    }

    return s
  })
}

/**
 * Create a lean snapshot of the data object for checkpoint storage:
 * - Saves any base64 images to disk (same as persistResultImages)
 * - Returns a copy with _image_url keys instead of _base64_jpg
 * - Does NOT mutate the original `data` object (unlike persistResultImages)
 */
export function createCheckpointSnapshot(jobId, candidateIdx, data, taskName = 'diagram') {
  if (!data) return data

  const snap = { ...data }
  const base64Keys = Object.keys(snap).filter((k) => k.endsWith('_base64_jpg'))

  for (const key of base64Keys) {
    const base64 = snap[key]
    if (!base64 || base64.length < 100) {
      delete snap[key]
      continue
    }

    const match = key.match(/^target_[^_]+_(.+)_base64_jpg$/)
    const stageKey = match ? match[1] : key

    // Only save if not already on disk (check for existing URL key)
    const urlKey = key.replace('_base64_jpg', '_image_url')
    if (!snap[urlKey]) {
      const url = saveImage(jobId, candidateIdx, stageKey, base64, taskName)
      if (url) snap[urlKey] = url
    }

    delete snap[key]
  }

  return snap
}

/**
 * Rehydrate a data object: for each _image_url key, load the file from disk
 * and restore the _base64_jpg key in memory. Used before Critic steps when
 * resuming from a checkpoint.
 */
export function rehydrateImages(data) {
  if (!data) return data
  const result = { ...data }
  const urlKeys = Object.keys(result).filter((k) => k.endsWith('_image_url'))

  for (const urlKey of urlKeys) {
    const url = result[urlKey]
    const base64Key = urlKey.replace('_image_url', '_base64_jpg')
    if (result[base64Key]) continue  // already in memory

    try {
      // url is like "/images/{jobId}/candidate_0/planner.jpg"
      const filePath = resolve(IMAGES_ROOT, url.replace(/^\/images\//, ''))
      const buffer = readFileSync(filePath)
      result[base64Key] = buffer.toString('base64')
    } catch {
      // File missing – critic will fall back to text-only mode
    }
  }

  return result
}

/**
 * Delete all images for a job (called on history delete).
 * @param {string} jobId
 */
export function deleteJobImages(jobId) {
  const dir = resolve(IMAGES_ROOT, jobId)
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true })
    logger.info(`Deleted image dir for job ${jobId}`)
  }
}
