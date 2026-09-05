const router = require('express').Router()
const { Op, QueryTypes } = require('sequelize')
const { sequelize, AuditRecord, AuditRule } = require('../models')
const auth = require('../middlewares/auth')
const role = require('../middlewares/role')

// GET /api/stats/violations  违规统计：按天趋势 + 按科室分布
router.get('/violations', auth, role('admin'), async (req, res) => {
  // 1. 按天统计违规数（排除 pass）—— 单表聚合，ORM 够用
  const byDay = await AuditRecord.findAll({
    attributes: [
      [sequelize.fn('DATE', sequelize.col('created_at')), 'day'],
      [sequelize.fn('COUNT', sequelize.col('AuditRecord.id')), 'count']
    ],
    where: { status: { [Op.ne]: 'pass' } },
    group: [sequelize.fn('DATE', sequelize.col('created_at'))],
    order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
    raw: true
  })

  // 2. 按科室统计违规数 —— 三层 JOIN 聚合，ORM 嵌套 include 触发 only_full_group_by 报错，
  //    改用原生 SQL（实战取舍：复杂统计用原生 SQL，可读性和性能都更好）
  const byDept = await sequelize.query(
    `SELECT d.id AS dept_id, d.name AS dept_name, COUNT(ar.id) AS count
     FROM audit_record ar
     JOIN medical_order mo ON ar.order_id = mo.id
     JOIN \`user\` u ON mo.doctor_id = u.id
     JOIN department d ON u.dept_id = d.id
     WHERE ar.status != 'pass'
     GROUP BY d.id, d.name
     ORDER BY count DESC`,
    { type: QueryTypes.SELECT }
  )

  res.json({ code: 0, data: { byDay, byDept }, message: 'ok' })
})

// GET /api/stats/rule-distribution  违规类型分布（饼图数据）
router.get('/rule-distribution', auth, role('admin'), async (req, res) => {
  const list = await AuditRecord.findAll({
    attributes: [
      [sequelize.col('rule.name'), 'rule_name'],
      [sequelize.fn('COUNT', sequelize.col('AuditRecord.id')), 'count']
    ],
    include: [{ model: AuditRule, as: 'rule' }],
    where: { status: { [Op.ne]: 'pass' } },
    group: [sequelize.col('rule.id')],
    raw: true
  })
  res.json({ code: 0, data: list, message: 'ok' })
})

// GET /api/stats/rule-quality  规则命中质量：每条规则触发次数 + 硬性拦截(reject)次数 + 拦截率
// 用于评估规则库有效性（触发频次高且拦截率合理 → 规则有效；长期 0 触发 → 可下线）
router.get('/rule-quality', auth, role('admin'), async (req, res) => {
  const rows = await sequelize.query(
    `SELECT r.code AS rule_code, r.name AS rule_name, r.severity AS severity,
            COUNT(ar.id) AS total,
            SUM(CASE WHEN ar.status = 'reject' THEN 1 ELSE 0 END) AS reject_count
     FROM audit_record ar
     JOIN audit_rule r ON ar.rule_id = r.id
     WHERE ar.status != 'pass'
     GROUP BY r.id, r.code, r.name, r.severity
     ORDER BY total DESC`,
    { type: QueryTypes.SELECT }
  )
  const data = rows.map(d => {
    const total = Number(d.total) || 0
    const rejectCount = Number(d.reject_count) || 0
    return {
      rule_code: d.rule_code,
      rule_name: d.rule_name,
      severity: d.severity,
      total,
      rejectCount,
      rejectRate: total ? Math.round((rejectCount / total) * 100) : 0
    }
  })
  res.json({ code: 0, data, message: 'ok' })
})

module.exports = router
