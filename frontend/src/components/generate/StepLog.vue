<template>
  <div v-if="steps && steps.length" class="step-log">
    <el-collapse>
      <el-collapse-item>
        <template #title>
          <span class="step-log-title">
            <el-icon><List /></el-icon>
            步骤日志（{{ steps.length }} 步）
          </span>
        </template>

        <div class="step-timeline">
          <div
            v-for="(s, idx) in steps"
            :key="idx"
            class="step-item"
            :class="{ 'is-error': s.status === 'error' }"
          >
            <!-- Connector line -->
            <div class="step-line-wrap">
              <div class="step-dot" :class="dotClass(s)" />
              <div v-if="idx < steps.length - 1" class="step-connector" />
            </div>

            <!-- Content -->
            <div class="step-content">
              <div class="step-header">
                <span class="step-label">{{ s.label || s.name }}</span>
                <el-tag size="small" :type="s.status === 'error' ? 'danger' : 'info'" class="step-duration">
                  {{ formatDuration(s.durationMs) }}
                </el-tag>
              </div>

              <!-- Retriever output -->
              <template v-if="s.output?.type === 'retriever'">
                <div class="step-output retriever">
                  <span>检索到 <b>{{ s.output.count }}</b> 个参考示例</span>
                  <span v-if="s.output.example_names?.length" class="example-names">
                    {{ s.output.example_names.join('、') }}
                  </span>
                </div>
              </template>

              <!-- Text output (Planner / Stylist) -->
              <template v-else-if="s.output?.type === 'text' && s.output.text">
                <el-collapse class="inner-collapse">
                  <el-collapse-item :title="`📝 查看描述文字（${s.output.text.length} 字符）`">
                    <pre class="output-pre">{{ s.output.text }}</pre>
                  </el-collapse-item>
                </el-collapse>
              </template>

              <!-- Image output (Visualizer) -->
              <template v-else-if="s.output?.type === 'image'">
                <div class="step-output image-output">
                  <template v-if="s.output.image_url">
                    <img
                      :src="s.output.image_url"
                      class="step-thumbnail"
                      @click="$emit('preview', s.output.image_url)"
                      title="点击查看大图"
                    />
                    <span class="thumb-hint">轮次 {{ s.output.round + 1 }} 生成图像</span>
                  </template>
                  <span v-else class="no-img-hint">图像生成中或失败</span>
                </div>
                <el-collapse v-if="s.output.desc_text" class="inner-collapse">
                  <el-collapse-item :title="`📝 使用的描述（${s.output.desc_text.length} 字符）`">
                    <pre class="output-pre">{{ s.output.desc_text }}</pre>
                  </el-collapse-item>
                </el-collapse>
              </template>

              <!-- Critic output -->
              <template v-else-if="s.output?.type === 'critic'">
                <div v-if="s.output.early_stop" class="step-output early-stop">
                  ✅ Critic 认为无需修改，提前结束
                </div>
                <template v-else>
                  <el-collapse class="inner-collapse" v-if="s.output.suggestions">
                    <el-collapse-item :title="`💬 Critic 建议（${s.output.suggestions.length} 字符）`">
                      <pre class="output-pre">{{ s.output.suggestions }}</pre>
                    </el-collapse-item>
                  </el-collapse>
                  <el-collapse class="inner-collapse" v-if="s.output.revised_desc">
                    <el-collapse-item :title="`🔄 修订后描述（${s.output.revised_desc.length} 字符）`">
                      <pre class="output-pre">{{ s.output.revised_desc }}</pre>
                    </el-collapse-item>
                  </el-collapse>
                </template>
              </template>

              <!-- Error -->
              <div v-if="s.status === 'error'" class="step-error">
                ❌ {{ s.output?.error || '步骤失败' }}
              </div>
            </div>
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup>
import { List } from '@element-plus/icons-vue'

defineProps({
  steps: { type: Array, default: () => [] },
})
defineEmits(['preview'])

function dotClass(step) {
  if (step.status === 'error') return 'dot-error'
  if (step.output?.type === 'image') return 'dot-image'
  if (step.output?.type === 'critic') return 'dot-critic'
  if (step.output?.type === 'retriever') return 'dot-retriever'
  return 'dot-text'
}

function formatDuration(ms) {
  if (!ms && ms !== 0) return ''
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`
}
</script>

<style scoped>
.step-log {
  border-top: 1px solid #f3f4f6;
  padding: 0 14px 10px;
}
.step-log-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
}

/* Timeline layout */
.step-timeline {
  padding: 4px 0 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.step-item {
  display: flex;
  gap: 10px;
}
.step-line-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 16px;
  flex-shrink: 0;
}
.step-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px;
}
.dot-text     { background: #60a5fa; }
.dot-image    { background: #34d399; }
.dot-critic   { background: #f59e0b; }
.dot-retriever{ background: #a78bfa; }
.dot-error    { background: #f87171; }

.step-connector {
  width: 2px;
  flex: 1;
  min-height: 12px;
  background: #e5e7eb;
  margin: 2px 0 2px;
}

/* Step content */
.step-content {
  flex: 1;
  padding-bottom: 12px;
  min-width: 0;
}
.step-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}
.step-label {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}
.step-duration { font-size: 10px; }

.step-output {
  font-size: 11px;
  color: #6b7280;
  line-height: 1.5;
}
.retriever { display: flex; flex-direction: column; gap: 2px; }
.example-names {
  color: #9ca3af;
  word-break: break-all;
  font-size: 10px;
}

.image-output {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.step-thumbnail {
  width: 100%;
  max-width: 200px;
  border-radius: 4px;
  cursor: zoom-in;
  border: 1px solid #e5e7eb;
}
.thumb-hint { font-size: 10px; color: #9ca3af; }
.no-img-hint { color: #d1d5db; font-style: italic; }
.early-stop { color: #059669; font-size: 11px; }

.step-error {
  font-size: 11px;
  color: #ef4444;
  margin-top: 2px;
}

/* Inner collapses */
.inner-collapse { margin-top: 4px; }
:deep(.inner-collapse .el-collapse-item__header) {
  font-size: 11px;
  color: #6b7280;
  height: 28px;
  line-height: 28px;
  padding: 0 8px;
  background: #f9fafb;
  border-radius: 4px;
}
:deep(.inner-collapse .el-collapse-item__content) {
  padding: 6px 8px 4px;
}

.output-pre {
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-word;
  color: #374151;
  max-height: 240px;
  overflow-y: auto;
  line-height: 1.6;
  margin: 0;
  background: #f9fafb;
  padding: 6px 8px;
  border-radius: 4px;
}
</style>
