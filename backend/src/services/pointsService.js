import { query } from '../db/mysqlAdapter.js'

export const pointsService = {
  // 扣除积分
  async deductPoints(userId, amount) {
    const users = await query('SELECT points FROM users WHERE id = ?', [userId])
    if (users.length === 0) return { success: false, error: 'User not found' }
    
    const currentPoints = users[0].points
    if (currentPoints < amount) {
      return { success: false, error: 'Insufficient points', currentPoints }
    }
    
    await query('UPDATE users SET points = points - ? WHERE id = ?', [amount, userId])
    return { success: true, deducted: amount, currentPoints: currentPoints - amount }
  },

  // 获取积分
  async getPoints(userId) {
    const users = await query('SELECT points FROM users WHERE id = ?', [userId])
    if (users.length === 0) return null
    return users[0].points
  },

  // 增加积分（管理员用）
  async addPoints(userId, amount) {
    await query('UPDATE users SET points = points + ? WHERE id = ?', [amount, userId])
    const points = await this.getPoints(userId)
    return { success: true, added: amount, currentPoints: points }
  }
}

// 计算积分消耗
// 生成候选图：候选数量 * 最大轮数 * 10
// 图片精炼：10 积分
export function calculateGeneratePoints(numCandidates, maxCriticRounds) {
  return numCandidates * maxCriticRounds * 10
}

export function calculateRefinePoints() {
  return 10
}
