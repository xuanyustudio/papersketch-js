import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { ElMessage } from 'element-plus'
import api from '@/api/index.js'
import { normalizeExpMode } from '@/constants/expModes.js'
import { useAuthStore } from './authStore.js'

export const useGenerateStore = defineStore('generate', () => {
  // ─── State ─────────────────────────────────────────────────
  const jobId = ref(null)
  const isGenerating = ref(false)
  const candidates = ref([])     // { id, status, progress, stage, result }
  const candidateSteps = ref({}) // { [candidateId]: stepEntry[] }
  const totalCandidates = ref(0)
  const completedCount = ref(0)
  const startedAt = ref(null)
  const finishedAt = ref(null)
  const error = ref(null)

  // Form settings
  const methodContent = ref('')
  const caption = ref('')
  const taskName = ref('diagram')
  const expMode = ref(normalizeExpMode('demo_full'))
  const retrievalSetting = ref('auto')
  const numCandidates = ref(3)
  const aspectRatio = ref('16:9')
  const maxCriticRounds = ref(3)
  const modelName = ref('')
  const imageModelName = ref('')

  // ─── Reactive clock (updates every second while generating) ──
  const _now = ref(Date.now())
  let _ticker = null

  // ─── Getters ───────────────────────────────────────────────
  const progressPercent = computed(() => {
    if (!totalCandidates.value) return 0
    return Math.round((completedCount.value / totalCandidates.value) * 100)
  })

  const elapsedSeconds = computed(() => {
    if (!startedAt.value) return 0
    const end = finishedAt.value || _now.value
    return Math.round((end - startedAt.value) / 1000)
  })

  // ─── Actions ───────────────────────────────────────────────
  async function startGeneration() {
    if (isGenerating.value) return null

    const authStore = useAuthStore()
    const organizationId = authStore.currentOrganization?.id

    error.value = null
    isGenerating.value = true
    completedCount.value = 0
    candidates.value = []
    candidateSteps.value = {}
    finishedAt.value = null
    startedAt.value = Date.now()
    _now.value = Date.now()
    _ticker = setInterval(() => { _now.value = Date.now() }, 1000)

    try {
      const res = await api.generateStart({
        methodContent: methodContent.value,
        caption: caption.value,
        taskName: taskName.value,
        expMode: expMode.value,
        retrievalSetting: retrievalSetting.value,
        numCandidates: numCandidates.value,
        aspectRatio: aspectRatio.value,
        maxCriticRounds: maxCriticRounds.value,
        modelName: modelName.value || undefined,
        imageModelName: imageModelName.value || undefined,
        organizationId,
      })

      jobId.value = res.data.jobId
      totalCandidates.value = numCandidates.value

      // Initialize candidate slots
      candidates.value = Array.from({ length: numCandidates.value }, (_, i) => ({
        id: i,
        status: 'pending',
        stage: '',
        message: '',
        percent: 0,
        result: null,
      }))

      return res.data.jobId
    } catch (err) {
      error.value = err.message
      ElMessage.error(err.message)
      isGenerating.value = false
      return null
    }
  }

  function updateProgress(candidateId, stage, message, percent) {
    const candidate = candidates.value.find((c) => c.id === candidateId)
    if (candidate) {
      candidate.status = 'running'
      candidate.stage = stage
      candidate.message = message
      candidate.percent = percent
    }
  }

  function setCandidateComplete(candidateId, result) {
    const candidate = candidates.value.find((c) => c.id === candidateId)
    if (candidate) {
      candidate.status = 'completed'
      candidate.percent = 100
      candidate.result = result
    }
    completedCount.value++
  }

  function setCandidateError(candidateId, message) {
    const candidate = candidates.value.find((c) => c.id === candidateId)
    if (candidate) {
      candidate.status = 'error'
      candidate.message = message
    }
  }

  function appendStepLog(candidateId, stepEntry) {
    if (!candidateSteps.value[candidateId]) {
      candidateSteps.value[candidateId] = []
    }
    candidateSteps.value[candidateId].push(stepEntry)
  }

  function setAllComplete() {
    isGenerating.value = false
    finishedAt.value = Date.now()
    if (_ticker) { clearInterval(_ticker); _ticker = null }
  }

  /**
   * Sync store state from a history job detail object (after WS reconnect /
   * backend restart). Handles both completed and still-running states.
   * Returns true if the job was found to be complete.
   */
  function syncFromHistory(jobDetail) {
    if (!jobDetail || jobDetail.id !== jobId.value) return false

    for (const c of jobDetail.candidates || []) {
      const existing = candidates.value.find((x) => x.id === c.candidate_idx)
      if (!existing) continue
      if (existing.status === 'completed' || existing.status === 'error') continue

      if (c.status === 'completed' && c.result) {
        existing.status = 'completed'
        existing.percent = 100
        existing.result = c.result
        completedCount.value++
      } else if (c.status === 'error') {
        existing.status = 'error'
        existing.message = c.result?.error || '生成失败'
      }
    }

    if (jobDetail.status === 'completed' && isGenerating.value) {
      setAllComplete()
      return true
    }
    return false
  }

  /**
   * Pre-fill form fields from a history job record (for "redraw" feature).
   * Also resets any previous generation results.
   */
  function loadFromHistory(job) {
    if (!job) return
    // Reset results first
    if (_ticker) { clearInterval(_ticker); _ticker = null }
    isGenerating.value = false
    candidates.value = []
    totalCandidates.value = 0
    completedCount.value = 0
    startedAt.value = null
    finishedAt.value = null
    jobId.value = null
    error.value = null

    // Fill form fields from stored job params
    if (job.method_content) methodContent.value = job.method_content
    if (job.caption) caption.value = job.caption
    if (job.task_name) taskName.value = job.task_name
    if (job.exp_mode) expMode.value = normalizeExpMode(job.exp_mode)
    if (job.retrieval_setting) retrievalSetting.value = job.retrieval_setting
    if (job.num_candidates) numCandidates.value = Math.min(Math.max(job.num_candidates, 1), 5)
    if (job.aspect_ratio) aspectRatio.value = job.aspect_ratio
    if (job.max_critic_rounds) maxCriticRounds.value = Math.min(Math.max(job.max_critic_rounds, 1), 3)
    if (job.model_name) modelName.value = job.model_name
    if (job.image_model_name) imageModelName.value = job.image_model_name
  }

  function reset() {
    if (_ticker) { clearInterval(_ticker); _ticker = null }
    jobId.value = null
    isGenerating.value = false
    candidates.value = []
    candidateSteps.value = {}
    totalCandidates.value = 0
    completedCount.value = 0
    startedAt.value = null
    finishedAt.value = null
    error.value = null
  }

  return {
    jobId, isGenerating, candidates, totalCandidates, completedCount,
    startedAt, finishedAt, error,
    methodContent, caption, taskName, expMode, retrievalSetting,
    numCandidates, aspectRatio, maxCriticRounds, modelName, imageModelName,
    progressPercent, elapsedSeconds,
    startGeneration, updateProgress, setCandidateComplete,
    setCandidateError, setAllComplete, appendStepLog, syncFromHistory, loadFromHistory, reset,
    candidateSteps,
  }
})
