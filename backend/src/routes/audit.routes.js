const router = require('express').Router()
const ExcelJS = require('exceljs')
const { AuditRecord, AuditLog, MedicalOrder, Patient, AuditRule, User } = require('../models')
const { Op } = require('sequelize')
const auth = require('../middlewares/auth')
const role = require('../middlewares/role')

// GET /api/audits  审核记录列表（含医嘱、患者、规则）
router.get('/', auth, role('admin'), async (req, res) => {
  const page = parseInt(req.query.page) || 1
  const pageSize = parseInt(req.query.pageSize) || 10
  const where = {}
  if (req.query.orderId) where.order_id = req.query.orderId
  if (req.query.status) {
    // 'pending' = 待人工介入（提醒 + 拒绝）；其余按具体状态精确过滤
    where.status = req.query.status === 'pending' ? { [Op.in]: ['warn', 'reject'] } : req.query.status
  }
  if (req.query.handled) {
    // 处理状态筛选：done=已处理(auditor_id 非空)，undone=未处理(auditor_id 为空)
    where.auditor_id = req.query.handled === 'done' ? { [Op.ne]: null } : null
  }
  const { rows, count } = await AuditRecord.findAndCountAll({
    where,
    include: [
      { model: MedicalOrder, as: 'order', include: [{ model: Patient, as: 'patient' }] },
      { model: AuditRule, as: 'rule' },
      { model: User, as: 'auditor' }
    ],
    limit: pageSize,
    offset: (page - 1) * pageSize,
    order: [['created_at', 'DESC']]
  })
  res.json({ code: 0, data: { list: rows, total: count }, message: 'ok' })
})

