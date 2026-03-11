import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from '../db/mysqlAdapter.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'papersketch-secret-key'
const JWT_EXPIRES_IN = '7d'

// 验证函数
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email || !emailRegex.test(email)) {
    return '请输入有效的邮箱地址'
  }
  if (email.length > 255) {
    return '邮箱地址过长'
  }
  return null
}

function validatePassword(password) {
  if (!password) {
    return '请输入密码'
  }
  if (password.length < 6) {
    return '密码长度至少6位'
  }
  if (password.length > 32) {
    return '密码长度不能超过32位'
  }
  return null
}

function validateName(name) {
  if (!name || name.trim().length === 0) {
    return '请输入用户名'
  }
  if (name.length < 2) {
    return '用户名至少2个字符'
  }
  if (name.length > 30) {
    return '用户名不能超过30个字符'
  }
  // 只允许字母、数字、中文、下划线
  if (!/^[\u4e00-\u9fa5a-zA-Z0-9_]+$/.test(name)) {
    return '用户名只能包含字母、数字、中文和下划线'
  }
  return null
}

// 注册
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body
    
    // 验证邮箱
    const emailError = validateEmail(email)
    if (emailError) {
      return res.status(400).json({ success: false, error: emailError })
    }
    
    // 验证密码
    const passwordError = validatePassword(password)
    if (passwordError) {
      return res.status(400).json({ success: false, error: passwordError })
    }
    
    // 验证用户名
    const nameError = validateName(name)
    if (nameError) {
      return res.status(400).json({ success: false, error: nameError })
    }

    // 检查用户是否已存在
    const existing = await query('SELECT id FROM users WHERE email = ?', [email])
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: '该邮箱已被注册' })
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(password, 10)

    // 创建用户 (默认100积分)
    const result = await query(
      'INSERT INTO users (email, password_hash, name, points) VALUES (?, ?, ?, ?)',
      [email.toLowerCase().trim(), passwordHash, name.trim(), 100]
    )

    const userId = result.insertId

    // 创建默认组织
    const orgResult = await query(
      'INSERT INTO organizations (name, slug) VALUES (?, ?)',
      [name ? `${name}'s Organization` : 'My Organization', `org-${userId}`]
    )

    const orgId = orgResult.insertId

    // 将用户加入组织，角色为 owner
    await query(
      'INSERT INTO organization_users (user_id, organization_id, role, status) VALUES (?, ?, ?, ?)',
      [userId, orgId, 'owner', 'active']
    )

    // 生成 token
    const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })

    res.json({
      success: true,
      data: {
        user: { id: userId, email, name, points: 100, is_admin: 0 },
        organization: { id: orgId },
        token
      }
    })
  } catch (error) {
    console.error('[Auth] Register error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// 登录
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    
    // 验证邮箱
    const emailError = validateEmail(email)
    if (emailError) {
      return res.status(400).json({ success: false, error: emailError })
    }
    
    // 验证密码
    const passwordError = validatePassword(password)
    if (passwordError) {
      return res.status(400).json({ success: false, error: passwordError })
    }

    // 查找用户
    const users = await query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()])
    if (users.length === 0) {
      return res.status(401).json({ success: false, error: '邮箱或密码错误' })
    }

    const user = users[0]

    // 验证密码
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ success: false, error: '邮箱或密码错误' })
    }

    // 获取用户的组织列表
    const orgs = await query(
      `SELECT o.id, o.name, o.slug, ou.role 
       FROM organizations o 
       JOIN organization_users ou ON o.id = ou.organization_id 
       WHERE ou.user_id = ? AND ou.status = 'active'`,
      [user.id]
    )

    // 生成 token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })

    res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, name: user.name, points: user.points, is_admin: user.is_admin },
        organizations: orgs,
        token
      }
    })
  } catch (error) {
    console.error('[Auth] Login error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// 获取当前用户信息
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' })
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, JWT_SECRET)

    const users = await query('SELECT id, email, name, points, created_at FROM users WHERE id = ?', [decoded.userId])
    if (users.length === 0) {
      return res.status(401).json({ success: false, error: 'User not found' })
    }

    const user = users[0]

    // 获取用户的组织列表
    const orgs = await query(
      `SELECT o.id, o.name, o.slug, ou.role 
       FROM organizations o 
       JOIN organization_users ou ON o.id = ou.organization_id 
       WHERE ou.user_id = ? AND ou.status = 'active'`,
      [user.id]
    )

    res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, name: user.name, points: user.points, is_admin: user.is_admin },
        organizations: orgs
      }
    })
  } catch (error) {
    console.error('[Auth] Me error:', error)
    res.status(401).json({ success: false, error: 'Invalid token' })
  }
})

// 获取当前用户积分
router.get('/points', authMiddleware, async (req, res) => {
  try {
    const points = await query('SELECT points FROM users WHERE id = ?', [req.user.userId])
    if (points.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }
    res.json({ success: true, data: { points: points[0].points } })
  } catch (error) {
    console.error('[Auth] Points error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// 刷新 token（延长登录时间）
router.post('/refresh', authMiddleware, async (req, res) => {
  try {
    const users = await query('SELECT email FROM users WHERE id = ?', [req.user.userId])
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }
    
    const user = users[0]
    const newToken = jwt.sign({ userId: req.user.userId, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
    
    res.json({ success: true, data: { token: newToken } })
  } catch (error) {
    console.error('[Auth] Refresh error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
