const router = require('express').Router()
const { AuditRule } = require('../models')
const auth = require('../middlewares/auth')
const role = require('../middlewares/role')

// 解析 expression：前端可能传 JSON 字符串或对象，统一转成对象并校验
function parseExpression(expression) {
  if (typeof expression === 'string') {
    try {
      return JSON.parse(expression)
    } catch {
      return null
    }
  }
  return expression
}

// GET /api/rules  规则列表（含启停状态）
router.get('/', auth, role('admin'), async (req, res) => {
  const list = await AuditRule.findAll({ order: [['id', 'ASC']] })
  res.json({ code: 0, data: list, message: 'ok' })
})

// POST /api/rules  新增规则（仅管理员）
router.post('/', auth, role('admin'), async (req, res) => {
  const { name, type, expression, severity, enabled } = req.body
  if (!name || !type || expression === undefined) {
    return res.status(400).json({ code: 400, message: 'name/type/expression 必填' })
  }
  const expr = parseExpression(expression)
  if (!expr) return res.status(400).json({ code: 400, message: 'expression 不是合法 JSON' })
  const rule = await AuditRule.create({
    name, type, expression: expr,
    severity: severity || 'warn',
    enabled: enabled !== undefined ? enabled : true
  })
  res.json({ code: 0, data: rule, message: 'ok' })
})

// PUT /api/rules/:id  修改规则（仅管理员）
router.put('/:id', auth, role('admin'), async (req, res) => {
  const rule = await AuditRule.findByPk(req.params.id)
  if (!rule) return res.status(404).json({ code: 404, message: '规则不存在' })
  const patch = { ...req.body }
  if (req.body.expression !== undefined) {
    const expr = parseExpression(req.body.expression)
    if (!expr) return res.status(400).json({ code: 400, message: 'expression 不是合法 JSON' })
    patch.expression = expr
  }
  await rule.update(patch)
  res.json({ code: 0, message: 'ok' })
})

// PUT /api/rules/:id/toggle  启停切换（仅管理员）
router.put('/:id/toggle', auth, role('admin'), async (req, res) => {
  const rule = await AuditRule.findByPk(req.params.id)
  if (!rule) return res.status(404).json({ code: 404, message: '规则不存在' })
  await rule.update({ enabled: !rule.enabled })
  res.json({ code: 0, data: { enabled: rule.enabled }, message: 'ok' })
})

// DELETE /api/rules/:id  删除（仅管理员）
router.delete('/:id', auth, role('admin'), async (req, res) => {
  const rule = await AuditRule.findByPk(req.params.id)
  if (!rule) return res.status(404).json({ code: 404, message: '规则不存在' })
  await rule.destroy()
  res.json({ code: 0, message: 'ok' })
})

module.exports = router