// GET /api/audits/export  审核记录导出 Excel（管理员）
// 与列表共用同一套筛选参数（status/handled/orderId），服务端用 exceljs 生成 .xlsx 流式下载
// 注意：静态路由必须放在 /:id 参数路由之前，否则 "export" 会被当成 :id
router.get('/export', auth, role('admin'), async (req, res) => {
  const where = {}
  if (req.query.orderId) where.order_id = req.query.orderId
  if (req.query.status) {
    where.status = req.query.status === 'pending' ? { [Op.in]: ['warn', 'reject'] } : req.query.status
  }
  if (req.query.handled) {
    where.auditor_id = req.query.handled === 'done' ? { [Op.ne]: null } : null
  }

  const rows = await AuditRecord.findAll({
    where,
    include: [
      { model: MedicalOrder, as: 'order', include: [{ model: Patient, as: 'patient' }] },
      { model: AuditRule, as: 'rule' },
      { model: User, as: 'auditor' }
    ],
    order: [['created_at', 'DESC']]
  })

  const statusMap = { pass: '通过', warn: '提醒', reject: '拒绝' }
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet('审核记录')
  ws.columns = [
    { header: '审核编号', key: 'audit_no', width: 16 },
    { header: '患者', key: 'patient', width: 12 },
    { header: '性别', key: 'gender', width: 8 },
    { header: '年龄', key: 'age', width: 8 },
    { header: '诊断', key: 'diagnosis', width: 22 },
    { header: '命中规则', key: 'rule', width: 26 },
    { header: '审核结论', key: 'status', width: 10 },
    { header: '审核说明', key: 'message', width: 44 },
    { header: '复核反馈', key: 'feedback', width: 30 },
    { header: '处理状态', key: 'handled', width: 10 },
    { header: '处理人', key: 'auditor', width: 12 },
    { header: '审核时间', key: 'created_at', width: 22 }
  ]
  // 表头加粗 + 居中
  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF409EFF' } }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

  rows.forEach(r => {
    const o = r.order || {}
    const p = o.patient || {}
    ws.addRow({
      audit_no: r.audit_no || r.id,
      patient: p.name || '-',
      gender: p.gender || '-',
      age: p.age ?? '-',
      diagnosis: o.diagnosis || '-',
      rule: r.rule ? r.rule.name : '（无规则，自动通过）',
      status: statusMap[r.status] || r.status,
      message: r.message || '',
      feedback: r.feedback || '-',
      handled: r.auditor_id ? '已处理' : '未处理',
      auditor: r.auditor ? r.auditor.name : '-',
      created_at: r.created_at ? new Date(r.created_at).toLocaleString('zh-CN', { hour12: false }) : '-'
    })
  })

  // 所有单元格垂直居中，长文本自动换行
  ws.eachRow((row, idx) => {
    if (idx === 1) return
    row.alignment = { vertical: 'middle', wrapText: true }
  })

  const fileName = `审核记录_${new Date().toISOString().slice(0, 10)}.xlsx`
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`)
  const buf = await workbook.xlsx.writeBuffer()
  res.send(buf)
})

// GET /api/audits/logs  全量操作日志（审核日志页：多维筛选 + 结果分布统计）
// 真实业务：审计留痕需支持按时间/操作人/操作类型/患者·医生/医嘱编号检索，并给出审核结果分布
// 注意：静态路由必须放在 /:id 参数路由之前，否则 Express 会把 "logs" 当成 :id 匹配
router.get('/logs', auth, role('admin'), async (req, res) => {
  const page = parseInt(req.query.page) || 1
  const pageSize = parseInt(req.query.pageSize) || 10
  const { startDate, endDate, operatorId, action, patientKeyword, doctorKeyword, orderNo } = req.query

  // 时间段
  const timeWhere = {}
  if (startDate) timeWhere[Op.gte] = new Date(startDate + ' 00:00:00')
  if (endDate) timeWhere[Op.lte] = new Date(endDate + ' 23:59:59')

  // 日志主表筛选
  const where = {}
  if (startDate || endDate) where.created_at = timeWhere
  if (operatorId) where.operator_id = operatorId
  if (action) where.action = action

  // 医嘱侧筛选（患者/医生/编号）：先查出匹配医嘱 ID，再用 order_id IN 过滤日志。
  // 原因：带 limit 分页时，把 patient/doctor 条件放在 include.where 里会被 Sequelize 放到外层 LEFT JOIN 的 ON 子句，
  // 导致不匹配的日志行仍然返回，只是患者/医生列显示为 null。
  async function getMatchedOrderIds() {
    if (!orderNo && !patientKeyword && !doctorKeyword) return null
    const orderWhere = {}
    if (orderNo) orderWhere.order_no = { [Op.like]: `%${orderNo}%` }
    const include = []
    if (patientKeyword) {
      include.push({ model: Patient, as: 'patient', where: { name: { [Op.like]: `%${patientKeyword}%` } }, required: true })
    } else {
      include.push({ model: Patient, as: 'patient', required: false })
    }
    if (doctorKeyword) {
      include.push({ model: User, as: 'doctor', where: { name: { [Op.like]: `%${doctorKeyword}%` } }, required: true })
    } else {
      include.push({ model: User, as: 'doctor', required: false })
    }
    const orders = await MedicalOrder.findAll({
      where: Object.keys(orderWhere).length ? orderWhere : undefined,
      include,
      attributes: ['id']
    })
    return orders.map(o => o.id)
  }

  const matchedOrderIds = await getMatchedOrderIds()
  if (matchedOrderIds && matchedOrderIds.length === 0) {
    return res.json({ code: 0, data: { list: [], total: 0, stats: { total: 0, pass: 0, reject: 0, warn: 0 } }, message: 'ok' })
  }
  if (matchedOrderIds) where.order_id = { [Op.in]: matchedOrderIds }

  const orderInclude = {
    model: MedicalOrder, as: 'order',
    include: [{ model: Patient, as: 'patient', required: false }, { model: User, as: 'doctor', required: false }]
  }

  const { rows, count } = await AuditLog.findAndCountAll({
    where,
    include: [
      { model: User, as: 'operator' },
      orderInclude
    ],
    limit: pageSize,
    offset: (page - 1) * pageSize,
    order: [['created_at', 'DESC']]
  })

  // 结果分布统计（来自 audit_record，套用同一时间/患者/医生/编号筛选）
  const recWhere = {}
  if (startDate || endDate) recWhere.created_at = timeWhere
  if (matchedOrderIds) recWhere.order_id = { [Op.in]: matchedOrderIds }
  const recs = await AuditRecord.findAll({ where: recWhere, attributes: ['status'] })
  const stats = {
    total: recs.length,
    pass: recs.filter(r => r.status === 'pass').length,
    reject: recs.filter(r => r.status === 'reject').length,
    warn: recs.filter(r => r.status === 'warn').length
  }

  res.json({ code: 0, data: { list: rows, total: count, stats }, message: 'ok' })
})

// GET /api/audits/:orderId/logs  某医嘱的操作日志流水（含操作人）
// 同样要放在 /:id 之前，避免被详情路由拦截
router.get('/:orderId/logs', auth, role('admin'), async (req, res) => {
  const logs = await AuditLog.findAll({
    where: { order_id: req.params.orderId },
    include: [{ model: User, as: 'operator' }],
    order: [['created_at', 'DESC']]
  })
  res.json({ code: 0, data: logs, message: 'ok' })
})

// GET /api/audits/:id  审核记录详情
router.get('/:id', auth, role('admin'), async (req, res) => {
  const rec = await AuditRecord.findByPk(req.params.id, {
    include: [
      { model: MedicalOrder, as: 'order', include: [{ model: Patient, as: 'patient' }] },
      { model: AuditRule, as: 'rule' },
      { model: User, as: 'auditor' }
    ]
  })
  if (!rec) return res.status(404).json({ code: 404, message: '审核记录不存在' })
  // 该次提交命中的全部规则明细（warn/reject），供前端逐条展开引擎结构化产出
  const hitRecords = await AuditRecord.findAll({
    where: { order_id: rec.order_id, status: { [Op.in]: ['warn', 'reject'] } },
    include: [{ model: AuditRule, as: 'rule' }],
    order: [['created_at', 'ASC']]
  })
  res.json({ code: 0, data: { ...rec.toJSON(), hitRecords }, message: 'ok' })
})

// POST /api/audits/:id/feedback  人工复核 + 填写反馈（仅管理员）
router.post('/:id/feedback', auth, role('admin'), async (req, res) => {
  const rec = await AuditRecord.findByPk(req.params.id)
  if (!rec) return res.status(404).json({ code: 404, message: '审核记录不存在' })
  const { feedback, decision } = req.body
  if (!feedback) return res.status(400).json({ code: 400, message: '反馈内容必填' })
  await rec.update({ feedback, auditor_id: req.user.id })
  // 若审核员在反馈时给出明确判定，则同步回写医嘱状态，闭合业务流
  if (decision === 'pass' || decision === 'reject') {
    const order = await MedicalOrder.findByPk(rec.order_id)
    if (order) {
      await order.update({ status: decision === 'pass' ? 'audited' : 'rejected' })
      await rec.update({ status: decision === 'pass' ? 'pass' : 'reject' })
    }
  }
  await AuditLog.create({
    record_id: rec.id,
    order_id: rec.order_id,
    action: 'feedback',
    operator_id: req.user.id,
    content: feedback
  })
  res.json({ code: 0, message: 'ok' })
})

// POST /api/audits/:id/review  管理员正式复核（独立入口：判定通过/不通过并回写医嘱状态）
router.post('/:id/review', auth, role('admin'), async (req, res) => {
  const { decision, feedback } = req.body
  if (!['pass', 'reject'].includes(decision)) {
    return res.status(400).json({ code: 400, message: 'decision 必须为 pass 或 reject' })
  }
  const rec = await AuditRecord.findByPk(req.params.id)
  if (!rec) return res.status(404).json({ code: 404, message: '审核记录不存在' })
  const order = await MedicalOrder.findByPk(rec.order_id)
  if (!order) return res.status(404).json({ code: 404, message: '医嘱不存在' })

  await order.update({ status: decision === 'pass' ? 'audited' : 'rejected' })
  await rec.update({ status: decision === 'pass' ? 'pass' : 'reject', feedback: feedback || null, auditor_id: req.user.id })
  await AuditLog.create({
    record_id: rec.id,
    order_id: order.id,
    // 通过 / 驳回 记成不同 action，便于日志页按结果筛选
    action: decision === 'pass' ? 'audit' : 'reject',
    operator_id: req.user.id,
    content: feedback || (decision === 'pass' ? '人工通过' : '人工驳回')
  })
  res.json({ code: 0, message: decision === 'pass' ? '人工通过' : '人工驳回', data: { record: rec, order } })
})

module.exports = router
