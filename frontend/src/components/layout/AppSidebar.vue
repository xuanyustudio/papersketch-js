<template>
  <div class="sidebar">
    <div class="logo" @click="$emit('toggle')">
      <span class="logo-icon">🍌</span>
      <span v-if="!collapsed" class="logo-text">PaperSketch JS</span>
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
      <a
        href="https://github.com/dwzhu-pku/PaperBanana"
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
.logo-text {
  color: #facc15;
  font-weight: 700;
  font-size: 16px;
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
.github-link {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #78716c;
  text-decoration: none;
  font-size: 13px;
  transition: color 0.2s;
}
.github-link:hover { color: #d6d3d1; }
</style>
