<template>
  <el-form label-position="top" size="small" class="settings-form">
    <el-form-item>
      <template #label>
        <span class="label-with-help">
          流水线模式
          <el-popover placement="right" trigger="hover" width="420">
            <template #reference>
              <el-icon class="help-icon"><QuestionFilled /></el-icon>
            </template>
            <div class="pipeline-help">
              <div><b>Retriever：</b>找参考样例</div>
              <div><b>Planner：</b>生成详细文字描述（图该怎么画）</div>
              <div><b>Stylist：</b>润色这段描述（风格规范）</div>
              <div><b>Visualizer：</b>根据描述生成图（plot 任务这里会用 Plotly spec + 后端渲染）</div>
              <div><b>Critic：</b>看图给修改意见，再迭代</div>
            </div>
          </el-popover>
        </span>
      </template>
      <el-select v-model="store.expMode" style="width:100%">
        <el-option
          v-for="mode in modeOptions"
          :key="mode.value"
          :value="mode.value"
          :label="mode.label"
        />
      </el-select>
      <div class="hint">{{ modeHints[store.expMode] }}</div>
      <div class="hint mode-detail">{{ modeDetails[store.expMode] }}</div>
    </el-form-item>

    <el-form-item label="检索策略">
      <el-select v-model="store.retrievalSetting" style="width:100%">
        <el-option value="auto" label="自动检索（推荐）" />
        <el-option value="random" label="随机参考" />
        <el-option value="none" label="不使用参考" />
      </el-select>
    </el-form-item>

    <el-form-item label="任务类型">
      <el-radio-group v-model="store.taskName">
        <el-radio-button value="diagram">图表（Diagram）</el-radio-button>
        <el-radio-button value="plot">统计图（Plot）</el-radio-button>
      </el-radio-group>
    </el-form-item>

    <el-form-item label="候选数量">
      <el-slider v-model="store.numCandidates" :min="1" :max="5" :step="1" show-input input-size="small" />
      <div class="hint">建议 2-4。候选越多耗时与模型调用成本越高。</div>
    </el-form-item>

    <el-form-item label="宽高比">
      <el-select v-model="store.aspectRatio" style="width:100%">
        <el-option value="16:9" label="16:9（宽屏）" />
        <el-option value="21:9" label="21:9（超宽屏）" />
        <el-option value="3:2" label="3:2（标准）" />
        <el-option value="1:1" label="1:1（正方形）" />
      </el-select>
    </el-form-item>

    <el-form-item label="Critic 最大轮数">
      <el-slider v-model="store.maxCriticRounds" :min="1" :max="3" :step="1" show-input input-size="small" />
      <div class="hint">
        含义：每个候选最多允许 Critic 进行几轮“审查 → 提建议 → 重绘”。轮数越高，质量可能提升，但耗时和成本也会明显增加。
      </div>
    </el-form-item>

    <!-- 图像生成模型选择 -->
    <el-form-item label="图像生成模型">
      <el-select
        v-model="store.imageModelName"
        style="width:100%"
        :placeholder="`使用默认模型（${defaultImageModelId}）`"
        clearable
        :loading="modelsLoading"
      >
        <el-option
          v-for="m in imageModels"
          :key="m.id"
          :value="m.id"
          :disabled="!m.available"
        >
          <span>{{ m.label }}</span>
          <el-tag
            v-if="!m.available"
            size="small"
            type="danger"
            style="margin-left:8px;font-size:10px;"
          >暂不可用</el-tag>
          <el-tag
            v-else
            size="small"
            type="success"
            style="margin-left:8px;font-size:10px;"
          >可用</el-tag>
        </el-option>
      </el-select>
      <div class="hint">
        留空使用服务端默认（{{ defaultModelLabel }} / {{ defaultImageModelId }}）；灰色选项表示对应 API Key 未配置
      </div>
    </el-form-item>

    <el-form-item label="文本模型名称（可选）">
      <el-input
        v-model="store.modelName"
        placeholder="留空使用默认文本模型"
        clearable
      />
    </el-form-item>
  </el-form>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { QuestionFilled } from '@element-plus/icons-vue'
import { useGenerateStore } from '@/stores/generateStore.js'
import api from '@/api/index.js'
import {
  EXP_MODE_OPTIONS,
  EXP_MODE_HINTS,
  EXP_MODE_DETAILS,
  normalizeExpMode,
} from '@/constants/expModes.js'

const store = useGenerateStore()

const modeOptions = EXP_MODE_OPTIONS
const modeHints = EXP_MODE_HINTS
const modeDetails = EXP_MODE_DETAILS

// Module-level cache: shared across all instances of this component
let _cachedModels = null
let _fetchPromise = null
let _cachedDefaultImageModelId = ''

const imageModels = ref([])
const modelsLoading = ref(false)

const fetchedDefaultImageModelId = ref(_cachedDefaultImageModelId || '')
const defaultModel = computed(() => imageModels.value.find((m) => m.isDefault))
const defaultImageModelId = computed(() =>
  defaultModel.value?.id || fetchedDefaultImageModelId.value || '未配置'
)

const defaultModelLabel = computed(() => {
  const cur = imageModels.value.find((m) => m.id === store.imageModelName)
  if (cur) return cur.label
  if (defaultModel.value?.label) return defaultModel.value.label
  const fallback = imageModels.value.find((m) => m.id === defaultImageModelId.value)
  return fallback?.label || '服务端配置'
})

onMounted(async () => {
  // Backward compatibility: normalize legacy expMode aliases from history/data.
  store.expMode = normalizeExpMode(store.expMode)
  if (_cachedModels) {
    imageModels.value = _cachedModels
    fetchedDefaultImageModelId.value = _cachedDefaultImageModelId || ''
    return
  }
  // Deduplicate concurrent requests when multiple instances mount simultaneously
  if (!_fetchPromise) {
    _fetchPromise = api.getImageModels().then((res) => {
      _cachedModels = res.data || []
      _cachedDefaultImageModelId = res.meta?.defaultImageModelName || ''
      return _cachedModels
    }).catch(() => {
      _fetchPromise = null
      return []
    })
  }
  modelsLoading.value = true
  try {
    imageModels.value = await _fetchPromise
    fetchedDefaultImageModelId.value = _cachedDefaultImageModelId || ''
  } finally {
    modelsLoading.value = false
  }
})
</script>

<style scoped>
.settings-form { padding: 4px 0; }
.label-with-help {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.help-icon {
  color: #9ca3af;
  cursor: help;
  font-size: 14px;
}
.pipeline-help {
  font-size: 12px;
  color: #4b5563;
  line-height: 1.65;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.hint {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 4px;
  line-height: 1.4;
}
.mode-detail {
  color: #6b7280;
}
</style>
