const router = require('express').Router()
const { AuditKnowledge } = require('../models')
const auth = require('../middlewares/auth')

// GET /api/rules-library/categories  分类列表（下拉筛选用）
router.get('/categories', auth, async (req, res) => {
  const rows = await AuditKnowledge.findAll({ attributes: ['category1', 'category2'] })
  const category1 = [...new Set(rows.map(r => r.category1).filter(Boolean))]
  const category2 = [...new Set(rows.map(r => r.category2).filter(Boolean))]
  res.json({ code: 0, data: { category1, category2 }, message: 'ok' })
})

// GET /api/rules-library  规则列表（不含知识点明细，支持搜索+分类筛选）
router.get('/', auth, async (req, res) => {
  const { keyword, category1, category2 } = req.query
  const where = {}
  if (category1) where.category1 = category1
  if (category2) where.category2 = category2
  let rows = await AuditKnowledge.findAll({ where })
  // 应用层排序，避免 MySQL 对含 JSON 列的表 ORDER BY 触发 sort_buffer 不足
  rows.sort((a, b) => (a.seq || 0) - (b.seq || 0))
  if (keyword) rows = rows.filter(r => (r.name || '').includes(keyword))
  res.json({
    code: 0,
    data: rows.map(r => ({
      seq: r.seq,
      category1: r.category1,
      category2: r.category2,
      name: r.name,
      hasDetail: r.hasDetail,
      knowledgeCount: Array.isArray(r.knowledge) ? r.knowledge.length : 0
    })),
    total: rows.length,
    message: 'ok'
  })
})

// GET /api/rules-library/:seq  规则详情（含知识点明细）
router.get('/:seq', auth, async (req, res) => {
  const rule = await AuditKnowledge.findOne({ where: { seq: parseInt(req.params.seq) } })
  if (!rule) return res.status(404).json({ code: 404, message: '规则不存在' })
  res.json({ code: 0, data: rule, message: 'ok' })
})

module.exports = router
