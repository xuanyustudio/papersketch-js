<template>
  <div class="generate-view">
    <div class="view-layout">
      <!-- Left: Input + Settings -->
      <div class="left-panel">
        <el-card class="input-card">
          <template #header>
            <span class="card-title">📝 输入内容</span>
          </template>

          <el-form label-position="top">
            <el-form-item label="方法节内容（支持 Markdown / LaTeX）">
              <el-input
                v-model="store.methodContent"
                type="textarea"
                :rows="10"
                placeholder="粘贴论文方法节内容..."
                resize="vertical"
              />
            </el-form-item>
            <el-form-item label="图注（Figure Caption）">
              <el-input
                v-model="store.caption"
                type="textarea"
                :rows="4"
                placeholder="输入图注，例如：Figure 1: Overview of our framework..."
                resize="vertical"
              />
            </el-form-item>
          </el-form>

          <!-- Example loader -->
          <el-collapse>
            <el-collapse-item title="加载示例输入" name="example">
              <el-button size="small" @click="loadExample">
                加载 PaperVizAgent 示例
              </el-button>
            </el-collapse-item>
          </el-collapse>
        </el-card>

        <el-card class="settings-card">
          <template #header>
            <span class="card-title">⚙️ 生成设置</span>
          </template>
          <SettingsPanel />
        </el-card>

        <el-button
          type="primary"
          size="large"
          :loading="store.isGenerating"
          :disabled="!store.methodContent.trim() || !store.caption.trim()"
          class="generate-btn"
          @click="handleGenerate"
        >
          {{ store.isGenerating ? '生成中...' : '🚀 开始生成候选图表' }}
        </el-button>

        <el-alert
          v-if="store.error"
          :title="store.error"
          type="error"
          show-icon
          closable
          class="mt-3"
        />
      </div>

      <!-- Right: Results -->
      <div class="right-panel">
        <CandidateGrid v-if="store.candidates.length > 0" />
        <div v-else class="empty-state">
          <el-icon size="64" color="#d1d5db"><Picture /></el-icon>
          <p>填写左侧内容后点击「开始生成」</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onUnmounted } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import { useGenerateStore } from '@/stores/generateStore.js'
import { useAuthStore } from '@/stores/authStore.js'
import { useWebSocket } from '@/composables/useWebSocket.js'
import api from '@/api/index.js'
import SettingsPanel from '@/components/generate/SettingsPanel.vue'
import CandidateGrid from '@/components/generate/CandidateGrid.vue'

const store = useGenerateStore()
const authStore = useAuthStore()
const { emit, on, socket } = useWebSocket()

// ─── Reconnect & job sync ─────────────────────────────────────

let pollTimer = null
let hadDisconnect = false   // track whether we ever lost connection

function stopPoll() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

/** Poll history API every 4s until job completes (backend resumes silently) */
function startPoll() {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    if (!store.isGenerating || !store.jobId) { stopPoll(); return }
    try {
      const res = await api.getHistoryDetail(store.jobId)
      const done = store.syncFromHistory(res.data)
      if (done) {
        stopPoll()
        ElNotification({ title: '恢复完成', message: '后端已自动恢复任务，结果已同步', type: 'success', duration: 4000 })
      }
    } catch { /* ignore transient errors */ }
  }, 4000)
}

// On every (re)connect: if we were generating, check whether job finished while offline
socket.on('connect', async () => {
  if (!hadDisconnect) return          // first-time connect, nothing to sync
  if (!store.isGenerating || !store.jobId) return

  ElNotification({ title: '连接已恢复', message: '正在检查任务状态...', type: 'info', duration: 2000 })

  try {
    const res = await api.getHistoryDetail(store.jobId)
    const done = store.syncFromHistory(res.data)
    if (done) {
      stopPoll()
      ElNotification({ title: '任务已完成', message: '后端在离线期间已自动恢复，结果从历史记录加载', type: 'success', duration: 5000 })
    } else {
      // Job still running (resume in progress), poll until done
      startPoll()
    }
  } catch {
    // History not found yet – keep polling
    startPoll()
  }
})

socket.on('disconnect', () => {
  hadDisconnect = true
  if (store.isGenerating) {
    ElNotification({ title: '连接中断', message: '与服务器的连接已断开，自动重连中...', type: 'warning', duration: 0, id: 'ws-disconnect' })
  }
})

