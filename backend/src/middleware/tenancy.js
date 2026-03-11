// Minimal tenancy (organization scope) middleware
// Reads organization id from headers or query and attaches to req
export function tenancyMiddleware(req, res, next) {
  // Preferred: header
  const orgHeader = (req.headers['x-organization-id'] || req.headers['organization-id'] || '').toString().trim();
  // Fallback: query param
  const orgQuery = (req.query && req.query.organization_id) ? String(req.query.organization_id) : '';
  const organizationId = orgHeader || orgQuery;

  if (organizationId) {
    // store as number if possible
    const idNum = Number(organizationId);
    req.organizationId = Number.isFinite(idNum) ? idNum : organizationId;
  } else {
    req.organizationId = null;
  }

  next();
}

// Convenience: mount tenancyMiddleware onto an Express app
export function mountTenancy(app) {
  if (typeof app.use === 'function') {
    app.use(tenancyMiddleware);
  }
}
