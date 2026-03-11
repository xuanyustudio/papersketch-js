<template>
  <div class="sidebar">
    <div class="logo" @click="$emit('toggle')">
      <span class="logo-icon">🍌</span>
      <div v-if="!collapsed" class="logo-text-wrap">
        <span class="logo-text-main">智绘论文图</span>
        <span class="logo-text-sub">PaperSketch</span>
      </div>
    </div>

    <el-menu
      :default-active="activeRoute"
      :collapse="collapsed"
      background-color="transparent"
      text-color="#64748b"
      active-text-color="#0891B2"
      router
      class="sidebar-menu"
    >
      <el-menu-item index="/generate">
        <el-icon><DataAnalysis /></el-icon>
        <template #title>生成候选图表</template>
      </el-menu-item>

      <el-menu-item index="/refine">
        <el-icon><MagicStick /></el-icon>
        <template #title>图片精炼升级</template>
      </el-menu-item>

      <el-menu-item index="/history">
        <el-icon><Clock /></el-icon>
        <template #title>历史记录</template>
      </el-menu-item>

      <el-menu-item v-if="isAdmin" index="/admin">
        <el-icon><Setting /></el-icon>
        <template #title>管理后台</template>
      </el-menu-item>
    </el-menu>

    <div class="sidebar-bottom">
      <router-link
        to="/help"
        class="help-link"
        :title="collapsed ? '帮助中心' : ''"
      >
        <el-icon><QuestionFilled /></el-icon>
        <span v-if="!collapsed">帮助中心</span>
      </router-link>
      <div class="bottom-divider" />
      <a
        href="https://github.com/xuanyustudio/papersketch-js"
        target="_blank"
        class="github-link"
        :title="collapsed ? 'GitHub' : ''"
      >
        <el-icon><Link /></el-icon>
        <span v-if="!collapsed">GitHub</span>
      </a>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore.js'

defineProps({ collapsed: Boolean })
defineEmits(['toggle'])

const route = useRoute()
const authStore = useAuthStore()
const activeRoute = computed(() => route.path)
const isAdmin = computed(() => authStore.user?.is_admin === 1)
</script>

<style scoped>
.sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-right: 1px solid #f1f5f9;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 16px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid #f1f5f9;
}

.logo:hover {
  background: #f8fafc;
}

.logo-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.logo-text-wrap {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.logo-text-main {
  color: #164E63;
  font-weight: 700;
  font-size: 16px;
  white-space: nowrap;
}

.logo-text-sub {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.3px;
}

.sidebar-menu {
  flex: 1;
  border-right: none;
  padding: 12px 8px;
}

.sidebar-menu :deep(.el-menu-item) {
  height: 48px;
  line-height: 48px;
  border-radius: 12px;
  margin: 4px 0;
  color: #64748b;
  font-weight: 500;
  transition: all 0.2s;
}

.sidebar-menu :deep(.el-menu-item:hover) {
  background: #f1f5f9;
  color: #0891B2;
}

.sidebar-menu :deep(.el-menu-item.is-active) {
  background: linear-gradient(135deg, rgba(8, 145, 178, 0.1) 0%, rgba(8, 145, 178, 0.05) 100%);
  color: #0891B2;
  font-weight: 600;
}

.sidebar-menu :deep(.el-menu-item.is-active)::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 24px;
  background: #0891B2;
  border-radius: 0 4px 4px 0;
}

.sidebar-menu :deep(.el-icon) {
  font-size: 20px;
}

.sidebar-bottom {
  padding: 16px;
  border-top: 1px solid #f1f5f9;
}

.help-link,
.github-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  color: #64748b;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.help-link:hover,
.github-link:hover {
  background: #f1f5f9;
  color: #0891B2;
}

.bottom-divider {
  height: 1px;
  background: #f1f5f9;
  margin: 12px 0;
}
</style>
