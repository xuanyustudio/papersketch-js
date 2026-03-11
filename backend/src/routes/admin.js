import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { query } from '../db/mysqlAdapter.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// 管理员中间件
async function adminMiddleware(req, res, next) {
  try {
    const users = await query('SELECT is_admin FROM users WHERE id = ?', [req.user.userId])
    if (users.length === 0 || !users[0].is_admin) {
      return res.status(403).json({ success: false, error: 'Admin access required' })
    }
    next()
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

// 获取所有用户
router.get('/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 20))
    const offset = (page - 1) * pageSize
    
    const users = await query(
      `SELECT id, email, name, points, is_admin, created_at FROM users ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`,
      []
    )
    
    const total = await query('SELECT COUNT(*) as count FROM users', [])
    
    res.json({
      success: true,
      data: {
        users,
        total: total[0].count,
        page,
        pageSize,
        totalPages: Math.ceil(total[0].count / pageSize)
      }
    })
  } catch (error) {
    console.error('[Admin] Get users error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// 获取单个用户详情（含历史记录）
router.get('/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id)
    const users = await query('SELECT id, email, name, points, is_admin, created_at FROM users WHERE id = ?', [userId])
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }
    
    const user = users[0]
    
    // 获取用户的组织
    let orgs = []
    let generateStats = [{ total_jobs: 0, total_points: 0 }]
    let refineStats = [{ total_refines: 0, total_points: 0 }]
    
    try {
      orgs = await query(
        `SELECT o.id, o.name, o.slug, ou.role 
         FROM organizations o 
         JOIN organization_users ou ON o.id = ou.organization_id 
         WHERE ou.user_id = ?`,
        [userId]
      )
    } catch (e) { console.warn('orgs query failed:', e.message) }
    
    try {
      generateStats = await query(
        `SELECT COUNT(*) as total_jobs, SUM(points_cost) as total_points 
         FROM jobs WHERE organization_id IN (SELECT organization_id FROM organization_users WHERE user_id = ?)`,
        [userId]
      )
    } catch (e) { console.warn('generate stats query failed:', e.message) }
    
    try {
      refineStats = await query(
        `SELECT COUNT(*) as total_refines, SUM(points_cost) as total_points 
         FROM refine_history WHERE organization_id IN (SELECT organization_id FROM organization_users WHERE user_id = ?)`,
        [userId]
      )
    } catch (e) { console.warn('refine stats query failed:', e.message) }
    
    res.json({
      success: true,
      data: {
        user,
        organizations: orgs,
        stats: {
          generateJobs: generateStats[0]?.total_jobs || 0,
          generatePoints: generateStats[0]?.total_points || 0,
          refineCount: refineStats[0]?.total_refines || 0,
          refinePoints: refineStats[0]?.total_points || 0,
        }
      }
    })
  } catch (error) {
    console.error('[Admin] Get user error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// 修改用户积分
router.post('/users/:id/points', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id)
    const { points, action } = req.body // action: 'add' or 'set'
    
    if (!points || points < 0) {
      return res.status(400).json({ success: false, error: 'Invalid points value' })
    }
    
    let result
    if (action === 'set') {
      await query('UPDATE users SET points = ? WHERE id = ?', [points, userId])
      result = { points }
    } else {
      await query('UPDATE users SET points = points + ? WHERE id = ?', [points, userId])
      const users = await query('SELECT points FROM users WHERE id = ?', [userId])
      result = { points: users[0].points }
    }
    
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('[Admin] Update points error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// 重置用户密码
router.post('/users/:id/reset-password', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id)
    const { newPassword } = req.body
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' })
    }
    
    const passwordHash = await bcrypt.hash(newPassword, 10)
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId])
    
    res.json({ success: true, data: { message: 'Password reset successfully' } })
  } catch (error) {
    console.error('[Admin] Reset password error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// 设置管理员
router.post('/users/:id/admin', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id)
    const { isAdmin } = req.body
    
    await query('UPDATE users SET is_admin = ? WHERE id = ?', [isAdmin ? 1 : 0, userId])
    
    res.json({ success: true, data: { message: 'Admin status updated' } })
  } catch (error) {
    console.error('[Admin] Set admin error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
