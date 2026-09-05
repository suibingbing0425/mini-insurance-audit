const router = require('express').Router()
const { Op } = require('sequelize')
const sequelize = require('../config/db')
const crypto = require('crypto')
const { MedicalOrder, Prescription, Drug, Patient, User, AuditRecord, AuditLog, AuditRule } = require('../models')
const auth = require('../middlewares/auth')
const role = require('../middlewares/role')
const { auditOrder, buildOrderForPrecheck, auditByOrder } = require('../services/auditEngine')

// 生成处方签名：同一患者 + 相同药品组合 + 相同诊断 → 视为同一张单，用于幂等防重复创建
function prescriptionSignature(patient_id, diagnosis, prescriptions) {
  const drugs = [...prescriptions]
    .filter(p => p.drug_id)
    .map(p => `${p.drug_id}:${p.single_dose}:${p.days}:${p.quantity}`)
    .sort()
    .join('|')
  return crypto.createHash('md5').update(`${patient_id}#${diagnosis || ''}#${drugs}`).digest('hex')
}

// POST /api/orders  创建医嘱（含处方明细，status=draft）
// 幂等：同医生 5 分钟内提交相同签名（患者+诊断+处方组合）的订单，直接返回已有单，避免双击/网络重试造成重复单
router.post('/', auth, role('doctor', 'admin'), async (req, res) => {
  const { patient_id, diagnosis, content, prescriptions } = req.body
  if (!patient_id || !Array.isArray(prescriptions) || prescriptions.length === 0) {
    return res.status(400).json({ code: 400, message: '患者和至少一条处方必填' })
  }
  if (!diagnosis || !diagnosis.trim()) {
    return res.status(400).json({ code: 400, message: '诊断必填' })
  }
  const sig = prescriptionSignature(patient_id, diagnosis, prescriptions)
  const recent = await MedicalOrder.findOne({
    where: {
      doctor_id: req.user.id,
      patient_id,
      created_at: { [Op.gte]: new Date(Date.now() - 5 * 60 * 1000) }
    },
    order: [['created_at', 'DESC']],
    include: [{ model: Prescription, as: 'prescriptions' }]
  })
  // 按处方组合签名精确比对：只要 5 分钟内存在同医生同患者且药品组合完全相同的订单（无论状态），即视为重复
  if (recent) {
    const recentSig = prescriptionSignature(recent.patient_id, recent.diagnosis, recent.prescriptions || [])
    if (recentSig === sig) {
      return res.json({ code: 0, data: recent, message: 'ok', duplicated: true })
    }
  }
  const t = await sequelize.transaction()
  try {
    const order = await MedicalOrder.create(
      { patient_id, doctor_id: req.user.id, diagnosis, content, status: 'draft' },
      { transaction: t }
    )
    for (const p of prescriptions) {
      await Prescription.create({ order_id: order.id, ...p }, { transaction: t })
    }
    await t.commit()
    res.json({ code: 0, data: order, message: 'ok' })
  } catch (e) {
    await t.rollback()
    throw e
  }
})

// POST /api/orders/precheck  事前提醒：富结构返回（不落库不改状态）
router.post('/precheck', auth, role('doctor', 'admin'), async (req, res) => {
  const { prescriptions, patient_id, visit_type, hospital_level } = req.body
  if (!Array.isArray(prescriptions) || prescriptions.length === 0) {
    return res.status(400).json({ code: 400, message: '至少一条处方' })
  }
  const order = await buildOrderForPrecheck({ patient_id, prescriptions, visit_type, hospital_level })
  const { violations, checked } = await auditByOrder(order)
  res.json({ code: 0, data: { violations, checked }, message: 'ok' })
})

// PUT /api/orders/:id  编辑医嘱（仅 draft / rejected 可改，改完回 draft；医生只能改自己的单）
router.put('/:id', auth, role('doctor', 'admin'), async (req, res) => {
  const order = await MedicalOrder.findByPk(req.params.id)
  if (!order) return res.status(404).json({ code: 404, message: '医嘱不存在' })
  if (req.user.role === 'doctor' && order.doctor_id !== req.user.id) {
    return res.status(403).json({ code: 403, message: '只能编辑自己的医嘱' })
  }
  if (order.status !== 'draft' && order.status !== 'rejected') {
    return res.status(400).json({ code: 400, message: '仅草稿或已驳回的医嘱可编辑' })
  }
  const t = await sequelize.transaction()
  try {
    await order.update(
      { diagnosis: req.body.diagnosis, content: req.body.content, status: 'draft' },
      { transaction: t }
    )
    await Prescription.destroy({ where: { order_id: order.id }, transaction: t })
    for (const p of req.body.prescriptions || []) {
      await Prescription.create({ order_id: order.id, ...p }, { transaction: t })
    }
    await t.commit()
    res.json({ code: 0, message: 'ok' })
  } catch (e) {
    await t.rollback()
    throw e
  }
})

