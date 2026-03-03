<template>
  <div class="sidebar">
    <div class="logo" @click="$emit('toggle')">
      <span class="logo-icon">🍌</span>
      <div v-if="!collapsed" class="logo-text-wrap">
        <span class="logo-text-main">智绘论文图</span>
        <span class="logo-text-sub">PaperSketch JS</span>
      </div>
    </div>

    <el-menu
      :default-active="activeRoute"
      :collapse="collapsed"
      background-color="#1c1917"
      text-color="#d6d3d1"
      active-text-color="#facc15"
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

defineProps({ collapsed: Boolean })
defineEmits(['toggle'])

const route = useRoute()
const activeRoute = computed(() => route.path)
</script>

<style scoped>
.sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.logo {
  height: var(--header-height);
  display: flex;
  align-items: center;
  padding: 0 16px;
  cursor: pointer;
  border-bottom: 1px solid #292524;
  gap: 10px;
  flex-shrink: 0;
}
.logo-icon { font-size: 22px; }
.logo-text-wrap {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
  min-width: 0;
}
.logo-text-main {
  color: #facc15;
  font-weight: 800;
  font-size: 17px;
  line-height: 1.05;
  white-space: nowrap;
}
.logo-text-sub {
  color: #78716c;
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0.2px;
  margin-top: 3px;
  white-space: nowrap;
}
.sidebar-menu {
  border-right: none;
  flex: 1;
}
.sidebar-bottom {
  padding: 12px 16px;
  border-top: 1px solid #292524;
}
.help-link,
.github-link {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #78716c;
  text-decoration: none;
  font-size: 13px;
  transition: color 0.2s;
}
.help-link:hover,
.github-link:hover { color: #d6d3d1; }
.bottom-divider {
  height: 1px;
  background: #292524;
  margin: 10px 0 8px;
}
</style>
