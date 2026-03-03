import { createRouter, createWebHistory } from 'vue-router'

const routes = [
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
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.afterEach((to) => {
  document.title = to.meta.title
    ? `${to.meta.title} - 智绘论文图 / PaperSketch JS`
    : '智绘论文图 / PaperSketch JS'
})

export default router
