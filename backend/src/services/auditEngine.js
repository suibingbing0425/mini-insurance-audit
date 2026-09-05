// ★ 规则引擎（核心）—— 策略模式：checker 注册表 + 统一富结构
// 每个 checker 返回 { reason } 或 null，由 auditOrder 拼成完整 violation 对象
const { Op } = require('sequelize')
const { MedicalOrder, Prescription, Drug, AuditRule, Patient } = require('../models')

const checkers = {
  // 配伍禁忌：处方里同时出现 expr.drugs 中的任意两个及以上
  drug_conflict(order, expr) {
    const names = order.prescriptions.map(p => p.drug.name)
    const hit = expr.drugs.filter(d => names.includes(d))
    if (hit.length >= 2) {
      return { reason: `处方中同时存在「${hit.join('」与「')}」两种药品，二者存在配伍禁忌，可能导致药效降低或毒副作用增加` }
    }
    return null
  },

  // 重复用药：expr.days 天内同一药品（或 expr.drug 限定，或 expr.category 限定）重复开具
  // ★ 修复 2026-08-22：必须按 patient_id 隔离，否则会把【其他病人】的历史处方误报给当前新病人
  // ctx.countFn 可注入（用于单元测试，生产默认走 Prescription.count）
  async frequency(order, expr, ctx) {
    const days = expr.days || 7
    // 当前病人 id：兼容「DB 真实医嘱（order.patient_id）」与「precheck 虚拟医嘱（仅 order.patient 对象）」两种场景
    const patientId = order.patient_id || (order.patient && order.patient.id)
    if (!patientId) return null
    const countFn = (ctx && ctx.countFn) || ((q) => Prescription.count(q))
    for (const p of order.prescriptions) {
      if (expr.drug && p.drug.name !== expr.drug) continue
      if (expr.category && p.drug.category !== expr.category) continue
      const count = await countFn({
        include: [{
          model: MedicalOrder,
          as: 'order',
          where: { patient_id: patientId },
          required: true
        }],
        where: {
          drug_id: p.drug_id,
          id: { [Op.ne]: p.id },
          created_at: { [Op.gte]: new Date(Date.now() - days * 86400000) }
        }
      })
      if (count > 0) {
        const target = expr.drug || (expr.category ? `同类「${expr.category}」药品（${p.drug.name}）` : p.drug.name)
        return { reason: `「${target}」在过去 ${days} 天内已有 ${count} 条处方记录，重复用药可能增加不良反应风险` }
      }
    }
    return null
  },

  // 剂量超标：取「规则上限」与「药品目录上限」中更严格（更小）的一个
  dose(order, expr) {
    for (const p of order.prescriptions) {
      if (expr.drug && p.drug.name !== expr.drug) continue
      const ruleMax = expr.maxDose ?? Infinity
      const drugMax = Number(p.drug.max_dose) || Infinity
      const limit = Math.min(ruleMax, drugMax)
      if (limit !== Infinity && Number(p.single_dose) > limit) {
        return { reason: `「${p.drug.name}」单次剂量 ${p.single_dose}mg 超出规定上限 ${limit}mg（规则上限 ${ruleMax === Infinity ? '∞' : ruleMax}mg，药品目录上限 ${drugMax === Infinity ? '∞' : drugMax}mg）` }
      }
    }
    return null
  },

  // 性别用药禁忌：expr.drug + expr.allowedGender('男'/'女')
  gender_drug(order, expr) {
    if (!order.patient || !expr.drug || !expr.allowedGender) return null
    for (const p of order.prescriptions) {
      if (p.drug.name !== expr.drug) continue
      if (order.patient.gender !== expr.allowedGender) {
        return { reason: `「${p.drug.name}」仅限【${expr.allowedGender === '女' ? '女性' : '男性'}】使用，当前患者性别为【${order.patient.gender === '女' ? '女性' : '男性'}】，属于性别禁忌` }
      }
    }
    return null
  },

  // 年龄用药禁忌：expr.drug + expr.minAge/expr.maxAge（0 表示不限）
  age_drug(order, expr) {
    if (!order.patient || !expr.drug) return null
    for (const p of order.prescriptions) {
      if (p.drug.name !== expr.drug) continue
      const age = order.patient.age
      if (expr.minAge != null && age < expr.minAge) {
        return { reason: `「${p.drug.name}」限制【${expr.minAge} 岁及以上】人群，当前患者年龄 ${age} 岁，年龄不足，存在严重不良反应风险` }
      }
      if (expr.maxAge != null && age > expr.maxAge) {
        return { reason: `「${p.drug.name}」限制【${expr.maxAge} 岁及以下】人群，当前患者年龄 ${age} 岁，超龄使用风险高` }
      }
    }
    return null
  },

  // 超疗程：单个处方天数 > expr.maxDays（支持 expr.drug 或 expr.category 限定）
  course_limit(order, expr) {
    if (!expr.maxDays) return null
    for (const p of order.prescriptions) {
      if (expr.drug && p.drug.name !== expr.drug) continue
      if (expr.category && p.drug.category !== expr.category) continue
      if (Number(p.days) > expr.maxDays) {
        const target = expr.drug || `同类「${expr.category}」药品（${p.drug.name}）`
        return { reason: `「${target}」单次处方疗程 ${p.days} 天，超出医保规定疗程上限 ${expr.maxDays} 天，可能造成医保拒付或超疗程用药风险` }
      }
    }
    return null
  },

  // 重复开药（官方第69条）：同一次处方中开具两种及以上同一类别的药品
  duplicate_drug(order, expr) {
    if (!expr.category) return null
    const sameCategory = order.prescriptions.filter(p => p.drug.category === expr.category)
    if (sameCategory.length >= 2) {
      const names = sameCategory.map(p => p.drug.name)
      return { reason: `同一次处方中开具了 ${sameCategory.length} 种「${expr.category}」类药品（${names.join('、')}），药理作用相似，存在重复用药风险` }
    }
    return null
  },

  // 妊娠期禁用（官方第73条 妊娠期及哺乳期用药安全）：妊娠中患者禁用某些药品
  pregnancy_drug(order, expr) {
    if (!order.patient || !order.patient.pregnancy_status) return null
    for (const p of order.prescriptions) {
      if (expr.drugs && expr.drugs.includes(p.drug.name)) {
        return { reason: `患者处于妊娠期，「${p.drug.name}」为妊娠期禁用药品，可能导致胎儿畸形或发育异常` }
      }
    }
    return null
  },

  // 医保类型限制：某些药品仅限特定医保类型支付（如限职工医保）
  insurance_limit(order, expr) {
    if (!order.patient || !expr.allowedInsurance) return null
    for (const p of order.prescriptions) {
      if (expr.drugs && expr.drugs.includes(p.drug.name)) {
        if (!expr.allowedInsurance.includes(order.patient.insurance_type)) {
          return { reason: `「${p.drug.name}」仅限【${expr.allowedInsurance.join('、')}】支付，当前患者医保类型为【${order.patient.insurance_type}】，不属于支付范围` }
        }
      }
    }
    return null
  },

  // 医疗机构级别限制（官方第12条 药品限医疗机构级别）：某些药品限二级以上医院使用
  hospital_level_limit(order, expr) {
    if (!expr.minLevel || !order.hospital_level) return null
    const levelMap = { '一级及以下': 1, '二级': 2, '三级': 3 }
    const orderLevel = levelMap[order.hospital_level] || 0
    const minLevel = levelMap[expr.minLevel] || 0
    for (const p of order.prescriptions) {
      if (expr.drugs && expr.drugs.includes(p.drug.name)) {
        if (orderLevel < minLevel) {
          return { reason: `「${p.drug.name}」限【${expr.minLevel}及以上】医疗机构使用，当前医嘱医疗机构级别为【${order.hospital_level}】，不符合使用条件` }
        }
      }
    }
    return null
  }
}

