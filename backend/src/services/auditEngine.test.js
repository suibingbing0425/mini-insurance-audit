import { describe, it, expect } from 'vitest'
import auditEngine from './auditEngine'

const { checkers, auditByOrder } = auditEngine

// 构造一条"医嘱"测试数据
function makeOrder(prescriptions, patient = {}, extra = {}) {
  return {
    patient,
    hospital_level: extra.hospital_level || '二级',
    visit_type: extra.visit_type || '门急诊',
    prescriptions: prescriptions.map((p, i) => ({
      id: p.id ?? i + 1,
      drug_id: p.drug_id ?? i + 1,
      single_dose: p.single_dose ?? 0,
      days: p.days ?? 1,
      drug: { name: p.name, category: p.category, max_dose: p.max_dose }
    }))
  }
}

describe('checkers - 纯规则命中', () => {
  it('drug_conflict: 同时存在两种配伍禁忌药 -> 命中', () => {
    const order = makeOrder([{ name: '药A' }, { name: '药B' }])
    const r = checkers.drug_conflict(order, { drugs: ['药A', '药B'] })
    expect(r).not.toBeNull()
    expect(r.reason).toContain('药A')
  })

  it('drug_conflict: 仅一种 -> 不命中', () => {
    const order = makeOrder([{ name: '药A' }])
    expect(checkers.drug_conflict(order, { drugs: ['药A', '药B'] })).toBeNull()
  })

  it('dose: 超规则上限 -> 命中', () => {
    const order = makeOrder([{ name: '药A', single_dose: 100 }])
    expect(checkers.dose(order, { drug: '药A', maxDose: 50 })).not.toBeNull()
  })

  it('dose: 取规则与药品目录更严格者（目录80<规则100，剂量90应命中）', () => {
    const order = makeOrder([{ name: '药A', single_dose: 90, max_dose: 80 }])
    const r = checkers.dose(order, { drug: '药A', maxDose: 100 })
    expect(r).not.toBeNull()
    expect(r.reason).toContain('80')
  })

  it('dose: 未超限 -> 不命中', () => {
    const order = makeOrder([{ name: '药A', single_dose: 40, max_dose: 80 }])
    expect(checkers.dose(order, { drug: '药A', maxDose: 100 })).toBeNull()
  })

  it('gender_drug: 性别不符 -> 命中', () => {
    const order = makeOrder([{ name: '药A' }], { gender: '男' })
    expect(checkers.gender_drug(order, { drug: '药A', allowedGender: '女' })).not.toBeNull()
  })

  it('gender_drug: 性别相符 -> 不命中', () => {
    const order = makeOrder([{ name: '药A' }], { gender: '女' })
    expect(checkers.gender_drug(order, { drug: '药A', allowedGender: '女' })).toBeNull()
  })

  it('age_drug: 低于 minAge -> 命中', () => {
    const order = makeOrder([{ name: '药A' }], { age: 10 })
    expect(checkers.age_drug(order, { drug: '药A', minAge: 18 })).not.toBeNull()
  })

  it('age_drug: 高于 maxAge -> 命中', () => {
    const order = makeOrder([{ name: '药A' }], { age: 80 })
    expect(checkers.age_drug(order, { drug: '药A', maxAge: 70 })).not.toBeNull()
  })

  it('age_drug: 区间内 -> 不命中', () => {
    const order = makeOrder([{ name: '药A' }], { age: 40 })
    expect(checkers.age_drug(order, { drug: '药A', minAge: 18, maxAge: 70 })).toBeNull()
  })

  it('course_limit: 超疗程 -> 命中', () => {
    const order = makeOrder([{ name: '药A', days: 30 }])
    expect(checkers.course_limit(order, { drug: '药A', maxDays: 14 })).not.toBeNull()
  })

  it('course_limit: 未超疗程 -> 不命中', () => {
    const order = makeOrder([{ name: '药A', days: 7 }])
    expect(checkers.course_limit(order, { drug: '药A', maxDays: 14 })).toBeNull()
  })

  it('duplicate_drug: 同类两种 -> 命中', () => {
    const order = makeOrder([{ name: '药A', category: '抗菌药' }, { name: '药B', category: '抗菌药' }])
    expect(checkers.duplicate_drug(order, { category: '抗菌药' })).not.toBeNull()
  })

  it('duplicate_drug: 同类一种 -> 不命中', () => {
    const order = makeOrder([{ name: '药A', category: '抗菌药' }])
    expect(checkers.duplicate_drug(order, { category: '抗菌药' })).toBeNull()
  })

  it('pregnancy_drug: 妊娠期 -> 命中', () => {
    const order = makeOrder([{ name: '药A' }], { pregnancy_status: true })
    expect(checkers.pregnancy_drug(order, { drugs: ['药A'] })).not.toBeNull()
  })

  it('pregnancy_drug: 非妊娠 -> 不命中', () => {
    const order = makeOrder([{ name: '药A' }], { pregnancy_status: false })
    expect(checkers.pregnancy_drug(order, { drugs: ['药A'] })).toBeNull()
  })

  it('insurance_limit: 医保类型不符 -> 命中', () => {
    const order = makeOrder([{ name: '药A' }], { insurance_type: '居民医保' })
    expect(checkers.insurance_limit(order, { drugs: ['药A'], allowedInsurance: ['职工医保'] })).not.toBeNull()
  })

  it('insurance_limit: 符合 -> 不命中', () => {
    const order = makeOrder([{ name: '药A' }], { insurance_type: '职工医保' })
    expect(checkers.insurance_limit(order, { drugs: ['药A'], allowedInsurance: ['职工医保'] })).toBeNull()
  })

  it('hospital_level_limit: 级别不足 -> 命中', () => {
    const order = makeOrder([{ name: '药A' }], {}, { hospital_level: '一级及以下' })
    expect(checkers.hospital_level_limit(order, { drugs: ['药A'], minLevel: '二级' })).not.toBeNull()
  })

  it('hospital_level_limit: 级别足够 -> 不命中', () => {
    const order = makeOrder([{ name: '药A' }], {}, { hospital_level: '三级' })
    expect(checkers.hospital_level_limit(order, { drugs: ['药A'], minLevel: '二级' })).toBeNull()
  })
})

