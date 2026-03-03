<template>
  <div class="candidate-card" :class="cardClass">
    <!-- Header -->
    <div class="card-header">
      <span class="card-title">候选 {{ candidate.id + 1 }}</span>
      <el-tag :type="statusTagType" size="small">{{ statusLabel }}</el-tag>
    </div>

    <!-- Loading state -->
    <div v-if="candidate.status === 'running'" class="card-loading">
      <el-progress
        :percentage="candidate.percent"
        :stroke-width="4"
        :show-text="false"
        status="striped"
        striped-flow
        :duration="6"
      />
      <div class="stage-info">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>{{ stageLabel }}</span>
        <span class="stage-msg">{{ candidate.message }}</span>
      </div>
      <div v-if="candidate.stage === 'visualizer'" class="elapsed-tip">
        <span class="elapsed-badge">⏱ {{ elapsedLabel }}</span>
        <span class="elapsed-hint">图像生成耗时较长，正常现象，请勿关闭页面</span>
      </div>
    </div>

    <!-- Pending state -->
    <div v-else-if="candidate.status === 'pending'" class="card-placeholder">
      <el-icon size="32" color="#d1d5db"><Timer /></el-icon>
      <span>等待处理...</span>
    </div>

    <!-- Error state -->
    <div v-else-if="candidate.status === 'error'" class="card-error">
      <el-icon size="32" color="#ef4444"><CircleClose /></el-icon>
      <span>生成失败</span>
      <span class="error-msg">{{ candidate.message }}</span>
    </div>

    <!-- Completed state with image -->
    <template v-else-if="candidate.status === 'completed' && finalImageSrc">
      <div class="card-image-wrap">
        <img
          :src="finalImageSrc"
          class="card-image"
          @click="$emit('preview', finalImageSrc)"
          title="点击查看大图"
        />
      </div>

      <div class="card-actions">
        <el-button size="small" @click="downloadImage" :icon="Download">下载 PNG</el-button>
        <el-button size="small" @click="$emit('preview', finalImageSrc)" :icon="ZoomIn">查看大图</el-button>
      </div>

      <EvolutionTimeline
        :result="candidate.result"
        :task-name="taskName"
        :exp-mode="expMode"
      />

      <StepLog :steps="steps" @preview="$emit('preview', $event)" />
    </template>

    <!-- Completed but no image (Plotly spec only) -->
    <template v-else-if="candidate.status === 'completed' && finalPlotlySpec">
      <div class="plotly-preview-wrap" ref="plotlyRef" />
      <div class="card-actions">
        <el-button size="small" @click="downloadPlotly" :icon="Download">下载 PNG</el-button>
      </div>
    </template>

    <!-- Completed but image generation failed (text description exists) -->
    <template v-else-if="candidate.status === 'completed'">
      <div class="card-no-image">
        <el-icon size="28" color="#f59e0b"><Warning /></el-icon>
        <span class="no-image-title">图片生成失败（API 额度不足）</span>
        <span class="no-image-sub">Planner 描述已生成，可查看文字内容</span>
      </div>
      <div class="card-desc-wrap" v-if="plannerDesc">
        <el-collapse>
          <el-collapse-item title="📋 查看 Planner 描述文字">
            <pre class="desc-pre">{{ plannerDesc }}</pre>
          </el-collapse-item>
        </el-collapse>
      </div>
      <StepLog :steps="steps" @preview="$emit('preview', $event)" />
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch, onUnmounted } from 'vue'
import Plotly from 'plotly.js-dist-min'
import { Download, ZoomIn, Warning } from '@element-plus/icons-vue'
import EvolutionTimeline from './EvolutionTimeline.vue'
import StepLog from './StepLog.vue'

const props = defineProps({
  candidate: { type: Object, required: true },
  taskName: { type: String, default: 'diagram' },
  expMode: { type: String, default: 'demo_full' },
  steps: { type: Array, default: () => [] },
})
const emit = defineEmits(['preview'])

const plotlyRef = ref(null)

// ─── Elapsed timer ────────────────────────────────────────────
const elapsedSec = ref(0)
let timerHandle = null

function startTimer() {
  if (timerHandle) return
  elapsedSec.value = 0
  timerHandle = setInterval(() => { elapsedSec.value++ }, 1000)
}
function stopTimer() {
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null }
}

watch(() => props.candidate.status, (s) => {
  if (s === 'running') startTimer()
  else stopTimer()
}, { immediate: true })

onUnmounted(() => {
  stopTimer()
  if (plotlyRef.value) {
    Plotly.purge(plotlyRef.value)
  }
})

const elapsedLabel = computed(() => {
  const s = elapsedSec.value
  if (s < 60) return `已等待 ${s}s`
  return `已等待 ${Math.floor(s / 60)}m${s % 60}s`
})

// ─── Computed ─────────────────────────────────────────────────

// Returns an img src string: either "data:image/jpeg;base64,..." or a "/images/..." URL
// Handles both live generation (base64) and history-synced results (image_url)
const finalImageSrc = computed(() => {
  const r = props.candidate.result
  if (!r) return null
  const t = props.taskName
  for (let i = 3; i >= 0; i--) {
    const b64 = r[`target_${t}_critic_desc${i}_base64_jpg`]
    if (b64) return `data:image/jpeg;base64,${b64}`
    const url = r[`target_${t}_critic_desc${i}_image_url`]
    if (url) return url
  }
  const b64 = r[`target_${t}_stylist_desc0_base64_jpg`] || r[`target_${t}_desc0_base64_jpg`] || r[`target_${t}_vanilla_base64_jpg`]
  if (b64) return `data:image/jpeg;base64,${b64}`
  return r[`target_${t}_stylist_desc0_image_url`] || r[`target_${t}_desc0_image_url`] || r[`target_${t}_vanilla_image_url`] || null
})

