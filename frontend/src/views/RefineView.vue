<template>
  <div class="refine-view">
    <div class="view-layout">
      <!-- Left: Upload + Settings -->
      <div class="left-panel">
        <el-card>
          <template #header><span class="card-title">📤 上传图片</span></template>

          <el-upload
            class="upload-area"
            drag
            :auto-upload="false"
            accept="image/png,image/jpeg"
            :show-file-list="false"
            :on-change="handleFileChange"
          >
            <div v-if="!store.originalImageUrl" class="upload-inner">
              <el-icon size="48" color="#d1d5db"><UploadFilled /></el-icon>
              <p class="upload-tip">拖拽或点击上传图片</p>
              <p class="upload-sub">支持 PNG / JPG，最大 10MB</p>
            </div>
            <img v-else :src="store.originalImageUrl" class="preview-img" />
          </el-upload>

          <el-button v-if="store.originalImageUrl" text type="danger" size="small" @click="store.reset" class="clear-btn">
            移除图片
          </el-button>
        </el-card>

        <el-card>
          <template #header><span class="card-title">✏️ 修改描述</span></template>
          <el-form label-position="top">
            <el-form-item label="描述期望的变化">
              <el-input
                v-model="editPrompt"
                type="textarea"
                :rows="5"
                placeholder="例如：改善配色方案，使用更专业的学术风格。保持所有内容不变，仅提升分辨率。"
                resize="vertical"
              />
            </el-form-item>

            <el-form-item label="任务类型">
              <el-radio-group v-model="taskName">
                <el-radio-button value="diagram">图表</el-radio-button>
                <el-radio-button value="plot">统计图</el-radio-button>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="输出宽高比">
              <el-select v-model="aspectRatio">
                <el-option value="16:9" label="16:9" />
                <el-option value="21:9" label="21:9" />
                <el-option value="3:2" label="3:2" />
              </el-select>
            </el-form-item>
          </el-form>
        </el-card>

        <el-button
          type="primary"
          size="large"
          :loading="store.isRefining"
          :disabled="!store.originalImageUrl || !editPrompt.trim()"
          class="refine-btn"
          @click="handleRefine"
        >
          {{ store.isRefining ? 'AI 精炼中...' : '✨ 开始精炼' }}
        </el-button>

        <el-alert v-if="store.error" :title="store.error" type="error" show-icon closable />
      </div>

      <!-- Right: Results comparison -->
      <div class="right-panel">
        <template v-if="store.refinedImageUrl">
          <!-- Suggestions -->
          <el-card class="suggestions-card" v-if="store.suggestions">
            <template #header><span class="card-title">💡 AI 改进建议</span></template>
            <pre class="suggestions-text" :class="{ 'no-changes': store.noChanges }">{{ store.suggestions }}</pre>
            <el-tag v-if="store.noChanges" type="success" class="mt-2">已符合风格标准，返回原图</el-tag>
          </el-card>

          <!-- Before / After -->
          <el-card>
            <template #header>
              <div class="result-header">
                <span class="card-title">🎨 精炼结果</span>
                <span class="time-info">耗时 {{ (store.processingTimeMs / 1000).toFixed(1) }}s</span>
              </div>
            </template>

            <div class="comparison-grid">
              <div class="comparison-item">
                <p class="comparison-label">原图</p>
                <img :src="store.originalImageUrl" class="comparison-img" />
              </div>
              <div class="comparison-item">
                <p class="comparison-label">精炼后</p>
                <img :src="store.refinedImageUrl" class="comparison-img" />
                <el-button
                  type="primary"
                  size="small"
                  :icon="Download"
                  class="download-btn"
                  @click="downloadRefined"
                >
                  下载精炼图片
                </el-button>
              </div>
            </div>
          </el-card>
        </template>

        <div v-else class="empty-state">
          <el-icon size="64" color="#d1d5db"><MagicStick /></el-icon>
          <p>上传图片并描述修改需求，AI 将为您精炼升级</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Download } from '@element-plus/icons-vue'
import { useRefineStore } from '@/stores/refineStore.js'

const store = useRefineStore()
const editPrompt = ref('')
const taskName = ref('diagram')
const aspectRatio = ref('16:9')
let currentFile = null

function handleFileChange(file) {
  currentFile = file.raw
  const reader = new FileReader()
  reader.onload = (e) => store.setOriginalImage(e.target.result)
  reader.readAsDataURL(file.raw)
}

async function handleRefine() {
  if (!currentFile) return
  await store.refine({
    file: currentFile,
    editPrompt: editPrompt.value,
    aspectRatio: aspectRatio.value,
    taskName: taskName.value,
  })
}

function downloadRefined() {
  const a = document.createElement('a')
  a.href = store.refinedImageUrl
  a.download = `refined_${Date.now()}.png`
  a.click()
}
</script>

<style scoped>
.refine-view { height: 100%; }
.view-layout {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 20px;
}
.left-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}
.right-panel { overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
.card-title { font-weight: 600; font-size: 14px; }
.upload-area { width: 100%; }
.upload-inner {
  padding: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.upload-tip { font-size: 14px; font-weight: 500; color: #374151; }
.upload-sub { font-size: 12px; color: #9ca3af; }
.preview-img { width: 100%; max-height: 200px; object-fit: contain; display: block; }
.clear-btn { margin-top: 8px; }
.refine-btn { width: 100%; height: 44px; font-size: 15px; font-weight: 600; }

.suggestions-text {
  font-size: 13px;
  white-space: pre-wrap;
  color: #374151;
  line-height: 1.6;
  max-height: 200px;
  overflow-y: auto;
}
.no-changes { color: #16a34a; }
.result-header { display: flex; justify-content: space-between; align-items: center; }
.time-info { font-size: 12px; color: #9ca3af; }
.comparison-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.comparison-label { font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 8px; }
.comparison-img { width: 100%; border-radius: 6px; border: 1px solid #e5e7eb; display: block; }
.download-btn { margin-top: 10px; width: 100%; }
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
