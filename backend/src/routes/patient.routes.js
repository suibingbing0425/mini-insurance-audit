const router = require('express').Router()
const { Op } = require('sequelize')
const { Patient } = require('../models')
const auth = require('../middlewares/auth')
const role = require('../middlewares/role')

// GET /api/patients  分页 + 按姓名搜索
router.get('/', auth, async (req, res) => {
  const page = parseInt(req.query.page) || 1
  const pageSize = parseInt(req.query.pageSize) || 10
  const keyword = req.query.keyword || ''
  const where = {}
  if (keyword) where.name = { [Op.like]: `%${keyword}%` }
  const { rows, count } = await Patient.findAndCountAll({
    where,
    limit: pageSize,
    offset: (page - 1) * pageSize,
    order: [['id', 'ASC']]
  })
  res.json({ code: 0, data: { list: rows, total: count }, message: 'ok' })
})

// POST /api/patients  新增患者（医生/管理员）
router.post('/', auth, role('doctor', 'admin'), async (req, res) => {
  const { name, gender, age, id_card, phone } = req.body
  if (!name || !gender) {
    return res.status(400).json({ code: 400, message: '姓名和性别必填' })
  }
  const p = await Patient.create({ name, gender, age, id_card, phone })
  res.json({ code: 0, data: p, message: 'ok' })
})

// PUT /api/patients/:id  修改（医生/管理员）
router.put('/:id', auth, role('doctor', 'admin'), async (req, res) => {
  const p = await Patient.findByPk(req.params.id)
  if (!p) return res.status(404).json({ code: 404, message: '患者不存在' })
  await p.update(req.body)
  res.json({ code: 0, data: p, message: 'ok' })
})

// DELETE /api/patients/:id  删除（仅管理员）
router.delete('/:id', auth, role('admin'), async (req, res) => {
  const p = await Patient.findByPk(req.params.id)
  if (!p) return res.status(404).json({ code: 404, message: '患者不存在' })
  await p.destroy()
  res.json({ code: 0, message: 'ok' })
})

module.exports = router
