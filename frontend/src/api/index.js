import axios from 'axios'

const http = axios.create({
  baseURL: (import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:3000') + '/api',
  timeout: 30000,
})

console.log('[API] baseURL:', http.defaults.baseURL)

let lastRefreshTime = 0
const REFRESH_INTERVAL = 24 * 60 * 60 * 1000 // 24小时内不重复刷新

async function refreshToken() {
  const now = Date.now()
  if (now - lastRefreshTime < REFRESH_INTERVAL) return
  
  try {
    const res = await http.post('/auth/refresh')
    if (res.success && res.data.token) {
      localStorage.setItem('token', res.data.token)
      lastRefreshTime = now
    }
  } catch (e) {
    // ignore refresh errors
  }
}

// 请求拦截器 - 自动添加 token
http.interceptors.request.use(
  (config) => {
    console.log('[API Request]', config.method?.toUpperCase(), config.baseURL + config.url)
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // 添加组织 ID
    const orgId = localStorage.getItem('currentOrganizationId')
    if (orgId) {
      config.headers['X-Organization-Id'] = orgId
    }
    return config
  },
  (err) => Promise.reject(err)
)

http.interceptors.response.use(
  (res) => {
    // 成功响应后尝试刷新 token
    refreshToken()
    return res.data
  },
  (err) => {
    const message = err.response?.data?.error || err.message || 'Request failed'
    return Promise.reject(new Error(message))
  }
)

export const api = {
  health: () => http.get('/health'),
  
  // Auth
  register: (data) => http.post('/auth/register', data),
  login: (data) => http.post('/auth/login', data),
  getMe: () => http.get('/auth/me'),
  getPoints: () => http.get('/auth/points'),
  refreshToken: () => http.post('/auth/refresh'),
  
  // Organizations
  getOrganizations: () => http.get('/organizations'),
  createOrganization: (data) => http.post('/organizations', data),
  getOrganization: (id) => http.get(`/organizations/${id}`),
  getOrganizationMembers: (id) => http.get(`/organizations/${id}/members`),
  inviteMember: (orgId, data) => http.post(`/organizations/${orgId}/members`, data),
  updateMemberRole: (orgId, userId, data) => http.patch(`/organizations/${orgId}/members/${userId}`, data),
  removeMember: (orgId, userId) => http.delete(`/organizations/${orgId}/members/${userId}`),
  leaveOrganization: (orgId) => http.post(`/organizations/${orgId}/leave`),

  // Admin
  adminGetUsers: (params) => http.get('/admin/users', { params }),
  adminGetUser: (id) => http.get(`/admin/users/${id}`),
  adminUpdatePoints: (userId, data) => http.post(`/admin/users/${userId}/points`, data),
  adminResetPassword: (userId, data) => http.post(`/admin/users/${userId}/reset-password`, data),
  adminSetAdmin: (userId, data) => http.post(`/admin/users/${userId}/admin`, data),

  generateStart: (params) => http.post('/generate/start', params),

  generateStatus: (jobId) => http.get(`/generate/status/${jobId}`),

  refineImage: (formData) =>
    http.post('/refine', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    }),

  // Models
  getImageModels: () => http.get('/models/image'),

  // History
  listHistory: (params) => http.get('/history', { params }),
  getHistoryDetail: (jobId) => http.get(`/history/${jobId}`),
  deleteHistory: (jobId) => http.delete(`/history/${jobId}`),

  // Refine history
  listRefineHistory: (params) => http.get('/refine/history', { params }),
  deleteRefineRecord: (id) => http.delete(`/refine/history/${id}`),
}

export { http }
export default api
