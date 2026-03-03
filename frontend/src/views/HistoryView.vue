<template>
  <div class="history-view">
    <div class="history-header">
      <div>
        <h2 class="page-title">历史记录</h2>
        <span class="page-sub">共 {{ pagination.total }} 条生成记录，持久化存储于本地 SQLite</span>
      </div>
      <el-button :icon="Refresh" circle @click="loadList" :loading="loading" />
    </div>

    <!-- Job list -->
    <el-table
      :data="jobs"
      v-loading="loading"
      row-key="id"
      stripe
      @row-click="openDetail"
      class="history-table"
    >
      <el-table-column label="时间" width="160">
        <template #default="{ row }">
          <span class="time-text">{{ formatTime(row.created_at) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="图注" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="caption-text">{{ row.caption || '—' }}</span>
        </template>
      </el-table-column>

      <el-table-column label="模式" width="140">
        <template #default="{ row }">
          <el-tag size="small" type="info">{{ row.exp_mode || '—' }}</el-tag>
        </template>
      </el-table-column>

      <el-table-column label="任务" width="80">
        <template #default="{ row }">
          <el-tag size="small" :type="row.task_name === 'plot' ? 'warning' : ''">
            {{ row.task_name === 'plot' ? '统计图' : '图表' }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column label="候选" width="80" align="center">
        <template #default="{ row }">
          <span>{{ row.completed_candidates }}/{{ row.num_candidates }}</span>
        </template>
      </el-table-column>

      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="statusType(row)" size="small">{{ statusLabel(row) }}</el-tag>
        </template>
      </el-table-column>

      <el-table-column label="耗时" width="80" align="center">
        <template #default="{ row }">
          {{ row.total_time_ms ? (row.total_time_ms / 1000).toFixed(0) + 's' : '—' }}
        </template>
      </el-table-column>

      <el-table-column label="操作" width="110" align="center">
        <template #default="{ row }">
          <el-tooltip content="重新绘制" placement="top">
            <el-button
              size="small"
              type="primary"
              text
              :icon="RefreshRight"
              @click.stop="redrawJob(row)"
            />
          </el-tooltip>
          <el-tooltip content="删除记录" placement="top">
            <el-button
              size="small"
              type="danger"
              text
              :icon="Delete"
              @click.stop="deleteJob(row.id)"
            />
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <!-- Pagination -->
    <div class="pagination-wrap">
      <el-pagination
        v-model:current-page="pagination.page"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="loadList"
      />
    </div>

    <!-- Detail drawer -->
    <el-drawer
      v-model="drawerVisible"
      :title="drawerTitle"
      size="80%"
      direction="rtl"
      destroy-on-close
    >
      <div v-if="detailLoading" class="drawer-loading">
        <el-icon class="is-loading" size="32"><Loading /></el-icon>
        <span>加载中...</span>
      </div>

      <template v-else-if="currentDetail">
        <!-- Meta info -->
        <el-descriptions :column="3" border size="small" class="detail-meta">
          <el-descriptions-item label="任务ID">
            <code class="job-id">{{ currentDetail.id }}</code>
          </el-descriptions-item>
          <el-descriptions-item label="流水线模式">{{ currentDetail.exp_mode }}</el-descriptions-item>
          <el-descriptions-item label="任务类型">{{ currentDetail.task_name }}</el-descriptions-item>
          <el-descriptions-item label="检索策略">{{ currentDetail.retrieval_setting }}</el-descriptions-item>
          <el-descriptions-item label="宽高比">{{ currentDetail.aspect_ratio }}</el-descriptions-item>
          <el-descriptions-item label="耗时">
            {{ currentDetail.total_time_ms ? (currentDetail.total_time_ms / 1000).toFixed(1) + 's' : '—' }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- Caption & Method -->
        <el-collapse class="detail-collapse">
          <el-collapse-item title="图注" name="caption">
            <p class="detail-text">{{ currentDetail.caption }}</p>
          </el-collapse-item>
          <el-collapse-item title="方法节内容" name="method" v-if="currentDetail.method_content">
            <pre class="detail-pre">{{ currentDetail.method_content }}</pre>
          </el-collapse-item>
        </el-collapse>

        <!-- Redraw action -->
        <div class="detail-actions">
          <el-button type="primary" :icon="RefreshRight" @click="redrawJob(currentDetail)">
            重新绘制此任务
          </el-button>
        </div>

        <!-- Candidates grid -->
        <h3 class="candidates-title">候选结果（{{ currentDetail.candidates?.length || 0 }} 个）</h3>
        <div class="candidates-grid">
          <div
            v-for="c in currentDetail.candidates"
            :key="c.candidate_idx"
            class="history-candidate-card"
            :class="{ 'is-error': c.status === 'error' }"
          >
            <div class="hc-header">
              <span>候选 {{ c.candidate_idx + 1 }}</span>
              <el-tag :type="c.status === 'completed' ? 'success' : 'danger'" size="small">
                {{ c.status === 'completed' ? '已完成' : '失败' }}
              </el-tag>
            </div>

            <template v-if="c.status === 'completed' && c.result">
              <!-- Final image -->
              <img
                v-if="getFinalImageUrl(c.result, currentDetail.task_name)"
                :src="getFinalImageUrl(c.result, currentDetail.task_name)"
                class="hc-image"
                loading="lazy"
                @click="previewImage = getFinalImageUrl(c.result, currentDetail.task_name); previewVisible = true"
              />
              <div v-else class="hc-no-image">图片生成失败（额度不足）</div>

              <!-- Stage timeline -->
              <div
                v-if="getStageImages(c.result, currentDetail.task_name).length > 1"
                class="hc-stages"
              >
                <div
                  v-for="stage in getStageImages(c.result, currentDetail.task_name)"
                  :key="stage.label"
                  class="hc-stage-thumb"
                  @click="previewImage = stage.url; previewVisible = true"
                  :title="stage.label"
                >
                  <img :src="stage.url" loading="lazy" />
                  <span>{{ stage.label }}</span>
                </div>
              </div>

              <el-button
                v-if="getFinalImageUrl(c.result, currentDetail.task_name)"
                size="small"
                class="hc-dl"
                :icon="Download"
                @click="downloadCandidate(c, currentDetail.task_name)"
              >
                下载
              </el-button>

              <!-- Step log from stored result -->
              <StepLog
                v-if="c.result?._steps?.length"
                :steps="c.result._steps"
                @preview="previewImage = $event; previewVisible = true"
              />
            </template>

            <div v-else-if="c.status === 'error'" class="hc-error">
              {{ c.result?.error || '生成失败' }}
            </div>
          </div>
        </div>
      </template>
    </el-drawer>

    <!-- Image preview -->
    <el-dialog v-model="previewVisible" width="80%" destroy-on-close>
      <img :src="previewImage" style="width:100%" />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Delete, Download, RefreshRight } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { useGenerateStore } from '@/stores/generateStore.js'
import api from '@/api/index.js'
import StepLog from '@/components/generate/StepLog.vue'

const router = useRouter()
const generateStore = useGenerateStore()

const loading = ref(false)
const jobs = ref([])
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const drawerVisible = ref(false)
const detailLoading = ref(false)
const currentDetail = ref(null)
const previewVisible = ref(false)
const previewImage = ref('')

const drawerTitle = computed(() => {
  if (!currentDetail.value) return '详情'
  return `${formatTime(currentDetail.value.created_at)} · ${currentDetail.value.caption?.slice(0, 40) || '(无图注)'}`
})

async function loadList() {
  loading.value = true
  try {
    const res = await api.listHistory({ page: pagination.page, pageSize: pagination.pageSize })
    jobs.value = res.data.jobs
    pagination.total = res.data.total
  } catch (e) {
    ElMessage.error('加载历史记录失败')
  } finally {
    loading.value = false
  }
}

async function openDetail(row) {
  drawerVisible.value = true
  detailLoading.value = true
  currentDetail.value = null
  try {
    const res = await api.getHistoryDetail(row.id)
    currentDetail.value = res.data
  } catch (e) {
    ElMessage.error('加载详情失败')
  } finally {
    detailLoading.value = false
  }
}

async function deleteJob(jobId) {
  await ElMessageBox.confirm('确定删除这条记录吗？此操作不可撤销。', '删除确认', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  })
  await api.deleteHistory(jobId)
  ElMessage.success('已删除')
  if (currentDetail.value?.id === jobId) drawerVisible.value = false
  loadList()
}

function redrawJob(job) {
  generateStore.loadFromHistory(job)
  router.push('/generate')
  ElMessage.success('已载入历史参数，可直接点击「开始生成」重新绘制')
}

/**
 * Get a displayable src for the best (final) image of a candidate.
 * Checks _image_url (disk-stored) first, falls back to _base64_jpg
 * (kept in DB when disk write fails).
 */
function getFinalImageUrl(result, taskName) {
  if (!result) return null
  const t = taskName || 'diagram'

  // Prefer disk-stored URLs
  for (let i = 3; i >= 0; i--) {
    if (result[`target_${t}_critic_desc${i}_image_url`]) return result[`target_${t}_critic_desc${i}_image_url`]
  }
  if (result[`target_${t}_stylist_desc0_image_url`]) return result[`target_${t}_stylist_desc0_image_url`]
  if (result[`target_${t}_desc0_image_url`]) return result[`target_${t}_desc0_image_url`]
  if (result[`target_${t}_vanilla_image_url`]) return result[`target_${t}_vanilla_image_url`]

  // Fallback: base64 kept in DB when disk save failed
  for (let i = 3; i >= 0; i--) {
    const b64 = result[`target_${t}_critic_desc${i}_base64_jpg`]
    if (b64) return `data:image/jpeg;base64,${b64}`
  }
  const b64 = result[`target_${t}_stylist_desc0_base64_jpg`]
    || result[`target_${t}_desc0_base64_jpg`]
    || result[`target_${t}_vanilla_base64_jpg`]
  return b64 ? `data:image/jpeg;base64,${b64}` : null
}

/**
 * Get all stage images for evolution timeline in history view.
 */
function getStageImages(result, taskName) {
  if (!result) return []
  const t = taskName || 'diagram'
  const stageMap = [
    { urlKey: `target_${t}_desc0_image_url`,         b64Key: `target_${t}_desc0_base64_jpg`,         label: 'Planner' },
    { urlKey: `target_${t}_stylist_desc0_image_url`,  b64Key: `target_${t}_stylist_desc0_base64_jpg`,  label: 'Stylist' },
    { urlKey: `target_${t}_critic_desc0_image_url`,   b64Key: `target_${t}_critic_desc0_base64_jpg`,   label: 'Critic R1' },
    { urlKey: `target_${t}_critic_desc1_image_url`,   b64Key: `target_${t}_critic_desc1_base64_jpg`,   label: 'Critic R2' },
    { urlKey: `target_${t}_critic_desc2_image_url`,   b64Key: `target_${t}_critic_desc2_base64_jpg`,   label: 'Critic R3' },
  ]
  return stageMap
    .map((s) => {
      const url = result[s.urlKey] || (result[s.b64Key] ? `data:image/jpeg;base64,${result[s.b64Key]}` : null)
      return url ? { label: s.label, url } : null
    })
    .filter(Boolean)
}

function downloadCandidate(candidate, taskName) {
  const url = getFinalImageUrl(candidate.result, taskName)
  if (!url) return
  const a = document.createElement('a')
  a.href = url
  a.download = `history_candidate_${candidate.candidate_idx + 1}.jpg`
  a.click()
}

function formatTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function statusType(row) {
  if (row.status === 'completed') return row.failed_candidates > 0 ? 'warning' : 'success'
  if (row.status === 'running') return 'info'
  return 'danger'
}

function statusLabel(row) {
  if (row.status === 'running') return '进行中'
  if (row.status === 'completed') return row.failed_candidates > 0 ? '部分完成' : '已完成'
  return '失败'
}

onMounted(loadList)
</script>

<style scoped>
.history-view { height: 100%; display: flex; flex-direction: column; gap: 16px; }
.history-header { display: flex; justify-content: space-between; align-items: flex-start; }
.page-title { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
.page-sub { font-size: 13px; color: #6b7280; }
.history-table { cursor: pointer; }
.time-text { font-size: 12px; color: #6b7280; }
.caption-text { font-size: 13px; }
.pagination-wrap { display: flex; justify-content: flex-end; }
.job-id { font-size: 11px; color: #6b7280; }

/* Drawer */
.drawer-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; gap: 12px; color: #9ca3af; }
.detail-meta { margin-bottom: 16px; }
.detail-collapse { margin-bottom: 16px; }
.detail-text { font-size: 13px; color: #374151; line-height: 1.6; }
.detail-pre { font-size: 12px; white-space: pre-wrap; max-height: 300px; overflow-y: auto; }
.detail-actions { margin-bottom: 16px; }
.candidates-title { font-size: 14px; font-weight: 600; margin: 16px 0 12px; }
.candidates-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }

.history-candidate-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}
.history-candidate-card.is-error { border-color: #fca5a5; background: #fef2f2; }
.hc-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; font-weight: 600; }
.hc-image { width: 100%; display: block; cursor: zoom-in; }
.hc-no-image { padding: 20px; text-align: center; font-size: 12px; color: #b45309; background: #fffbeb; }
.hc-error { padding: 12px; font-size: 12px; color: #dc2626; }
.hc-dl { width: 100%; border-radius: 0; border-top: 1px solid #f3f4f6; }

.hc-stages {
  display: flex;
  gap: 4px;
  padding: 6px 8px;
  background: #f9fafb;
  border-top: 1px solid #f3f4f6;
  overflow-x: auto;
}
.hc-stage-thumb {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  flex-shrink: 0;
}
.hc-stage-thumb img {
  width: 60px;
  height: 40px;
  object-fit: cover;
  border-radius: 3px;
  border: 1px solid #e5e7eb;
  transition: border-color 0.15s;
}
.hc-stage-thumb:hover img { border-color: #eab308; }
.hc-stage-thumb span { font-size: 10px; color: #6b7280; }
</style>
