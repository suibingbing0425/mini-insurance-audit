// 从真实的《2025版医保监管规则库》rule-library.json 抽取「算法可判定」的可执行规则。
// 关键点：规则名 / 参数（药品名、阈值、性别、医保类型、机构级别、中药饮片对）/ 法律依据
//        / 分类（category1/category2）全部严格取自源表数据，不手工编造、不自行归类。
// 分类口径：category 字段 = 源规则在官方 Excel 中的二级分类 category2（如「药品合理使用类」），
//           与源表 100% 一致；_srcSeq 为内部溯源标记（标识来自 88 条源表的哪一条，不落库）。
// 仅抽取「药品维度 + 引擎已支持」的规则（其余政策类规则保留在 rule_knowledge 知识库，由人工审核）。
const fs = require('fs')
const path = require('path')

const LIB = path.join(__dirname, '../../data/rule-library.json')
const rules88 = JSON.parse(fs.readFileSync(LIB, 'utf-8')).rules

const findRule = (seq) => rules88.find(r => r.seq === seq)
const kws = (seq) => (findRule(seq) && findRule(seq).knowledge) || []
const col = (obj, ...names) => {
  for (const n of names) if (obj[n] != null && String(obj[n]).trim() !== '') return String(obj[n]).trim()
  return ''
}
// 取文本中所有整数，返回最大值（"限3-12岁" -> 12；"不超过14天" -> 14）
const maxInt = (text) => {
  const m = String(text || '').match(/\d+/g)
  return m ? Math.max(...m.map(Number)) : null
}
// 源表末尾常见"合计/总计/小计"汇总行，须剔除，避免把非药品行误当药品名
const BAD_WORDS = new Set(['合计', '总计', '小计'])
const uniq = (arr) => [...new Set(arr.filter(v => v && !BAD_WORDS.has(String(v).trim())))]

