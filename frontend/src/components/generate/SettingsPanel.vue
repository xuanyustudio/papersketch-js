<template>
  <el-form label-position="top" size="small" class="settings-form">
    <el-form-item label="流水线模式">
      <el-select v-model="store.expMode" style="width:100%">
        <el-option value="demo_planner_critic" label="Planner → Critic（推荐）" />
        <el-option value="demo_full" label="Full Pipeline（含 Stylist）" />
        <el-option value="vanilla" label="Vanilla（直接生成）" />
      </el-select>
      <div class="hint">{{ modeHints[store.expMode] }}</div>
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
      <el-slider v-model="store.numCandidates" :min="1" :max="20" :step="1" show-input input-size="small" />
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
      <el-slider v-model="store.maxCriticRounds" :min="1" :max="5" :step="1" show-input input-size="small" />
    </el-form-item>

    <!-- 图像生成模型选择 -->
    <el-form-item label="图像生成模型">
      <el-select
        v-model="store.imageModelName"
        style="width:100%"
        placeholder="使用默认模型"
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
        留空使用服务端默认（当前：{{ defaultModelLabel }}）；灰色选项表示对应 API Key 未配置
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
import { useGenerateStore } from '@/stores/generateStore.js'
import api from '@/api/index.js'

const store = useGenerateStore()

const modeHints = {
  demo_planner_critic: 'Planner → Visualizer → Critic 迭代（速度最快）',
  demo_full: 'Retriever → Planner → Stylist → Visualizer → Critic 完整流水线',
  vanilla: '直接用图像生成模型输出，无规划（用于对比测试）',
}

// Module-level cache: shared across all instances of this component
let _cachedModels = null
let _fetchPromise = null

const imageModels = ref([])
const modelsLoading = ref(false)

const defaultModelLabel = computed(() => {
  const cur = imageModels.value.find((m) => m.id === store.imageModelName)
  return cur ? cur.label : '服务端配置'
})

onMounted(async () => {
  if (_cachedModels) {
    imageModels.value = _cachedModels
    return
  }
  // Deduplicate concurrent requests when multiple instances mount simultaneously
  if (!_fetchPromise) {
    _fetchPromise = api.getImageModels().then((res) => {
      _cachedModels = res.data || []
      return _cachedModels
    }).catch(() => {
      _fetchPromise = null
      return []
    })
  }
  modelsLoading.value = true
  try {
    imageModels.value = await _fetchPromise
  } finally {
    modelsLoading.value = false
  }
})
</script>

<style scoped>
.settings-form { padding: 4px 0; }
.hint {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 4px;
  line-height: 1.4;
}
</style>