// GET /api/orders  医嘱列表（医生只看自己的；管理员看全部）
// 支持 patientName / doctorName 分别按患者姓名、医生姓名过滤；返回命中规则数量 hitCount
router.get('/', auth, async (req, res) => {
  const page = parseInt(req.query.page) || 1
  const pageSize = parseInt(req.query.pageSize) || 10
  const where = {}
  if (req.query.patientId) where.patient_id = req.query.patientId
  if (req.query.status) where.status = req.query.status
  if (req.user.role === 'doctor') where.doctor_id = req.user.id
  const patientName = (req.query.patientName || '').trim()
  const doctorName = (req.query.doctorName || '').trim()
  if (patientName) where['$patient.name$'] = { [Op.like]: `%${patientName}%` }
  if (doctorName) where['$doctor.name$'] = { [Op.like]: `%${doctorName}%` }
  const { rows, count } = await MedicalOrder.findAndCountAll({
    where,
    include: [
      { model: Patient, as: 'patient' },
      { model: User, as: 'doctor', attributes: ['id', 'name'] }
    ],
    limit: pageSize,
    offset: (page - 1) * pageSize,
    order: [['created_at', 'DESC']]
  })
  // 批量统计每条医嘱命中的规则数（status !== 'pass' 即命中）
  const orderIds = rows.map(r => r.id)
  const records = orderIds.length
    ? await AuditRecord.findAll({ where: { order_id: orderIds }, attributes: ['order_id', 'status'] })
    : []
  const hitMap = {}
  for (const r of records) {
    if (r.status !== 'pass') hitMap[r.order_id] = (hitMap[r.order_id] || 0) + 1
  }
  const list = rows.map(r => {
    const o = r.toJSON()
    o.hitCount = hitMap[r.id] || 0
    return o
  })
  res.json({ code: 0, data: { list, total: count }, message: 'ok' })
})

// GET /api/orders/:id  医嘱详情（含处方、审核结果）
router.get('/:id', auth, async (req, res) => {
  const order = await MedicalOrder.findByPk(req.params.id, {
    include: [
      { model: Patient, as: 'patient' },
      { model: User, as: 'doctor', attributes: ['id', 'name'] },
      { model: Prescription, as: 'prescriptions', include: [{ model: Drug, as: 'drug' }] },
      { model: AuditRecord, as: 'auditRecords' }
    ]
  })
  if (!order) return res.status(404).json({ code: 404, message: '医嘱不存在' })
  res.json({ code: 0, data: order, message: 'ok' })
})

// POST /api/orders/:id/submit  提交医嘱 → 触发规则引擎审核（核心闭环）
router.post('/:id/submit', auth, role('doctor', 'admin'), async (req, res) => {
  const order = await MedicalOrder.findByPk(req.params.id)
  if (!order) return res.status(404).json({ code: 404, message: '医嘱不存在' })
  if (order.status !== 'draft' && order.status !== 'rejected') {
    return res.status(400).json({ code: 400, message: '仅草稿或已驳回的医嘱可提交' })
  }
  const t = await sequelize.transaction()
  try {
    await order.update({ status: 'submitted' }, { transaction: t })
    const { violations, checked } = await auditOrder(order.id) // 规则引擎返回富结构

    for (const v of violations) {
      await AuditRecord.create({
        order_id: order.id, rule_id: v.rule_id, category: v.category, checked_count: checked,
        status: v.severity,
        message: `[${v.rule_code}] ${v.reason} | 依据：${v.legal_basis} | 建议：${v.suggestion || '无'}`,
        details: v  // 完整富结构存 JSON
      }, { transaction: t })
    }
    if (violations.length === 0) {
      // pass 记录写明：对照了 X 条规则全部通过 + 列出对照规则编号
      const ruleList = await AuditRule.findAll({ where: { enabled: true }, attributes: ['code', 'name'] })
      const checkedSummary = ruleList.map(r => r.code).join('、')
      await AuditRecord.create({
        order_id: order.id, status: 'pass', checked_count: checked,
        message: `已对照 ${checked} 条规则（${checkedSummary}），全部通过`
      }, { transaction: t })
      await order.update({ status: 'audited' }, { transaction: t })
    } else {
      const hasReject = violations.some(v => v.severity === 'reject')
      await order.update({ status: hasReject ? 'rejected' : 'audited' }, { transaction: t })
    }
    await AuditLog.create({ order_id: order.id, action: 'submit', operator_id: req.user.id, content: '提交审核' }, { transaction: t })
    await t.commit()
    res.json({ code: 0, data: { status: order.status, violations, checked }, message: 'ok' })
  } catch (e) {
    await t.rollback()
    throw e
  }
})

// POST /api/orders/:id/reject  人工驳回（仅管理员，医生不能驳回自己的单）
router.post('/:id/reject', auth, role('admin'), async (req, res) => {
  const order = await MedicalOrder.findByPk(req.params.id)
  if (!order) return res.status(404).json({ code: 404, message: '医嘱不存在' })
  await order.update({ status: 'rejected' })
  await AuditLog.create({ order_id: order.id, action: 'reject', operator_id: req.user.id, content: '人工驳回' })
  res.json({ code: 0, message: 'ok' })
})

module.exports = router