function generateExecutableRules() {
  const out = []
  // add(rule, srcSeq)：srcSeq 为源 88 条规则中的序号，category 自动取源表的 category2
  const add = (r, srcSeq) => {
    const src = findRule(srcSeq)
    if (!src) throw new Error(`源规则不存在: seq=${srcSeq}`)
    r.category = src.category2          // 严格按官方 Excel 的二级分类，不自造类别
    r._srcSeq = srcSeq                  // 溯源标记（不落库，seed 写入前删除）
    out.push(r)
  }

  // ===== 聚合型（一个 rule 覆盖一类药品）=====
  // 妊娠期及哺乳期用药安全 (seq73) -> pregnancy_drug
  {
    const drugs = uniq(kws(73).map(x => col(x, '药品通用名')))
    if (drugs.length) add({
      code: 'EXE-PREG-001', name: '妊娠期及哺乳期用药安全', type: 'pregnancy_drug',
      expression: { drugs }, severity: 'reject', priority: 100,
      legal_basis: '依据《药品说明书》关于妊娠期及哺乳期用药禁忌描述：妊娠期及哺乳期患者禁用相关药品',
      suggestion: '建议更换为妊娠期及哺乳期安全性明确的替代药品'
    }, 73)
  }
  // 药品限工伤保险 (seq1) -> insurance_limit
  {
    const drugs = uniq(kws(1).map(x => col(x, '药品通用名')))
    if (drugs.length) add({
      code: 'EXE-INS-001', name: '药品限工伤保险', type: 'insurance_limit',
      expression: { drugs, allowedInsurance: ['工伤保险'] }, severity: 'reject', priority: 100,
      legal_basis: '依据《2025版国家药品目录备注》：限工伤保险',
      suggestion: '非工伤保险参保人员使用该药品不予支付'
    }, 1)
  }
  // 药品限生育保险 (seq2) -> insurance_limit
  {
    const drugs = uniq(kws(2).map(x => col(x, '药品通用名')))
    if (drugs.length) add({
      code: 'EXE-INS-002', name: '药品限生育保险', type: 'insurance_limit',
      expression: { drugs, allowedInsurance: ['生育保险'] }, severity: 'reject', priority: 100,
      legal_basis: '依据《2025版国家药品目录备注》：限生育保险',
      suggestion: '非生育保险参保人员使用该药品不予支付'
    }, 2)
  }
  // 药品限医疗机构级别 (seq12) -> hospital_level_limit
  {
    const drugs = uniq(kws(12).map(x => col(x, '药品通用名')))
    if (drugs.length) add({
      code: 'EXE-HOSP-001', name: '药品限医疗机构级别', type: 'hospital_level_limit',
      expression: { drugs, minLevel: '二级' }, severity: 'reject', priority: 100,
      legal_basis: '依据《2025版国家药品目录备注》：限二级及以上医疗机构',
      suggestion: '该药品仅限二级及以上医疗机构使用，基层医疗机构不予支付'
    }, 12)
  }
  // 药品区分性别使用 (seq67) -> gender_drug（按性别拆成两条，均溯源 seq67）
  {
    const k = kws(67)
    const male = uniq(k.filter(x => col(x, '限定性别') === '男').map(x => col(x, '药品通用名')))
    const female = uniq(k.filter(x => col(x, '限定性别') === '女').map(x => col(x, '药品通用名')))
    if (male.length) add({
      code: 'EXE-GENDER-M', name: '药品限男性使用', type: 'gender_drug',
      expression: { drugs: male, allowedGender: '男' }, severity: 'reject', priority: 100,
      legal_basis: '依据《药品说明书适应症》：限男性患者使用',
      suggestion: '该药品仅限男性使用，女性患者禁止使用'
    }, 67)
    if (female.length) add({
      code: 'EXE-GENDER-F', name: '药品限女性使用', type: 'gender_drug',
      expression: { drugs: female, allowedGender: '女' }, severity: 'reject', priority: 100,
      legal_basis: '依据《药品说明书适应症》：限女性患者使用',
      suggestion: '该药品仅限女性使用，男性患者禁止使用'
    }, 67)
  }

  // ===== 每药阈值型（每条规则一个药品 + 阈值）=====
  // 药品儿童禁用 (seq66) -> age_drug maxAge
  for (const x of kws(66)) {
    const name = col(x, '药品通用名'); const maxAge = maxInt(col(x, '儿童禁用年龄阈值'))
    if (!name || BAD_WORDS.has(name) || !maxAge) continue
    add({
      code: `EXE-AGE66-${col(x, '序号')}`, name: `儿童禁用：${name}`, type: 'age_drug',
      expression: { drug: name, maxAge }, severity: 'reject', priority: 100,
      legal_basis: `依据《药品说明书儿童用药》：${col(x, '儿童禁用年龄阈值')}以下小儿禁用`,
      suggestion: '儿童禁用，建议更换为适龄药品'
    }, 66)
  }
  // 药品限儿童使用 (seq7) -> age_drug maxAge（取年龄上限）
  for (const x of kws(7)) {
    const name = col(x, '药品通用名'); const maxAge = maxInt(col(x, '逻辑依据（2025版国家药品目录备注）'))
    if (!name || BAD_WORDS.has(name) || !maxAge) continue
    add({
      code: `EXE-AGE7-${col(x, '序号')}`, name: `限儿童使用：${name}`, type: 'age_drug',
      expression: { drug: name, maxAge }, severity: 'reject', priority: 90,
      legal_basis: '依据《2025版国家药品目录备注》：限相应年龄范围内儿童使用',
      suggestion: '仅限相应年龄儿童使用，成人不予支付'
    }, 7)
  }
  // 药品限支付疗程 (seq10) -> course_limit maxDays
  for (const x of kws(10)) {
    const name = col(x, '药品通用名'); const maxDays = maxInt(col(x, '逻辑依据（2025版国家药品目录备注）'))
    if (!name || BAD_WORDS.has(name) || !maxDays) continue
    add({
      code: `EXE-COURSE10-${col(x, '序号')}`, name: `限支付疗程：${name}`, type: 'course_limit',
      expression: { drug: name, maxDays }, severity: 'reject', priority: 90,
      legal_basis: `依据《2025版国家药品目录备注》：支付不超过 ${maxDays} 天`,
      suggestion: '超出限定支付疗程部分不予支付'
    }, 10)
  }
  // 超说明书用量开药 (seq68) -> course_limit maxDays（最大开药天数）
  for (const x of kws(68)) {
    const name = col(x, '药品通用名'); const maxDays = maxInt(col(x, '最大开药天数'))
    if (!name || BAD_WORDS.has(name) || !maxDays) continue
    add({
      code: `EXE-COURSE68-${col(x, '序号')}`, name: `最大开药天数：${name}`, type: 'course_limit',
      expression: { drug: name, maxDays }, severity: 'warn', priority: 60,
      legal_basis: '依据《处方管理办法》《长期处方管理规范（试行）》',
      suggestion: '不得超过最大开药天数'
    }, 68)
  }
  // 重复开药 (seq69) -> duplicate_drug（按药品分类聚合）
  {
    const groups = {}
    for (const x of kws(69)) {
      const c = col(x, '药品分类'); if (!c) continue
      ;(groups[c] = groups[c] || []).push(col(x, '药品通用名'))
    }
    let i = 0
    for (const [cat] of Object.entries(groups)) {
      i++
      add({
        code: `EXE-DUP69-${i}`, name: `重复开药（${cat}）`, type: 'duplicate_drug',
        expression: { category: cat }, severity: 'warn', priority: 60,
        legal_basis: '依据国家药品目录药品分类：同次处方开具同一分类组号内两种及以上药品存在重复用药风险',
        suggestion: '避免同类（同分类组号）药品重复开具'
      }, 69)
    }
  }
  // 中药饮片配伍禁忌 (seq75) -> drug_conflict（每对一条）
  for (const x of kws(75)) {
    const a = col(x, '中药饮片1名称'); const b = col(x, '中药饮片2名称')
    if (!a || !b || BAD_WORDS.has(a) || BAD_WORDS.has(b)) continue
    add({
      code: `EXE-TCM75-${col(x, '序号')}`, name: `中药配伍禁忌：${a}+${b}`, type: 'drug_conflict',
      expression: { drugs: [a, b] }, severity: 'reject', priority: 100,
      legal_basis: '依据《中国药典》《中药大辞典》等关于中药饮片配伍禁忌（十八反/十九畏）',
      suggestion: '两味中药饮片存在配伍禁忌，禁止同方使用'
    }, 75)
  }
  // 药品相互作用 (seq74)：源 knowledge 的"逻辑依据"为药品说明书自由文本（如"禁止与强效CYP1A2
  // 抑制剂（如氟伏沙明…）合用"），无法可靠自动结构化出具体药品对（会提取出"抑制剂/底物"等类别词，
  // 经校验 21/28 条不合格）。按"只有算法可判定的才进 audit_rule"原则，此条不生成可执行规则，
  // 保留在 rule_knowledge 知识库作人工参考依据。
  // （如需人工录入，可在 Tab2 手工新增 drug_conflict 规则并填准确药品对）

  return out
}

module.exports = { generateExecutableRules, findRule }
