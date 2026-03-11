const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:3000'

export function toAbsoluteUrl(relativePath) {
  if (!relativePath) return null
  // Already absolute URL
  if (relativePath.startsWith('http')) {
    // Convert old 127.0.0.1 or localhost URLs to current server URL
    if (relativePath.match(/127\.0\.0\.1|localhost/)) {
      // Extract the path starting with /images
      const match = relativePath.match(/(\/images\/.*)$/)
      if (match) {
        return API_BASE + match[1]
      }
    }
    return relativePath
  }
  return API_BASE + relativePath
}
