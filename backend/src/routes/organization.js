import { Router } from 'express'
import { query } from '../db/mysqlAdapter.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// 所有组织接口都需要认证
router.use(authMiddleware)

// 获取用户的组织列表
router.get('/', async (req, res) => {
  try {
    const orgs = await query(
      `SELECT o.id, o.name, o.slug, o.created_at, ou.role, ou.status
       FROM organizations o
       JOIN organization_users ou ON o.id = ou.organization_id
       WHERE ou.user_id = ? AND ou.status = 'active'`,
      [req.user.userId]
    )
    res.json({ success: true, data: orgs })
  } catch (error) {
    console.error('[Org] List error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// 创建新组织
router.post('/', async (req, res) => {
  try {
    const { name, slug } = req.body
    if (!name) {
      return res.status(400).json({ success: false, error: 'Organization name is required' })
    }

    const orgSlug = slug || `org-${Date.now()}`

    // 创建组织
    const result = await query(
      'INSERT INTO organizations (name, slug) VALUES (?, ?)',
      [name, orgSlug]
    )
    const orgId = result.insertId

    // 创建者自动加入，角色为 owner
    await query(
      'INSERT INTO organization_users (user_id, organization_id, role, status) VALUES (?, ?, ?, ?)',
      [req.user.userId, orgId, 'owner', 'active']
    )

    res.json({
      success: true,
      data: { id: orgId, name, slug: orgSlug }
    })
  } catch (error) {
    console.error('[Org] Create error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// 获取组织详情
router.get('/:id', async (req, res) => {
  try {
    const orgId = parseInt(req.params.id)

    // 检查用户是否属于该组织
    const membership = await query(
      'SELECT * FROM organization_users WHERE user_id = ? AND organization_id = ?',
      [req.user.userId, orgId]
    )
    if (membership.length === 0) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }

    const orgs = await query('SELECT * FROM organizations WHERE id = ?', [orgId])
    if (orgs.length === 0) {
      return res.status(404).json({ success: false, error: 'Organization not found' })
    }

    res.json({ success: true, data: orgs[0] })
  } catch (error) {
    console.error('[Org] Get error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// 获取组织成员列表
router.get('/:id/members', async (req, res) => {
  try {
    const orgId = parseInt(req.params.id)

    // 检查用户是否属于该组织
    const membership = await query(
      'SELECT * FROM organization_users WHERE user_id = ? AND organization_id = ?',
      [req.user.userId, orgId]
    )
    if (membership.length === 0) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }

    const members = await query(
      `SELECT u.id, u.email, u.name, u.created_at, ou.role, ou.status
       FROM users u
       JOIN organization_users ou ON u.id = ou.user_id
       WHERE ou.organization_id = ?`,
      [orgId]
    )

    res.json({ success: true, data: members })
  } catch (error) {
    console.error('[Org] Members error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// 邀请成员（通过邮箱）
router.post('/:id/members', async (req, res) => {
  try {
    const orgId = parseInt(req.params.id)
    const { email, role } = req.body

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' })
    }

    // 检查邀请者权限（只有 owner 和 admin 可以邀请）
    const membership = await query(
      'SELECT * FROM organization_users WHERE user_id = ? AND organization_id = ?',
      [req.user.userId, orgId]
    )
    if (membership.length === 0 || !['owner', 'admin'].includes(membership[0].role)) {
      return res.status(403).json({ success: false, error: 'Only owner or admin can invite members' })
    }

    // 查找被邀请的用户
    const users = await query('SELECT id FROM users WHERE email = ?', [email])
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found. They need to register first.' })
    }

    const targetUserId = users[0].id

    // 检查是否已经是成员
    const existing = await query(
      'SELECT * FROM organization_users WHERE user_id = ? AND organization_id = ?',
      [targetUserId, orgId]
    )
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'User is already a member' })
    }

    // 添加成员
    await query(
      'INSERT INTO organization_users (user_id, organization_id, role, status) VALUES (?, ?, ?, ?)',
      [targetUserId, orgId, role || 'member', 'active']
    )

    res.json({ success: true, data: { message: 'Member added successfully' } })
  } catch (error) {
    console.error('[Org] Invite error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// 修改成员角色
router.patch('/:id/members/:userId', async (req, res) => {
  try {
    const orgId = parseInt(req.params.id)
    const targetUserId = parseInt(req.params.userId)
    const { role } = req.body

    if (!role || !['owner', 'admin', 'member'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' })
    }

    // 检查操作者权限
    const membership = await query(
      'SELECT * FROM organization_users WHERE user_id = ? AND organization_id = ?',
      [req.user.userId, orgId]
    )
    if (membership.length === 0 || membership[0].role !== 'owner') {
      return res.status(403).json({ success: false, error: 'Only owner can change roles' })
    }

    // 不能修改自己的 owner 角色
    if (targetUserId === req.user.userId && role !== 'owner') {
      return res.status(400).json({ success: false, error: 'Cannot change your own owner role' })
    }

    await query(
      'UPDATE organization_users SET role = ? WHERE user_id = ? AND organization_id = ?',
      [role, targetUserId, orgId]
    )

    res.json({ success: true, data: { message: 'Role updated successfully' } })
  } catch (error) {
    console.error('[Org] Update role error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// 移除成员
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const orgId = parseInt(req.params.id)
    const targetUserId = parseInt(req.params.userId)

    // 检查操作者权限
    const membership = await query(
      'SELECT * FROM organization_users WHERE user_id = ? AND organization_id = ?',
      [req.user.userId, orgId]
    )
    if (membership.length === 0 || !['owner', 'admin'].includes(membership[0].role)) {
      return res.status(403).json({ success: false, error: 'Only owner or admin can remove members' })
    }

    // 不能移除 owner
    const targetMembership = await query(
      'SELECT * FROM organization_users WHERE user_id = ? AND organization_id = ?',
      [targetUserId, orgId]
    )
    if (targetMembership.length > 0 && targetMembership[0].role === 'owner') {
      return res.status(400).json({ success: false, error: 'Cannot remove owner' })
    }

    // 不能自己移除自己
    if (targetUserId === req.user.userId) {
      return res.status(400).json({ success: false, error: 'Cannot remove yourself' })
    }

    await query(
      'DELETE FROM organization_users WHERE user_id = ? AND organization_id = ?',
      [targetUserId, orgId]
    )

    res.json({ success: true, data: { message: 'Member removed successfully' } })
  } catch (error) {
    console.error('[Org] Remove member error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// 离开组织
router.post('/:id/leave', async (req, res) => {
  try {
    const orgId = parseInt(req.params.id)

    const membership = await query(
      'SELECT * FROM organization_users WHERE user_id = ? AND organization_id = ?',
      [req.user.userId, orgId]
    )
    if (membership.length === 0) {
      return res.status(400).json({ success: false, error: 'Not a member of this organization' })
    }

    // 不能离开自己是唯一 owner 的组织
    if (membership[0].role === 'owner') {
      const ownerCount = await query(
        'SELECT COUNT(*) as count FROM organization_users WHERE organization_id = ? AND role = "owner"',
        [orgId]
      )
      if (ownerCount[0].count <= 1) {
        return res.status(400).json({ success: false, error: 'Cannot leave as the only owner. Transfer ownership first.' })
      }
    }

    await query(
      'DELETE FROM organization_users WHERE user_id = ? AND organization_id = ?',
      [req.user.userId, orgId]
    )

    res.json({ success: true, data: { message: 'Left organization successfully' } })
  } catch (error) {
    console.error('[Org] Leave error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
