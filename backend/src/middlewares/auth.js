const jwt = require('jsonwebtoken')

// 鉴权中间件：校验 Authorization 头里的 JWT
module.exports = function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ code: 401, message: '未登录' })
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ code: 401, message: 'token失效' })
  }
}