// 审核入口：提交医嘱时调用，返回 { violations, checked }
//   violations: 富结构数组（每个含 rule_code/legal_basis/reason/suggestion...）
//   checked: 本次对照的规则数
async function auditOrder(orderId) {
  const order = await MedicalOrder.findByPk(orderId, {
    include: [
      { model: Patient, as: 'patient' },
      { model: Prescription, as: 'prescriptions', include: [{ model: Drug, as: 'drug' }] }
    ]
  })
  if (!order) throw new Error('医嘱不存在')
  return auditByOrder(order)
}

// 取启用中的规则（按优先级降序）。抽出来便于单测注入
async function fetchEnabledRules() {
  return AuditRule.findAll({ where: { enabled: true }, order: [['priority', 'DESC'], ['id', 'ASC']] })
}

// 公共核心：传入已加载好的 order 直接审核（precheck 和 submit 复用）
// rules 可注入（便于单元测试；生产不传则由 fetchEnabledRules 取）
async function auditByOrder(order, rules) {
  if (!rules) rules = await fetchEnabledRules()
  // 防御性排序：确保命中结果按优先级降序（priority 大者在前），不依赖调用方/DB 已排序
  rules = [...rules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || (a.id ?? 0) - (b.id ?? 0))
  const violations = []
  for (const rule of rules) {
    const expr = typeof rule.expression === 'string' ? JSON.parse(rule.expression) : rule.expression
    const checker = checkers[rule.type]
    if (!checker) continue
    let result = null
    try { result = await checker(order, expr, {}) } catch { continue }
    if (result) {
      // 拼成富结构
      violations.push({
        rule_id: rule.id,
        rule_code: rule.code,
        rule_name: rule.name,
        rule_type: rule.type,
        severity: rule.severity,
        category: rule.category,
        reason: result.reason,
        suggestion: rule.suggestion || '',
        legal_basis: rule.legal_basis || '',
        priority: rule.priority
      })
    }
  }
  return { violations, checked: rules.length }
}

// 构造预审用的 order（传患者 id 时从 DB 取，否则用入参的 patient 对象）
async function buildOrderForPrecheck({ patient_id, patient, prescriptions, visit_type, hospital_level }) {
  const drugIds = [...new Set(prescriptions.map(p => p.drug_id))]
  const drugList = await Drug.findAll({ where: { id: drugIds } })
  const drugMap = Object.fromEntries(drugList.map(d => [d.id, d]))
  let patientObj = patient || null
  if (!patientObj && patient_id) patientObj = await Patient.findByPk(patient_id)
  return {
    patient: patientObj,
    visit_type: visit_type || '门急诊',
    hospital_level: hospital_level || '二级',
    prescriptions: prescriptions.map(p => ({
      id: p.id || null,
      drug_id: p.drug_id,
      single_dose: p.single_dose,
      days: p.days,
      drug: drugMap[p.drug_id] || null
    }))
  }
}

module.exports = { auditOrder, auditByOrder, fetchEnabledRules, buildOrderForPrecheck, checkers }