<template>
  <div v-if="route.path === '/login'">
    <router-view />
  </div>
  <div v-else-if="!authStore.isLoggedIn">
    <router-view />
  </div>
  <div v-else>
    <el-container class="app-layout">
      <el-aside :width="sidebarCollapsed ? '72px' : '240px'" class="app-sidebar">
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore.js'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppHeader from '@/components/layout/AppHeader.vue'

const route = useRoute()
const authStore = useAuthStore()
const sidebarCollapsed = ref(false)

onMounted(async () => {
  // 初始化 auth store
  if (authStore.token) {
    await authStore.init()
  }
})
</script>

<style scoped>
.app-layout {
  height: 100vh;
  overflow: hidden;
  background: #F8FAFC;
}
.app-sidebar {
  background: #ffffff;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  box-shadow: 1px 0 3px rgba(0, 0, 0, 0.02);
}
.app-header {
  background: #ffffff;
  border-bottom: 1px solid #f1f5f9;
  padding: 0 32px;
  height: var(--header-height);
  display: flex;
  align-items: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}
.app-main {
  background: linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%);
  overflow-y: auto;
  padding: 24px 32px;
}
</style>
