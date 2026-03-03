<template>
  <div class="header-content">
    <div class="header-title">
      <span class="route-name">{{ routeTitle }}</span>
    </div>
    <div class="header-right">
      <el-tag v-if="isConnected" type="success" size="small" effect="light">
        <el-icon><Connection /></el-icon> 已连接
      </el-tag>
      <el-tag v-else type="danger" size="small" effect="light">
        <el-icon><CircleClose /></el-icon> 未连接
      </el-tag>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useWebSocket } from '@/composables/useWebSocket.js'

const route = useRoute()
const { isConnected } = useWebSocket()
const routeTitle = computed(() => route.meta?.title || '智绘论文图')
</script>

<style scoped>
.header-content {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.route-name {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
