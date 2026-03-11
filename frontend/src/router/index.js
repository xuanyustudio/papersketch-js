import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore.js'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: '登录', public: true },
  },
  {
    path: '/',
    redirect: '/generate',
  },
  {
    path: '/generate',
    name: 'Generate',
    component: () => import('@/views/GenerateView.vue'),
    meta: { title: '生成候选图表' },
  },
  {
    path: '/refine',
    name: 'Refine',
    component: () => import('@/views/RefineView.vue'),
    meta: { title: '图片精炼升级' },
  },
  {
    path: '/history',
    name: 'History',
    component: () => import('@/views/HistoryView.vue'),
    meta: { title: '历史记录' },
  },
  {
    path: '/help',
    name: 'Help',
    component: () => import('@/views/HelpView.vue'),
    meta: { title: '帮助中心' },
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('@/views/AdminView.vue'),
    meta: { title: '管理后台' },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  
  // 如果还未初始化，先初始化
  if (!authStore.user && authStore.token) {
    await authStore.init()
  }
  
  // 如果访问公共路由，直接放行
  if (to.meta.public) {
    return next()
  }
  
  // 如果未登录，跳转到登录页
  if (!authStore.isLoggedIn) {
    return next('/login')
  }
  
  // 如果已登录但没有选择组织，且不是登录页，引导到选择组织
  if (authStore.isLoggedIn && !authStore.currentOrganization && to.name !== 'Login') {
    // 这里可以跳转到一个组织选择页面，暂时放行
  }
  
  next()
})

router.afterEach((to) => {
  document.title = to.meta.title
    ? `${to.meta.title} - 智绘论文图 / PaperSketch JS`
    : '智绘论文图 / PaperSketch JS'
})

export default router
