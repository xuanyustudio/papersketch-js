<template>
  <div>
    <!-- Overall progress bar -->
    <div class="overall-progress" v-if="store.isGenerating || store.completedCount > 0">
      <div class="progress-info">
        <span>{{ store.completedCount }} / {{ store.totalCandidates }} 候选完成</span>
        <span class="elapsed">⏱ 已耗时 {{ store.elapsedSeconds < 60 ? store.elapsedSeconds + 's' : Math.floor(store.elapsedSeconds/60) + 'm' + (store.elapsedSeconds%60) + 's' }}</span>
      </div>
      <el-progress
        :percentage="store.progressPercent"
        :stroke-width="6"
        :status="store.isGenerating ? undefined : 'success'"
      />
    </div>

    <!-- Batch download -->
    <div class="batch-actions" v-if="store.completedCount > 0">
      <el-button type="primary" plain :icon="Download" @click="downloadAllZip" size="small">
        批量下载 ZIP
      </el-button>
      <el-button plain :icon="Refresh" @click="store.reset" size="small">清空结果</el-button>
    </div>

    <!-- Grid -->
    <div class="candidates-grid">
      <CandidateCard
        v-for="candidate in store.candidates"
        :key="candidate.id"
        :candidate="candidate"
        :task-name="store.taskName"
        :exp-mode="store.expMode"
        :steps="store.candidateSteps[candidate.id] || candidate.result?._steps || []"
        @preview="openPreview"
      />
    </div>

    <!-- Image preview dialog (src can be base64 data URI or /images/... URL) -->
    <el-dialog v-model="previewVisible" width="80%" :show-close="true" destroy-on-close>
      <img :src="previewImage" style="width:100%" />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Download, Refresh } from '@element-plus/icons-vue'
import { useGenerateStore } from '@/stores/generateStore.js'
import CandidateCard from './CandidateCard.vue'

const store = useGenerateStore()
const previewVisible = ref(false)
const previewImage = ref('')

function openPreview(base64) {
  previewImage.value = base64
  previewVisible.value = true
}

async function downloadAllZip() {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const t = store.taskName

  for (const candidate of store.candidates) {
    if (candidate.status !== 'completed' || !candidate.result) continue
    const r = candidate.result
    let img = null
    for (let i = 3; i >= 0; i--) {
      if (r[`target_${t}_critic_desc${i}_base64_jpg`]) {
        img = r[`target_${t}_critic_desc${i}_base64_jpg`]; break
      }
    }
    img = img || r[`target_${t}_stylist_desc0_base64_jpg`] || r[`target_${t}_desc0_base64_jpg`]
    if (img) {
      zip.file(`candidate_${candidate.id + 1}.png`, img, { base64: true })
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `papersketch_candidates_${Date.now()}.zip`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.overall-progress {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 16px;
}
.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #374151;
  margin-bottom: 8px;
}
.elapsed { color: #9ca3af; }
.batch-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.candidates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
</style>
