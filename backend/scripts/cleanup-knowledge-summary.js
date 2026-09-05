// 清理 rule_knowledge 知识条目中的"合计/总计/小计"汇总行
// （源 Excel 明细 sheet 末尾常见，gen-rule-library.py 当年未过滤）
// 过滤规则：knowledge 数组里任一字段值 ∈ BAD_WORDS 的整行剔除
// 真实数据损失：无（这些行本身是 Excel 汇总行，不是具体药/项/检查）
const { sequelize, AuditKnowledge } = require('../src/models')
const BAD = new Set(['合计', '总计', '小计'])

;(async () => {
  const rows = await AuditKnowledge.findAll()
  let affected = 0, totalRemoved = 0
  for (const r of rows) {
    const k = Array.isArray(r.knowledge) ? r.knowledge : []
    if (!k.length) continue
    const filtered = k.filter(item => !Object.values(item).some(v => BAD.has(String(v || '').trim())))
    if (filtered.length !== k.length) {
      await r.update({ knowledge: filtered })
      affected++
      totalRemoved += k.length - filtered.length
      console.log(`seq${r.seq} | ${r.name} | ${k.length} → ${filtered.length} 条（剔除 ${k.length - filtered.length} 行合计）`)
    }
  }
  console.log(`\n清理完成：${affected} 条规则受影响，共剔除 ${totalRemoved} 行汇总行`)
  await sequelize.close()
})()
