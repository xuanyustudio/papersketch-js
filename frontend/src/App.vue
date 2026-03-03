<template>
  <el-container class="app-layout">
    <el-aside :width="sidebarCollapsed ? '64px' : '220px'" class="app-sidebar">
      <AppSidebar :collapsed="sidebarCollapsed" @toggle="sidebarCollapsed = !sidebarCollapsed" />
    </el-aside>
    <el-container>
      <el-header class="app-header">
        <AppHeader />
      </el-header>
      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElNotification } from 'element-plus'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import api from '@/api/index.js'

const sidebarCollapsed = ref(false)

onMounted(async () => {
  try {
    const res = await api.health()
    if (!res?.data?.envFileExists) {
      ElNotification({
        title: '缺少 .env 配置文件',
        message: '后端未检测到 backend/.env，请参考 backend/.env.example 创建 .env 后重启后端。',
        type: 'warning',
        duration: 0,
      })
    }
  } catch {
    // ignore health check failures here
  }
})
</script>

<style scoped>
.app-layout {
  height: 100vh;
  overflow: hidden;
}
.app-sidebar {
  background: #1c1917;
  transition: width 0.2s;
  overflow: hidden;
}
.app-header {
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  padding: 0 24px;
  height: var(--header-height);
  display: flex;
  align-items: center;
}
.app-main {
  background: #f9fafb;
  overflow-y: auto;
  padding: 24px;
}
</style>