// Keep finalImage for backward compat (base64 only, used in download)
const finalImage = computed(() => {
  const r = props.candidate.result
  if (!r) return null
  const t = props.taskName
  for (let i = 3; i >= 0; i--) {
    const key = `target_${t}_critic_desc${i}_base64_jpg`
    if (r[key]) return r[key]
  }
  return r[`target_${t}_stylist_desc0_base64_jpg`] || r[`target_${t}_desc0_base64_jpg`] || r[`target_${t}_vanilla_base64_jpg`] || null
})

const finalPlotlySpec = computed(() => {
  const r = props.candidate.result
  if (!r) return null
  const t = props.taskName
  for (let i = 3; i >= 0; i--) {
    const key = `target_${t}_critic_desc${i}_plotly_spec`
    if (r[key]) return r[key]
  }
  return r[`target_${t}_stylist_desc0_plotly_spec`] || r[`target_${t}_desc0_plotly_spec`] || r[`target_${t}_vanilla_plotly_spec`] || null
})

const plannerDesc = computed(() => {
  const r = props.candidate.result
  if (!r) return null
  return r[`target_${props.taskName}_desc0`] || null
})

const statusTagType = computed(() => ({
  pending: 'info', running: 'warning', completed: 'success', error: 'danger',
}[props.candidate.status] || 'info'))

const statusLabel = computed(() => ({
  pending: '等待中', running: '生成中', completed: '已完成', error: '失败',
}[props.candidate.status] || ''))

const cardClass = computed(() => ({
  'is-running': props.candidate.status === 'running',
  'is-completed': props.candidate.status === 'completed',
  'is-error': props.candidate.status === 'error',
}))

const stageLabel = computed(() => ({
  retriever: '🔍 检索参考示例',
  planner: '📋 规划描述',
  stylist: '✨ 风格优化',
  visualizer: '🎨 生成图像',
  critic: '🔍 Critic 评审',
  done: '✅ 完成',
}[props.candidate.stage] || props.candidate.stage))

// ─── Plotly preview ──────────────────────────────────────────

watch(finalPlotlySpec, async (spec) => {
  if (!spec || !plotlyRef.value) return
  const data = Array.isArray(spec.data) ? spec.data : []
  const layout = { paper_bgcolor: '#ffffff', plot_bgcolor: '#ffffff', ...(spec.layout || {}) }
  const config = { displayModeBar: false, responsive: false, ...(spec.config || {}) }
  await Plotly.newPlot(plotlyRef.value, data, layout, config)
})

// ─── Actions ──────────────────────────────────────────────────

function downloadImage() {
  if (!finalImageSrc.value) return
  const a = document.createElement('a')
  a.href = finalImageSrc.value   // works for both data URI and /images/... URL
  a.download = `candidate_${props.candidate.id + 1}.png`
  a.click()
}

async function downloadPlotly() {
  if (!plotlyRef.value || !finalPlotlySpec.value) return
  const url = await Plotly.toImage(plotlyRef.value, {
    format: 'png',
    width: 1200,
    height: 750,
    scale: 3,
  })
  const a = document.createElement('a')
  a.href = url
  a.download = `candidate_${props.candidate.id + 1}.png`
  a.click()
}
</script>

<style scoped>
.candidate-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  transition: box-shadow 0.2s;
}
.candidate-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
.candidate-card.is-running { border-color: #fbbf24; }
.candidate-card.is-completed { border-color: #34d399; }
.candidate-card.is-error { border-color: #f87171; }

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid #f3f4f6;
}
.card-title { font-weight: 600; font-size: 13px; }

.card-loading, .card-placeholder, .card-error {
  padding: 24px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-height: 120px;
  justify-content: center;
}
.stage-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
  flex-wrap: wrap;
  justify-content: center;
}
.stage-msg { color: #9ca3af; }
.error-msg { font-size: 11px; color: #ef4444; text-align: center; }
.elapsed-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  margin-top: 4px;
}
.elapsed-badge {
  font-size: 13px;
  font-weight: 600;
  color: #f59e0b;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 12px;
  padding: 2px 10px;
}
.elapsed-hint { font-size: 11px; color: #9ca3af; }

.card-image-wrap {
  padding: 10px;
}
.card-image {
  width: 100%;
  border-radius: 6px;
  display: block;
  cursor: zoom-in;
}
.plotly-preview-wrap {
  width: 100%;
  height: 300px;
  padding: 8px;
}
.card-actions {
  display: flex;
  gap: 8px;
  padding: 8px 14px;
  border-top: 1px solid #f3f4f6;
}
.card-no-image {
  padding: 20px 14px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: #fffbeb;
  border-bottom: 1px solid #fde68a;
}
.no-image-title { font-size: 13px; font-weight: 600; color: #92400e; }
.no-image-sub { font-size: 11px; color: #b45309; }
.card-desc-wrap { padding: 8px 14px; }
.desc-pre {
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  color: #374151;
  max-height: 200px;
  overflow-y: auto;
  line-height: 1.5;
}
</style>
