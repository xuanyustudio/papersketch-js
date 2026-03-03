// Uses Node.js built-in SQLite (requires Node >= 22.5, flag --experimental-sqlite)
import { DatabaseSync } from 'node:sqlite'
import { resolve, dirname } from 'path'
import { mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import logger from '../utils/logger.js'
import { persistResultImages, deleteJobImages } from '../utils/imageStore.js'


const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_DIR = resolve(__dirname, '../../../data')
const DB_PATH = resolve(DB_DIR, 'history.db')

mkdirSync(DB_DIR, { recursive: true })

const db = new DatabaseSync(DB_PATH)

// ─── Schema ───────────────────────────────────────────────────

db.exec(`PRAGMA journal_mode = WAL`)
db.exec(`PRAGMA foreign_keys = ON`)

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id            TEXT PRIMARY KEY,
    created_at    INTEGER NOT NULL,
    completed_at  INTEGER,
    status        TEXT NOT NULL DEFAULT 'running',
    exp_mode      TEXT,
    task_name     TEXT DEFAULT 'diagram',
    retrieval_setting TEXT,
    num_candidates INTEGER,
    aspect_ratio  TEXT,
    model_name    TEXT,
    method_content TEXT,
    caption       TEXT,
    total_time_ms INTEGER
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS candidates (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id        TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    candidate_idx INTEGER NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending',
    result_json   TEXT,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )
`)

db.exec(`CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at DESC)`)
db.exec(`CREATE INDEX IF NOT EXISTS idx_candidates_job ON candidates(job_id)`)

// ─── Schema migrations (idempotent) ──────────────────────────
// Add checkpoint columns if they don't exist (ALTER TABLE IF NOT EXISTS is not
// supported in SQLite, so we swallow the "duplicate column" error).
for (const col of ['checkpoint_stage TEXT', 'checkpoint_data TEXT']) {
  try { db.exec(`ALTER TABLE candidates ADD COLUMN ${col}`) } catch { /* already exists */ }
}
// Add max_critic_rounds to jobs table for resume
try { db.exec(`ALTER TABLE jobs ADD COLUMN max_critic_rounds INTEGER DEFAULT 3`) } catch { /* already exists */ }

logger.info(`SQLite (node:sqlite) history DB ready at ${DB_PATH}`)

// ─── Helpers ──────────────────────────────────────────────────

function candidateExists(jobId, candidateIdx) {
  const row = db.prepare(
    'SELECT id FROM candidates WHERE job_id = ? AND candidate_idx = ?'
  ).get(jobId, candidateIdx)
  return !!row
}

// ─── Public API ───────────────────────────────────────────────

export const historyService = {
  createJob({ jobId, expMode, taskName, retrievalSetting, numCandidates,
    aspectRatio, modelName, methodContent, caption, maxCriticRounds }) {
    db.prepare(`
      INSERT OR IGNORE INTO jobs
        (id, created_at, status, exp_mode, task_name, retrieval_setting,
         num_candidates, aspect_ratio, model_name, method_content, caption, max_critic_rounds)
      VALUES (?, ?, 'running', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      jobId, Date.now(), expMode, taskName, retrievalSetting,
      numCandidates, aspectRatio, modelName || null,
      (methodContent || '').slice(0, 5000),
      (caption || '').slice(0, 1000),
      maxCriticRounds ?? 3
    )
  },

  saveCandidateResult(jobId, candidateIdx, result, taskName = 'diagram') {
    const leanResult = persistResultImages(jobId, candidateIdx, result, taskName)
    const json = JSON.stringify(leanResult)

    if (candidateExists(jobId, candidateIdx)) {
      db.prepare(`
        UPDATE candidates SET status = 'completed', result_json = ?
        WHERE job_id = ? AND candidate_idx = ?
      `).run(json, jobId, candidateIdx)
    } else {
      db.prepare(`
        INSERT INTO candidates (job_id, candidate_idx, status, result_json, created_at)
        VALUES (?, ?, 'completed', ?, ?)
      `).run(jobId, candidateIdx, json, Date.now())
    }
  },

  saveCandidateError(jobId, candidateIdx, errorMsg) {
    const json = JSON.stringify({ error: errorMsg })

    if (candidateExists(jobId, candidateIdx)) {
      db.prepare(`
        UPDATE candidates SET status = 'error', result_json = ?
        WHERE job_id = ? AND candidate_idx = ?
      `).run(json, jobId, candidateIdx)
    } else {
      db.prepare(`
        INSERT INTO candidates (job_id, candidate_idx, status, result_json, created_at)
        VALUES (?, ?, 'error', ?, ?)
      `).run(jobId, candidateIdx, json, Date.now())
    }
  },

  completeJob(jobId, totalTimeMs) {
    db.prepare(`
      UPDATE jobs SET status = 'completed', completed_at = ?, total_time_ms = ?
      WHERE id = ?
    `).run(Date.now(), totalTimeMs, jobId)
  },

  listJobs({ page = 1, pageSize = 20 } = {}) {
    const offset = (page - 1) * pageSize
    const jobs = db.prepare(`
      SELECT j.*,
        COUNT(c.id) AS total_candidates,
        SUM(CASE WHEN c.status = 'completed' THEN 1 ELSE 0 END) AS completed_candidates,
        SUM(CASE WHEN c.status = 'error' THEN 1 ELSE 0 END) AS failed_candidates
      FROM jobs j
      LEFT JOIN candidates c ON c.job_id = j.id
      GROUP BY j.id
      ORDER BY j.created_at DESC
      LIMIT ? OFFSET ?
    `).all(pageSize, offset)

    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM jobs`).get()
    return { jobs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  },

  getJobDetail(jobId) {
    const job = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(jobId)
    if (!job) return null

    const rawCandidates = db.prepare(
      `SELECT * FROM candidates WHERE job_id = ? ORDER BY candidate_idx ASC`
    ).all(jobId)

    const candidates = rawCandidates.map((c) => {
      if (!c.result_json) return { ...c, result: null, result_json: undefined }

      let result
      try { result = JSON.parse(c.result_json) } catch { result = null }

      // Lazy repair: if any base64 images are still in the result (disk save
      // failed earlier), try to save them now and update the DB record.
      if (result) {
        const base64Keys = Object.keys(result).filter((k) => k.endsWith('_base64_jpg'))
        if (base64Keys.length > 0) {
          const lean = persistResultImages(jobId, c.candidate_idx, result, job.task_name || 'diagram')
          // Persist repaired lean result back to DB
          try {
            db.prepare(
              `UPDATE candidates SET result_json = ? WHERE job_id = ? AND candidate_idx = ?`
            ).run(JSON.stringify(lean), jobId, c.candidate_idx)
            result = lean
            logger.info(`Lazy-repaired images for job ${jobId} candidate ${c.candidate_idx}`)
          } catch (e) {
            logger.warn(`Lazy repair DB update failed: ${e.message}`)
          }
        }
      }

      return { ...c, result, result_json: undefined }
    })

    return { ...job, candidates }
  },

  deleteJob(jobId) {
    db.prepare(`DELETE FROM jobs WHERE id = ?`).run(jobId)
    deleteJobImages(jobId)
  },

  // ─── Checkpoint API ────────────────────────────────────────

  /**
   * Save an intermediate pipeline checkpoint for a candidate.
   * `snapData` should be a lean object (no base64, only _image_url keys).
   */
  saveCheckpoint(jobId, candidateIdx, stage, snapData) {
    const json = JSON.stringify(snapData)
    if (candidateExists(jobId, candidateIdx)) {
      db.prepare(`
        UPDATE candidates SET checkpoint_stage = ?, checkpoint_data = ?
        WHERE job_id = ? AND candidate_idx = ?
      `).run(stage, json, jobId, candidateIdx)
    } else {
      db.prepare(`
        INSERT INTO candidates (job_id, candidate_idx, status, checkpoint_stage, checkpoint_data, created_at)
        VALUES (?, ?, 'running', ?, ?, ?)
      `).run(jobId, candidateIdx, stage, json, Date.now())
    }
  },

  /** Load the latest checkpoint for a candidate, or null if none. */
  getCheckpoint(jobId, candidateIdx) {
    const row = db.prepare(
      `SELECT checkpoint_stage, checkpoint_data FROM candidates
       WHERE job_id = ? AND candidate_idx = ?`
    ).get(jobId, candidateIdx)
    if (!row?.checkpoint_data) return null
    try {
      return { stage: row.checkpoint_stage, data: JSON.parse(row.checkpoint_data) }
    } catch { return null }
  },

  /**
   * Return all jobs that were still 'running' when the server last shut down,
   * along with per-candidate checkpoint info.
   */
  getInterruptedJobs() {
    const runningJobs = db.prepare(
      `SELECT * FROM jobs WHERE status = 'running'`
    ).all()

    return runningJobs.map((job) => {
      const candidates = db.prepare(
        `SELECT candidate_idx, status, checkpoint_stage, checkpoint_data
         FROM candidates WHERE job_id = ? ORDER BY candidate_idx ASC`
      ).all(job.id).map((c) => ({
        candidateIdx: c.candidate_idx,
        status: c.status,
        checkpointStage: c.checkpoint_stage,
        checkpointData: c.checkpoint_data ? (() => { try { return JSON.parse(c.checkpoint_data) } catch { return null } })() : null,
      }))

      return { ...job, savedCandidates: candidates }
    })
  },
}

export default historyService
