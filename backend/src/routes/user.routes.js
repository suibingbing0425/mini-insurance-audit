const router = require('express').Router()
const bcrypt = require('bcryptjs')
const { Op } = require('sequelize')
const { User, Department } = require('../models')
const auth = require('../middlewares/auth')
const role = require('../middlewares/role')

// GET /api/users  用户列表（admin 专属）
router.get('/', auth, role('admin'), async (req, res) => {
  const users = await User.findAll({
    include: [{ model: Department, as: 'department', attributes: ['name'] }],
    attributes: { exclude: ['password'] },
    order: [['id', 'ASC']]
  })
  res.json({ code: 0, data: users, message: 'ok' })
})

// POST /api/users  新增用户（admin 专属）
router.post('/', auth, role('admin'), async (req, res) => {
  const { username, password, name, role: userRole, dept_id } = req.body
  if (!username || !password || !name || !userRole) {
    return res.status(400).json({ code: 400, message: '用户名/密码/姓名/角色必填' })
  }
  if (!['doctor', 'admin'].includes(userRole)) {
    return res.status(400).json({ code: 400, message: '角色必须是 doctor/admin' })
  }
  const exists = await User.findOne({ where: { username } })
  if (exists) return res.status(400).json({ code: 400, message: '用户名已存在' })
  const user = await User.create({
    username, password: bcrypt.hashSync(password, 10),
    name, role: userRole, dept_id: dept_id || null
  })
  res.json({ code: 0, data: { id: user.id, username: user.username, name: user.name, role: user.role }, message: 'ok' })
})

// PUT /api/users/:id  修改用户（admin 专属，改密码时加密）
router.put('/:id', auth, role('admin'), async (req, res) => {
  const user = await User.findByPk(req.params.id)
  if (!user) return res.status(404).json({ code: 404, message: '用户不存在' })
  const updates = { ...req.body }
  if (updates.password) {
    updates.password = bcrypt.hashSync(updates.password, 10)
  } else {
    delete updates.password
  }
  await user.update(updates)
  res.json({ code: 0, message: 'ok' })
})

// DELETE /api/users/:id  删除用户（admin 专属，不能删自己）
router.delete('/:id', auth, role('admin'), async (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ code: 400, message: '不能删除当前登录的管理员账号' })
  }
  const user = await User.findByPk(req.params.id)
  if (!user) return res.status(404).json({ code: 404, message: '用户不存在' })
  await user.destroy()
  res.json({ code: 0, message: 'ok' })
})

module.exports = router