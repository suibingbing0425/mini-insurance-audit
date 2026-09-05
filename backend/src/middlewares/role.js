// 角色校验中间件：必须放在 auth 之后使用
// 用法：router.get('/', auth, role('admin'), handler)
module.exports = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ code: 403, message: '无权限' })
  }
  next()
}
