import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { http } from '@/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || null)
  const user = ref(null)
  const organizations = ref([])
  const currentOrganization = ref(null)
  const loading = ref(false)
  const error = ref(null)

  const isLoggedIn = computed(() => !!token.value)

  function setToken(newToken) {
    token.value = newToken
    if (newToken) {
      localStorage.setItem('token', newToken)
    } else {
      localStorage.removeItem('token')
    }
  }

  function setCurrentOrganization(org) {
    currentOrganization.value = org
    if (org) {
      localStorage.setItem('currentOrganizationId', org.id)
    } else {
      localStorage.removeItem('currentOrganizationId')
    }
  }

  async function register(email, password, name) {
    loading.value = true
    error.value = null
    try {
      const res = await http.post('/auth/register', { email, password, name })
      if (res.success) {
        setToken(res.data.token)
        user.value = res.data.user
        organizations.value = [res.data.organization]
        setCurrentOrganization(res.data.organization)
        return true
      }
    } catch (err) {
      error.value = err.message || 'Registration failed'
      return false
    } finally {
      loading.value = false
    }
  }

  async function login(email, password) {
    loading.value = true
    error.value = null
    console.log('[Auth] login called, email:', email)
    try {
      const res = await http.post('/auth/login', { email, password })
      console.log('[Auth] login response:', res)
      console.log('[Auth] res.success:', res.success)
      if (res.success) {
        setToken(res.data.token)
        user.value = res.data.user
        organizations.value = res.data.organizations
        
        // 恢复上次选择的组织
        const lastOrgId = localStorage.getItem('currentOrganizationId')
        const lastOrg = organizations.value.find(o => o.id === parseInt(lastOrgId))
        setCurrentOrganization(lastOrg || organizations.value[0])
        
        console.log('[Auth] login returning true')
        return true
      } else {
        console.log('[Auth] login failed, res:', res)
        error.value = res.error || 'Login failed'
      }
    } catch (err) {
      console.log('[Auth] login catch error:', err)
      error.value = err.message || 'Login failed'
      return false
    } finally {
      loading.value = false
    }
  }

  async function fetchUser() {
    if (!token.value) return false
    try {
      const res = await http.get('/auth/me')
      if (res.success) {
        user.value = res.data.user
        organizations.value = res.data.organizations
        
        const lastOrgId = localStorage.getItem('currentOrganizationId')
        const lastOrg = organizations.value.find(o => o.id === parseInt(lastOrgId))
        setCurrentOrganization(lastOrg || organizations.value[0])
        
        return true
      }
    } catch (err) {
      // API 失败时不退出登录，保持 token
      console.warn('fetchUser failed:', err.message)
      return false
    }
  }

  async function refreshPoints() {
    try {
      const res = await http.get('/auth/points')
      if (res.success && user.value) {
        user.value.points = res.data.points
      }
    } catch (err) {
      console.error('Failed to refresh points:', err)
    }
  }

  async function createOrganization(name) {
    loading.value = true
    error.value = null
    try {
      const res = await http.post('/organizations', { name })
      if (res.success) {
        await fetchUser()
        return res.data
      }
    } catch (err) {
      error.value = err.message || 'Failed to create organization'
      return null
    } finally {
      loading.value = false
    }
  }

  function logout() {
    setToken(null)
    user.value = null
    organizations.value = []
    setCurrentOrganization(null)
  }

  // 初始化 - 恢复登录状态
  async function init() {
    if (token.value) {
      await fetchUser()
    }
  }

  return {
    token,
    user,
    organizations,
    currentOrganization,
    loading,
    error,
    isLoggedIn,
    register,
    login,
    fetchUser,
    refreshPoints,
    createOrganization,
    logout,
    init,
    setCurrentOrganization
  }
})
