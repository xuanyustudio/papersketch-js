<template>
  <div class="login-container">
    <div class="login-bg-pattern"></div>
    <div class="login-box">
      <div class="login-header">
        <div class="logo-icon">🍌</div>
        <h1>智绘论文图</h1>
        <p class="subtitle">AI 学术插图生成平台</p>
      </div>
      
      <el-tabs v-model="activeTab" class="login-tabs">
        <el-tab-pane label="登录" name="login">
          <el-form :model="loginForm" @submit.prevent="handleLogin">
            <el-form-item>
              <el-input 
                v-model="loginForm.email" 
                placeholder="邮箱地址"
                size="large"
                :prefix-icon="Message"
              />
            </el-form-item>
            <el-form-item>
              <el-input 
                v-model="loginForm.password" 
                type="password" 
                placeholder="密码"
                size="large"
                :prefix-icon="Lock"
                show-password
              />
            </el-form-item>
            <el-alert v-if="authStore.error" :title="authStore.error" type="error" show-icon :closable="false" class="login-error" />
            <el-button type="primary" native-type="submit" :loading="authStore.loading" size="large" class="login-btn">
              登录
            </el-button>
          </el-form>
        </el-tab-pane>
        
        <el-tab-pane label="注册" name="register">
          <el-form :model="registerForm" @submit.prevent="handleRegister">
            <el-form-item>
              <el-input 
                v-model="registerForm.name" 
                placeholder="用户名"
                size="large"
                :prefix-icon="User"
              />
            </el-form-item>
            <el-form-item>
              <el-input 
                v-model="registerForm.email" 
                placeholder="邮箱地址"
                size="large"
                :prefix-icon="Message"
              />
            </el-form-item>
            <el-form-item>
              <el-input 
                v-model="registerForm.password" 
                type="password" 
                placeholder="密码（至少6位）"
                size="large"
                :prefix-icon="Lock"
                show-password
              />
            </el-form-item>
            <el-alert v-if="authStore.error" :title="authStore.error" type="error" show-icon :closable="false" class="login-error" />
            <el-button type="primary" native-type="submit" :loading="authStore.loading" size="large" class="login-btn">
              注册
            </el-button>
          </el-form>
        </el-tab-pane>
      </el-tabs>
      
      <div class="login-footer">
        <span>AI 驱动 · 学术级插图</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore.js'
import { Message, Lock, User } from '@element-plus/icons-vue'

const router = useRouter()
const authStore = useAuthStore()

const activeTab = ref('login')
const loginForm = reactive({
  email: '',
  password: ''
})
const registerForm = reactive({
  name: '',
  email: '',
  password: ''
})

async function handleLogin() {
  console.log('[LoginView] handleLogin called')
  const success = await authStore.login(loginForm.email, loginForm.password)
  console.log('[LoginView] login result:', success)
  if (success) {
    console.log('[LoginView] redirecting to /')
    router.push('/')
  }
}

async function handleRegister() {
  const success = await authStore.register(registerForm.email, registerForm.password, registerForm.name)
  if (success) {
    router.push('/')
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ecfeff 0%, #cffafe 50%, #a5f3fc 100%);
  position: relative;
  overflow: hidden;
}

.login-bg-pattern {
  position: absolute;
  inset: 0;
  background-image: 
    radial-gradient(circle at 20% 80%, rgba(8, 145, 178, 0.08) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(34, 197, 94, 0.08) 0%, transparent 50%),
    radial-gradient(circle at 40% 40%, rgba(8, 145, 178, 0.05) 0%, transparent 30%);
  pointer-events: none;
}

.login-box {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  padding: 48px 40px;
  border-radius: 24px;
  box-shadow: 
    0 25px 50px -12px rgba(8, 145, 178, 0.15),
    0 0 0 1px rgba(255, 255, 255, 0.5) inset;
  width: 420px;
  position: relative;
  z-index: 1;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.logo-icon {
  font-size: 48px;
  margin-bottom: 12px;
  display: inline-block;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

h1 {
  text-align: center;
  margin: 0;
  color: #164E63;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.subtitle {
  text-align: center;
  color: #475569;
  margin: 8px 0 0;
  font-size: 14px;
  font-weight: 500;
}

.login-tabs :deep(.el-tabs__header) {
  margin-bottom: 24px;
}

.login-tabs :deep(.el-tabs__nav-wrap::after) {
  background-color: #e2e8f0;
}

.login-tabs :deep(.el-tabs__item) {
  font-size: 16px;
  font-weight: 600;
  color: #64748b;
  padding: 0 24px;
}

.login-tabs :deep(.el-tabs__item.is-active) {
  color: #0891B2;
}

.login-tabs :deep(.el-input__wrapper) {
  padding: 4px 12px;
  border-radius: 12px;
}

.login-tabs :deep(.el-input__wrapper:focus-within) {
  box-shadow: 0 0 0 3px rgba(8, 145, 178, 0.15) !important;
}

.login-error {
  margin-bottom: 16px;
}

.login-btn {
  width: 100%;
  height: 48px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  margin-top: 8px;
  background: linear-gradient(135deg, #0891B2 0%, #0e7490 100%);
  border: none;
  transition: all 0.2s ease;
}

.login-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(8, 145, 178, 0.3);
}

.login-footer {
  text-align: center;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e2e8f0;
}

.login-footer span {
  font-size: 13px;
  color: #94a3b8;
}
</style>
