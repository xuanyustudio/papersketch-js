<template>
  <div class="header-content">
    <div class="header-title">
      <span class="route-name">{{ routeTitle }}</span>
    </div>
    <div class="header-right">
      <!-- 用户信息 -->
      <el-dropdown v-if="authStore.user" @command="handleUserCommand">
        <div class="user-info">
          <el-avatar :size="32" :icon="UserFilled" />
          <span class="username">{{ authStore.user.name || authStore.user.email }}</span>
          <el-tag type="warning" size="small">积分: {{ authStore.user.points || 0 }}</el-tag>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item disabled>
              <div class="user-dropdown-info">
                <strong>{{ authStore.user.name }}</strong>
                <span>{{ authStore.user.email }}</span>
                <span>积分余额: <strong>{{ authStore.user.points || 0 }}</strong></span>
              </div>
            </el-dropdown-item>
            <el-dropdown-item divided command="logout">
              <el-icon><SwitchButton /></el-icon>
              退出登录
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      
      <el-tag v-if="isConnected" type="success" size="small" effect="light">
        <el-icon><Connection /></el-icon> 已连接
      </el-tag>
      <el-tag v-else type="danger" size="small" effect="light">
        <el-icon><CircleClose /></el-icon> 未连接
      </el-tag>
    </div>
    
    <!-- 创建组织对话框 -->
    <el-dialog v-model="showCreateOrg" title="创建新组织" width="400px">
      <el-form @submit.prevent="handleCreateOrg">
        <el-form-item label="组织名称">
          <el-input v-model="newOrgName" placeholder="请输入组织名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateOrg = false">取消</el-button>
        <el-button type="primary" @click="handleCreateOrg" :loading="authStore.loading">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWebSocket } from '@/composables/useWebSocket.js'
import { useAuthStore } from '@/stores/authStore.js'
import { UserFilled, OfficeBuilding, ArrowDown, Plus, SwitchButton, Connection, CircleClose } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { isConnected } = useWebSocket()

const showCreateOrg = ref(false)
const newOrgName = ref('')

const routeTitle = computed(() => route.meta?.title || '智绘论文图')

function handleOrgChange(org) {
  if (org === '__create__') {
    showCreateOrg.value = true
  } else {
    authStore.setCurrentOrganization(org)
  }
}

async function handleCreateOrg() {
  if (!newOrgName.value.trim()) {
    ElMessage.warning('请输入组织名称')
    return
  }
  const org = await authStore.createOrganization(newOrgName.value.trim())
  if (org) {
    ElMessage.success('组织创建成功')
    showCreateOrg.value = false
    newOrgName.value = ''
  }
}

function handleUserCommand(command) {
  if (command === 'logout') {
    authStore.logout()
    router.push('/login')
  }
}
</script>

<style scoped>
.header-content {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.route-name {
  font-size: 18px;
  font-weight: 600;
  color: #164E63;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 12px;
  transition: all 0.2s;
}
.user-info:hover {
  background: #F1F5F9;
}
.username {
  font-size: 14px;
  font-weight: 500;
  color: #334155;
}
.org-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 160px;
  gap: 8px;
}
.user-dropdown-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 0;
}
.user-dropdown-info strong {
  font-size: 14px;
  color: #1E293B;
}
.user-dropdown-info span {
  font-size: 12px;
  color: #64748B;
}
</style>
