export const EXP_MODE_OPTIONS = [
  { value: 'demo_planner_critic', label: '智能迭代（推荐）' },
  { value: 'demo_full', label: '全流程增强' },
  { value: 'vanilla', label: '快速直出' },
]

const MODE_ALIASES = {
  dev_planner_critic: 'demo_planner_critic',
  dev_full: 'demo_full',
}

export function normalizeExpMode(mode) {
  if (!mode) return 'demo_full'
  return MODE_ALIASES[mode] || mode
}

export function getExpModeLabel(mode) {
  const normalized = normalizeExpMode(mode)
  const found = EXP_MODE_OPTIONS.find((m) => m.value === normalized)
  return found?.label || normalized || '—'
}

export const EXP_MODE_HINTS = {
  demo_planner_critic: 'Planner + Critic 多轮迭代（质量/速度平衡）',
  demo_full: 'Retriever + Planner + Stylist + Critic（质量优先）',
  vanilla: '跳过规划与评审，直接出图（速度优先）',
}

export const EXP_MODE_DETAILS = {
  demo_planner_critic:
    '适合大多数场景：先由 Planner 组织结构，再由 Critic 逐轮修正。通常在质量和耗时之间最均衡。',
  demo_full:
    '在 Planner 基础上额外加入 Stylist 的视觉规范优化，图面更精致，但整体耗时通常最长。',
  vanilla:
    '跳过检索、规划、评审，直接出图。适合快速试提示词，不建议用于最终论文图。',
}
