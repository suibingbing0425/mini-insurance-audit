const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { User, Department } = require('../models')
const auth = require('../middlewares/auth')

// POST /api/auth/login  登录
router.post('/login', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ code: 400, message: '用户名和密码不能为空' })
  }

  // 1. 查用户（带出他所在的科室）
  const user = await User.findOne({
    where: { username },
    include: [{ model: Department, as: 'department' }]
  })
  if (!user) return res.status(401).json({ code: 401, message: '用户名或密码错误' })

  // 2. 校验密码（bcrypt 比对，绝不比对明文）
  const ok = await bcrypt.compare(password, user.password)
  if (!ok) return res.status(401).json({ code: 401, message: '用户名或密码错误' })

  // 3. 校验通过 → 签发 JWT
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || '7d' }
  )

  res.json({
    code: 0,
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        dept: user.department ? user.department.name : null
      }
    },
    message: 'ok'
  })
})

// GET /api/auth/me  获取当前用户（登录后前端刷新页面用）
router.get('/me', auth, async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    include: [{ model: Department, as: 'department' }],
    attributes: { exclude: ['password'] }
  })
  res.json({ code: 0, data: user, message: 'ok' })
})

module.exports = router
