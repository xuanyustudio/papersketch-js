import { query } from '../db/mysqlAdapter.js'

// 中间件：确保请求属于某个组织
export async function requireOrg(req, res, next) {
  const orgId = req.headers['x-organization-id'] || req.query.organization_id
  
  if (!orgId) {
    return res.status(400).json({ 
      success: false, 
      error: 'X-Organization-Id header is required' 
    })
  }

  const orgIdNum = parseInt(orgId)
  if (isNaN(orgIdNum)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid organization ID' 
    })
  }

  // 检查用户是否属于该组织
  try {
    const membership = await query(
      'SELECT * FROM organization_users WHERE user_id = ? AND organization_id = ?',
      [req.user.userId, orgIdNum]
    )

    if (membership.length === 0) {
      return res.status(403).json({ 
        success: false, 
        error: 'You do not have access to this organization' 
      })
    }

    // 将组织信息挂载到请求对象
    req.organizationId = orgIdNum
    req.organizationRole = membership[0].role
    req.isOrgOwner = membership[0].role === 'owner'
    req.isOrgAdmin = ['owner', 'admin'].includes(membership[0].role)
    
    next()
  } catch (error) {
    console.error('[RequireOrg] Error:', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    })
  }
}

// 中间件：检查是否是组织管理员
export function requireAdmin(req, res, next) {
  if (!req.isOrgAdmin) {
    return res.status(403).json({ 
      success: false, 
      error: 'Admin access required' 
    })
  }
  next()
}

// 中间件：检查是否是组织所有者
export function requireOwner(req, res, next) {
  if (!req.isOrgOwner) {
    return res.status(403).json({ 
      success: false, 
      error: 'Owner access required' 
    })
  }
  next()
}

export default { requireOrg, requireAdmin, requireOwner }
