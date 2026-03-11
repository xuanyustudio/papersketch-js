import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  // 后端地址（生产环境必须配置）
  const backendUrl = env.VITE_BACKEND_URL || 'http://127.0.0.1:3000'
  
  return {
	   base: './',
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 5173,
      proxy: mode === 'development' ? {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
        '/socket.io': {
          target: backendUrl,
          ws: true,
          changeOrigin: true,
        },
        '/images': {
          target: backendUrl,
          changeOrigin: true,
        },
      } : undefined,
    },
  }
})
