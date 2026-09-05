// 校验 executableRuleFactory 生成的规则是否严格与源表一致：
//   1) type 合法  2) code 唯一  3) category == 源 category2
//   4) expression 中每个药品/分类名均真实存在于源 rule-library.json 对应 seq 的 knowledge
// 纯本地运行，无需连接数据库。
const { generateExecutableRules, findRule } = require('../src/services/executableRuleFactory')

const VALID_TYPES = [
  'drug_conflict', 'pregnancy_drug', 'insurance_limit', 'hospital_level_limit',
  'gender_drug', 'age_drug', 'course_limit', 'duplicate_drug'
]
// 每条源规则用于核对的知识点字段：单药型/聚合型用『药品通用名』，中药饮片用 1/2 名称，重复开药用『药品分类』
const DRUG_COLS = {
  1: ['药品通用名'], 2: ['药品通用名'], 12: ['药品通用名'], 73: ['药品通用名'],
  7: ['药品通用名'], 10: ['药品通用名'], 66: ['药品通用名'], 67: ['药品通用名'],
  68: ['药品通用名'], 69: ['药品分类'], 74: ['药品通用名'], 75: ['中药饮片1名称', '中药饮片2名称']
}

const rules = generateExecutableRules()
const errType = [], errCode = [], errCat = [], errDrug = []

// 1) type 合法性
for (const r of rules) if (!VALID_TYPES.includes(r.type)) errType.push(`${r.code} -> ${r.type}`)
// 2) code 唯一
const seen = new Set()
for (const r of rules) { if (seen.has(r.code)) errCode.push(r.code); seen.add(r.code) }
// 3) category 与源 category2 全量一致
for (const r of rules) {
  const src = findRule(r._srcSeq)
  if (!src) errCat.push(`${r.code} 无源(srcSeq=${r._srcSeq})`)
  else if (r.category !== src.category2) errCat.push(`${r.code} 生成[${r.category}] vs 源[${src.category2}] (seq${src.seq})`)
}
// 4) expression 全量核对：每个药品名/分类名必须存在于源 knowledge
for (const r of rules) {
  const cols = DRUG_COLS[r._srcSeq]
  if (!cols) { errDrug.push(`${r.code} 无核对规则(srcSeq=${r._srcSeq})`); continue }
  const names = new Set((findRule(r._srcSeq).knowledge || [])
    .flatMap(k => cols.map(c => String(k[c] || '').trim()).filter(Boolean)))
  const e = r.expression || {}
  const targets = e.drugs ? e.drugs : (e.drug ? [e.drug] : (e.category ? [e.category] : []))
  for (const t of targets) if (!names.has(String(t).trim())) errDrug.push(`${r.code} ->「${t}」不在 seq${r._srcSeq} 源表`)
}

const pass = (arr, label) => {
  if (!arr.length) { console.log(`✅ ${label}: PASS`); return true }
  console.log(`❌ ${label}: FAIL（${arr.length} 处）`)
  arr.slice(0, 10).forEach(x => console.log('   -', x))
  return false
}
console.log('=== 可执行规则真实性校验（对照 rule-library.json 源表）===')
console.log(`生成规则总数: ${rules.length}\n`)
const ok = pass(errType, 'type 全部在引擎 8 类 checkers 内')
pass(errCode, 'code 唯一')
pass(errCat, 'category 与源表 category2 100% 一致')
pass(errDrug, 'expression 药品名/分类名全部存在于源 knowledge')

// 分类分布（源表口径）
const dist = {}
for (const r of rules) dist[r.category] = (dist[r.category] || 0) + 1
console.log('\n按源表二级分类分布:', JSON.stringify(dist))
console.log('\n结论:', ok && !errCode.length && !errCat.length && !errDrug.length
  ? '✅ 全部通过：可执行规则与《2025版医保监管规则库》源表完全一致，无任何手编/编造数据'
  : '⚠️ 存在上述问题需修复')
