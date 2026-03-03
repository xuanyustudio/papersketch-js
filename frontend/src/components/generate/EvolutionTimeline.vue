<template>
  <div v-if="stages.length > 1">
    <el-collapse>
      <el-collapse-item :title="`查看演化时间线（${stages.length} 阶段）`" name="timeline">
        <div v-for="(stage, idx) in stages" :key="stage.key" class="stage-item">
          <div class="stage-header">
            <el-tag :type="stageTagType(stage.name)" size="small">{{ stage.name }}</el-tag>
            <span class="stage-desc">{{ stage.description }}</span>
          </div>

          <img
            v-if="stage.imageBase64"
            :src="`data:image/jpeg;base64,${stage.imageBase64}`"
            class="stage-image"
            loading="lazy"
          />

          <el-collapse v-if="stage.description_text || stage.suggestions">
            <el-collapse-item title="📝 描述文字" name="desc" v-if="stage.description_text">
              <pre class="desc-text">{{ stage.description_text }}</pre>
            </el-collapse-item>
            <el-collapse-item title="💡 Critic 建议" name="sugg" v-if="stage.suggestions">
              <pre class="desc-text" :class="{ 'text-green': stage.suggestions.trim() === 'No changes needed.' }">
                {{ stage.suggestions }}
              </pre>
            </el-collapse-item>
          </el-collapse>

          <el-divider v-if="idx < stages.length - 1" />
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  result: { type: Object, required: true },
  taskName: { type: String, default: 'diagram' },
  expMode: { type: String, default: 'demo_full' },
})

const stages = computed(() => {
  const r = props.result
  const t = props.taskName
  const list = []

  // Planner
  if (r[`target_${t}_desc0_base64_jpg`]) {
    list.push({
      key: 'planner',
      name: '📋 Planner',
      description: '初始图像规划描述',
      imageBase64: r[`target_${t}_desc0_base64_jpg`],
      description_text: r[`target_${t}_desc0`],
    })
  }

  // Stylist (only in demo_full)
  if (props.expMode === 'demo_full' && r[`target_${t}_stylist_desc0_base64_jpg`]) {
    list.push({
      key: 'stylist',
      name: '✨ Stylist',
      description: '风格优化后的描述',
      imageBase64: r[`target_${t}_stylist_desc0_base64_jpg`],
      description_text: r[`target_${t}_stylist_desc0`],
    })
  }

  // Critic rounds
  for (let i = 0; i < 4; i++) {
    if (r[`target_${t}_critic_desc${i}_base64_jpg`]) {
      list.push({
        key: `critic_${i}`,
        name: `🔍 Critic 第 ${i + 1} 轮`,
        description: `Critic 反馈后重新生成`,
        imageBase64: r[`target_${t}_critic_desc${i}_base64_jpg`],
        description_text: r[`target_${t}_critic_desc${i}`],
        suggestions: r[`target_${t}_critic_suggestions${i}`],
      })
    }
  }

  return list
})

function stageTagType(name) {
  if (name.includes('Planner')) return 'info'
  if (name.includes('Stylist')) return 'warning'
  if (name.includes('Critic')) return 'success'
  return 'default'
}
</script>

<style scoped>
.stage-item { padding: 12px 0; }
.stage-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.stage-desc { font-size: 12px; color: #6b7280; }
.stage-image {
  width: 100%;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  margin-bottom: 8px;
}
.desc-text {
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  color: #374151;
  max-height: 200px;
  overflow-y: auto;
}
.text-green { color: #16a34a; }
</style>
