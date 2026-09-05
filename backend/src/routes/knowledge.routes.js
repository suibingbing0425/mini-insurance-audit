const router = require('express').Router()
const { AuditKnowledge, sequelize } = require('../models')
const auth = require('../middlewares/auth')
const role = require('../middlewares/role')
const { parseRuleLibrary } = require('../services/ruleLibraryParser')

// 统一解析 knowledge：允许前端传 JSON 字符串或对象
function parseKnowledge(k) {
  if (k === undefined || k === null) return null
  if (typeof k === 'string') {
    if (!k.trim()) return null
    try { return JSON.parse(k) } catch { return null }
  }
  return k
}

// POST /api/knowledge/import  上传 Excel 批量导入规则+知识点（仅管理员）
// 入参：{ filename, file(base64), mode }；
//   mode: 'full'（默认）完整规则库，按 sheet 名匹配规则名；
//   mode: 'single' 单条规则知识点明细，其余 sheet 全部挂给规则列表中的唯一规则。
// 解析逻辑见 ruleLibraryParser（与 gen-rule-library.py 一致）
// 按 seq 幂等 upsert：已存在则更新，不存在则新增；可安全重复导入
router.post('/import', auth, role('admin'), async (req, res) => {
  const { filename, file, mode = 'full' } = req.body
  if (!file) return res.status(400).json({ code: 400, message: '未收到文件内容' })
  if (!/\.(xlsx|xls)$/i.test(filename || '')) {
    return res.status(400).json({ code: 400, message: '仅支持 .xlsx / .xls 文件' })
  }
  if (!['full', 'single'].includes(mode)) {
    return res.status(400).json({ code: 400, message: 'mode 只能是 full 或 single' })
  }
  let buffer
  try { buffer = Buffer.from(file, 'base64') }
  catch { return res.status(400).json({ code: 400, message: '文件内容解析失败' }) }

  let rules
  try { rules = await parseRuleLibrary(buffer, mode) }
  catch (e) { return res.status(400).json({ code: 400, message: 'Excel 解析失败：' + e.message }) }
  if (!rules.length) return res.status(400).json({ code: 400, message: '未解析到任何规则' })

  const t = await sequelize.transaction()
  try {
    let created = 0, updated = 0
    for (const r of rules) {
      // single 模式规则列表只有一条，用规则名匹配更稳，避免单文件内的小序号(seq)与库内全局 seq 冲突
      const where = (mode === 'single' || !r.seq) ? { name: r.name } : { seq: r.seq }
      const existing = await AuditKnowledge.findOne({ where, transaction: t })
      if (existing) {
        await existing.update({
          category1: r.category1, category2: r.category2, name: r.name,
          hasDetail: r.hasDetail, knowledge: r.knowledge
        }, { transaction: t })
        updated++
      } else {
        await AuditKnowledge.create({
          seq: r.seq, category1: r.category1, category2: r.category2,
          name: r.name, hasDetail: r.hasDetail, knowledge: r.knowledge
        }, { transaction: t })
        created++
      }
    }
    await t.commit()
    const msg = `导入成功：新增 ${created} 条，更新 ${updated} 条`
    res.json({ code: 0, data: { total: rules.length, created, updated, message: msg }, message: msg })
  } catch (e) {
    await t.rollback()
    throw e
  }
})

// GET /api/knowledge  列表（搜索+分类筛选+分页，登录即可查看）
router.get('/', auth, async (req, res) => {
  const { keyword, category1, category2, page = 1, pageSize = 10 } = req.query
  const where = {}
  if (category1) where.category1 = category1
  if (category2) where.category2 = category2
  let rows = await AuditKnowledge.findAll({ where })
  // 应用层排序，避免 MySQL 对含 JSON 列的表 ORDER BY 触发 sort_buffer 不足
  rows.sort((a, b) => (a.seq || 0) - (b.seq || 0))
  if (keyword) rows = rows.filter(r => (r.name || '').includes(keyword))
  const total = rows.length
  const start = (parseInt(page) - 1) * parseInt(pageSize)
  const list = rows.slice(start, start + parseInt(pageSize)).map(r => ({
    id: r.id, seq: r.seq, category1: r.category1, category2: r.category2,
    name: r.name, hasDetail: r.hasDetail,
    knowledgeCount: Array.isArray(r.knowledge) ? r.knowledge.length : 0
  }))
  res.json({ code: 0, data: { list, total }, message: 'ok' })
})

// GET /api/knowledge/:id  详情（含知识点，登录即可查看）
router.get('/:id', auth, async (req, res) => {
  const rule = await AuditKnowledge.findByPk(req.params.id)
  if (!rule) return res.status(404).json({ code: 404, message: '规则不存在' })
  res.json({ code: 0, data: rule, message: 'ok' })
})

// POST /api/knowledge  新增
router.post('/', auth, role('admin'), async (req, res) => {
  const { seq, category1, category2, name, hasDetail, knowledge } = req.body
  if (!name) return res.status(400).json({ code: 400, message: '规则名称必填' })
  const rule = await AuditKnowledge.create({
    seq, category1, category2, name,
    hasDetail: !!hasDetail,
    knowledge: parseKnowledge(knowledge)
  })
  res.json({ code: 0, data: rule, message: 'ok' })
})

// PUT /api/knowledge/:id  修改
router.put('/:id', auth, role('admin'), async (req, res) => {
  const rule = await AuditKnowledge.findByPk(req.params.id)
  if (!rule) return res.status(404).json({ code: 404, message: '规则不存在' })
  const patch = { ...req.body }
  if (req.body.knowledge !== undefined) patch.knowledge = parseKnowledge(req.body.knowledge)
  if (req.body.hasDetail !== undefined) patch.hasDetail = !!req.body.hasDetail
  await rule.update(patch)
  res.json({ code: 0, data: rule, message: 'ok' })
})

// DELETE /api/knowledge/:id  删除
router.delete('/:id', auth, role('admin'), async (req, res) => {
  const rule = await AuditKnowledge.findByPk(req.params.id)
  if (!rule) return res.status(404).json({ code: 404, message: '规则不存在' })
  await rule.destroy()
  res.json({ code: 0, message: 'ok' })
})

module.exports = router
