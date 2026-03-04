import axios from 'axios'

const http = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

http.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message = err.response?.data?.error || err.message || 'Request failed'
    return Promise.reject(new Error(message))
  }
)

export const api = {
  health: () => http.get('/health'),

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

export default api
