<template>
  <div class="admin-view">
    <div class="page-header">
      <h2>用户管理</h2>
    </div>

    <el-table :data="users" v-loading="loading" stripe>
      <el-table-column label="ID" prop="id" width="60" />
      <el-table-column label="邮箱" prop="email" min-width="180" />
      <el-table-column label="用户名" prop="name" width="120" />
      <el-table-column label="积分" width="100">
        <template #default="{ row }">
          <el-tag type="warning">{{ row.points }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="管理员" width="80">
        <template #default="{ row }">
          <el-tag :type="row.is_admin ? 'success' : 'info'" size="small">
            {{ row.is_admin ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="注册时间" width="160">
        <template #default="{ row }">
          {{ formatTime(row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-button size="small" type="primary" @click="openUserDetail(row)">
            详情
          </el-button>
          <el-button size="small" @click="openAddPoints(row)">
            充值积分
          </el-button>
          <el-button size="small" @click="openResetPassword(row)">
            重置密码
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination">
      <el-pagination
       -page="page v-model:current"
        :page-size="20"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="loadUsers"
      />
    </div>

    <!-- 用户详情对话框 -->
    <el-dialog v-model="detailVisible" title="用户详情" width="600px">
      <div v-if="selectedUser">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="ID">{{ selectedUser.user.id }}</el-descriptions-item>
          <el-descriptions-item label="邮箱">{{ selectedUser.user.email }}</el-descriptions-item>
          <el-descriptions-item label="用户名">{{ selectedUser.user.name }}</el-descriptions-item>
          <el-descriptions-item label="当前积分">
            <el-tag type="warning">{{ selectedUser.user.points }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="管理员">
            <el-switch
              v-model="selectedUser.user.is_admin"
              :active-value="1"
              :inactive-value="0"
              @change="handleSetAdmin(selectedUser.user)"
            />
          </el-descriptions-item>
          <el-descriptions-item label="注册时间">{{ formatTime(selectedUser.user.created_at) }}</el-descriptions-item>
        </el-descriptions>

        <el-divider>使用统计</el-divider>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-statistic title="生成任务数" :value="selectedUser.stats.generateJobs" />
          </el-col>
          <el-col :span="8">
            <el-statistic title="生成消耗积分" :value="selectedUser.stats.generatePoints" />
          </el-col>
          <el-col :span="8">
            <el-statistic title="精炼次数" :value="selectedUser.stats.refineCount" />
          </el-col>
        </el-row>
      </div>
    </el-dialog>

    <!-- 充值积分对话框 -->
    <el-dialog v-model="pointsVisible" title="充值积分" width="400px">
      <el-form @submit.prevent="handleAddPoints">
        <el-form-item label="用户">
          <el-input :value="pointsForm.email" disabled />
        </el-form-item>
        <el-form-item label="当前积分">
          <el-tag type="warning">{{ pointsForm.currentPoints }}</el-tag>
        </el-form-item>
        <el-form-item label="充值方式">
          <el-radio-group v-model="pointsForm.action">
            <el-radio value="add">增加积分</el-radio>
            <el-radio value="set">设置积分</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="积分数量">
          <el-input-number v-model="pointsForm.points" :min="0" :max="100000" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pointsVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAddPoints">确认</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码对话框 -->
    <el-dialog v-model="passwordVisible" title="重置密码" width="400px">
      <el-form @submit.prevent="handleResetPassword">
        <el-form-item label="用户">
          <el-input :value="passwordForm.email" disabled />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="passwordForm.newPassword" type="password" show-password placeholder="至少6位" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordVisible = false">取消</el-button>
        <el-button type="primary" @click="handleResetPassword">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api/index.js'

const users = ref([])
const loading = ref(false)
const page = ref(1)
const total = ref(0)

const detailVisible = ref(false)
const pointsVisible = ref(false)
const passwordVisible = ref(false)

const selectedUser = ref(null)
const pointsForm = ref({
  userId: null,
  email: '',
  currentPoints: 0,
  points: 0,
  action: 'add'
})
const passwordForm = ref({
  userId: null,
  email: '',
  newPassword: ''
})

function formatTime(timestamp) {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString('zh-CN')
}

async function loadUsers() {
  loading.value = true
  try {
    const res = await api.adminGetUsers({ page: page.value, pageSize: 20 })
    if (res.success) {
      users.value = res.data.users
      total.value = res.data.total
    }
  } catch (err) {
    ElMessage.error(err.message)
  } finally {
    loading.value = false
  }
}

async function openUserDetail(row) {
  try {
    const res = await api.adminGetUser(row.id)
    if (res.success) {
      selectedUser.value = res.data
      detailVisible.value = true
    }
  } catch (err) {
    ElMessage.error(err.message)
  }
}

function openAddPoints(row) {
  pointsForm.value = {
    userId: row.id,
    email: row.email,
    currentPoints: row.points,
    points: 0,
    action: 'add'
  }
  pointsVisible.value = true
}

async function handleAddPoints() {
  try {
    const res = await api.adminUpdatePoints(pointsForm.value.userId, {
      points: pointsForm.value.points,
      action: pointsForm.value.action
    })
    if (res.success) {
      ElMessage.success('积分更新成功')
      pointsVisible.value = false
      loadUsers()
    }
  } catch (err) {
    ElMessage.error(err.message)
  }
}

function openResetPassword(row) {
  passwordForm.value = {
    userId: row.id,
    email: row.email,
    newPassword: ''
  }
  passwordVisible.value = true
}

async function handleResetPassword() {
  if (!passwordForm.value.newPassword || passwordForm.value.newPassword.length < 6) {
    ElMessage.warning('密码至少6位')
    return
  }
  try {
    const res = await api.adminResetPassword(passwordForm.value.userId, {
      newPassword: passwordForm.value.newPassword
    })
    if (res.success) {
      ElMessage.success('密码重置成功')
      passwordVisible.value = false
    }
  } catch (err) {
    ElMessage.error(err.message)
  }
}

async function handleSetAdmin(row) {
  try {
    const res = await api.adminSetAdmin(row.id, { isAdmin: row.is_admin === 1 })
    if (res.success) {
      ElMessage.success('管理员状态已更新')
    }
  } catch (err) {
    ElMessage.error(err.message)
    loadUsers()
  }
}

onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
.admin-view {
  padding: 20px;
}
.page-header {
  margin-bottom: 20px;
}
.page-header h2 {
  margin: 0;
}
.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}
</style>