onUnmounted(stopPoll)

// ─── WebSocket event listeners ────────────────────────────────

on('generate:progress', ({ jobId, candidateId, stage, message, percent }) => {
  if (jobId === store.jobId) {
    store.updateProgress(candidateId, stage, message, percent)
  }
})

on('generate:step_log', ({ jobId, candidateId, step }) => {
  if (jobId === store.jobId) {
    store.appendStepLog(candidateId, step)
  }
})

on('generate:candidate_complete', ({ jobId, candidateId, result }) => {
  if (jobId === store.jobId) {
    store.setCandidateComplete(candidateId, result)
    ElMessage.success({ message: `候选 ${candidateId + 1} 生成完成`, duration: 2000 })
  }
})

on('generate:all_complete', ({ jobId }) => {
  if (jobId === store.jobId) {
    store.setAllComplete()
    ElMessage.success('所有候选已生成完毕！')
    authStore.refreshPoints()
  }
})

on('generate:error', ({ jobId, candidateId, error }) => {
  if (jobId === store.jobId) {
    if (candidateId >= 0) {
      store.setCandidateError(candidateId, error)
    } else {
      store.error = error
      store.setAllComplete()
    }
  }
})

// ─── Actions ──────────────────────────────────────────────────

async function handleGenerate() {
  const jobId = await store.startGeneration()
  if (!jobId) return

  const authStore = useAuthStore()
  
  // Trigger the pipeline via WebSocket
  emit('generate:start', {
    jobId,
    methodContent: store.methodContent,
    caption: store.caption,
    taskName: store.taskName,
    expMode: store.expMode,
    retrievalSetting: store.retrievalSetting,
    numCandidates: store.numCandidates,
    aspectRatio: store.aspectRatio,
    maxCriticRounds: store.maxCriticRounds,
    modelName: store.modelName || undefined,
    imageModelName: store.imageModelName || undefined,
    organizationId: authStore.currentOrganization?.id,
    userId: authStore.user?.id,
  })
}

function loadExample() {
  store.methodContent = `## Methodology: The PaperVizAgent Framework

In this section, we present the architecture of PaperVizAgent, a reference-driven agentic framework for automated academic illustration. PaperVizAgent orchestrates a collaborative team of five specialized agents—Retriever, Planner, Stylist, Visualizer, and Critic—to transform raw scientific content into publication-quality diagrams and plots.

### Retriever Agent
Given the source context and the communicative intent, the Retriever Agent identifies the most relevant examples from the fixed reference set to guide the downstream agents.

### Planner Agent
The Planner Agent serves as the cognitive core of the system. It takes the source context, communicative intent, and retrieved examples as inputs. By performing in-context learning from the demonstrations, the Planner translates the unstructured data into a comprehensive and detailed textual description of the target illustration.

### Stylist Agent
To ensure the output adheres to the aesthetic standards of modern academic manuscripts, the Stylist Agent acts as a design consultant. It traverses the entire reference collection to automatically synthesize an Aesthetic Guideline covering key dimensions such as color palette, shapes and containers, lines and arrows, layout and composition, and typography.

### Visualizer Agent
The Visualizer Agent collaborates with the Critic Agent to render academic illustrations and iteratively refine their quality. The Visualizer Agent leverages an image generation model to transform textual descriptions into visual output.

### Critic Agent
The Critic Agent forms a closed-loop refinement mechanism with the Visualizer by closely examining the generated image and providing refined description to the Visualizer.`

  store.caption = `Figure 1: Overview of our PaperVizAgent framework. Given the source context and communicative intent, we first apply a Linear Planning Phase to retrieve relevant reference examples and synthesize a stylistically optimized description. We then use an Iterative Refinement Loop (consisting of Visualizer and Critic agents) to transform the description into visual output.`
}
</script>

<style scoped>
.generate-view { height: 100%; }
.view-layout {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 20px;
  height: 100%;
}
.left-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  padding-bottom: 16px;
}
.right-panel {
  overflow-y: auto;
  padding-bottom: 16px;
}
.input-card, .settings-card { flex-shrink: 0; }
.card-title { font-weight: 600; font-size: 14px; }
.generate-btn {
  width: 100%;
  height: 44px;
  font-size: 15px;
  font-weight: 600;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  gap: 16px;
  color: #9ca3af;
}
</style>