describe('checkers - frequency（注入计数函数）', () => {
  it('近期有重复处方 -> 命中', async () => {
    const order = makeOrder([{ name: '药A', drug_id: 5 }], { id: 99 })
    const r = await checkers.frequency(order, { drug: '药A', days: 7 }, { countFn: async () => 2 })
    expect(r).not.toBeNull()
    expect(r.reason).toContain('2')
  })

  it('无重复 -> 不命中', async () => {
    const order = makeOrder([{ name: '药A', drug_id: 5 }], { id: 99 })
    expect(await checkers.frequency(order, { drug: '药A', days: 7 }, { countFn: async () => 0 })).toBeNull()
  })
})

describe('auditByOrder - 聚合与排序', () => {
  it('聚合命中的规则，并按 priority 降序排列', async () => {
    const rules = [
      { id: 2, code: 'R2', name: '低优先级', type: 'dose', expression: { drug: '药A', maxDose: 10 }, severity: 'warn', category: 'c', suggestion: 's', legal_basis: 'l', priority: 1, enabled: true },
      { id: 1, code: 'R1', name: '高优先级', type: 'dose', expression: { drug: '药A', maxDose: 10 }, severity: 'reject', category: 'c', suggestion: 's', legal_basis: 'l', priority: 9, enabled: true }
    ]
    const order = makeOrder([{ name: '药A', single_dose: 100 }])
    const { violations } = await auditByOrder(order, rules)
    expect(violations.length).toBe(2)
    expect(violations[0].rule_code).toBe('R1') // priority 9 排前面
    expect(violations[0].severity).toBe('reject')
    expect(violations[0].reason).toContain('100')
  })

  it('expression 为字符串也能正确解析', async () => {
    const rules = [
      { id: 3, code: 'R3', name: '配伍规则', type: 'drug_conflict', expression: JSON.stringify({ drugs: ['药A', '药B'] }), severity: 'warn', category: 'c', suggestion: 's', legal_basis: 'l', priority: 5, enabled: true }
    ]
    const order = makeOrder([{ name: '药A' }, { name: '药B' }])
    const { violations } = await auditByOrder(order, rules)
    expect(violations.length).toBe(1)
    expect(violations[0].rule_code).toBe('R3')
  })
})
