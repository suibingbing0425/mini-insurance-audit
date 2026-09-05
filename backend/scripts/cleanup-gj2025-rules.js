// 清理两类已废弃的规则：
//   - code LIKE 'GJ2025%'   ：旧版手编示例规则（法律依据为编造）
//   - code LIKE 'EXE-INT74%'：药品相互作用自动提取不合格被移除的规则
// 步骤：先将 audit_record 中引用它们的 rule_id 置空（保留历史审核记录本身），再删除规则。
// 只清理废弃规则，绝不触碰其他业务数据。
const { sequelize, AuditRule } = require('../src/models')
const { Op } = require('sequelize')

;(async () => {
  const patterns = ['GJ2025%', 'EXE-INT74%']
  for (const p of patterns) {
    const cnt = await AuditRule.count({ where: { code: { [Op.like]: p } } })
    console.log(`\n模式 ${p}: 现有规则 ${cnt} 条`)
    if (!cnt) continue
    const [upd] = await sequelize.query(
      `UPDATE audit_record SET rule_id = NULL WHERE rule_id IN (SELECT id FROM audit_rule WHERE code LIKE '${p}')`
    )
    console.log(`  已解除 audit_record 外键引用: ${upd.affectedRows} 行（历史记录保留，rule_id 置空）`)
    const deleted = await AuditRule.destroy({ where: { code: { [Op.like]: p } } })
    console.log(`  已删除: ${deleted} 条`)
  }
  const left = await AuditRule.count()
  console.log(`\n清理完成，audit_rule 现存 ${left} 条（仅真实规则库生成的可执行规则）`)
  await sequelize.close()
})()
