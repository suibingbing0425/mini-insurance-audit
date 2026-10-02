// 药房瘦身：只保留能触发 EXE 规则的药，删除其余"哑药"。
// 安全措施：
//   1) 先把 drug 表全量备份到 data/drugs-backup-*.json（E盘副本内）
//   2) 跳过被 prescription 外键引用的药（避免破坏历史处方，这类保留并提示）
//   3) 只删除【无引用 + 不在任何 EXE 规则中】的药
// 用法：node scripts/cleanup-dummy-drugs.js   （--apply 才真正删除，默认仅预览）
const fs = require('fs')
const path = require('path')
const { sequelize, Drug, Prescription, AuditRule } = require('../src/models')
const { Op } = require('sequelize')
const APPLY = process.argv.includes('--apply')

;(async () => {
  const rules = await AuditRule.findAll({ where: { code: { [Op.like]: 'EXE%' }, enabled: true }, raw: true })
  const triggerable = new Set()
  for (const r of rules) {
    const e = typeof r.expression === 'string' ? JSON.parse(r.expression) : r.expression
    if (!e) continue
    if (e.drug) triggerable.add(e.drug)
    if (Array.isArray(e.drugs)) for (const d of e.drugs) triggerable.add(d)
  }
  const drugs = await Drug.findAll({ raw: true })
  const toDelete = drugs.filter(d => !triggerable.has(d.name))

  // 被处方引用的药不能删
  const rows = await Prescription.findAll({ attributes: ['drug_id'], group: ['drug_id'], raw: true })
  const referenced = new Set(rows.map(r => r.drug_id))
  const deletable = toDelete.filter(d => !referenced.has(d.id))
  const keepReferenced = toDelete.filter(d => referenced.has(d.id))

  // 备份
  const bak = path.join(__dirname, '..', 'data', `drugs-backup-${new Date().toISOString().slice(0, 10)}.json`)
  fs.writeFileSync(bak, JSON.stringify(drugs, null, 2), 'utf-8')
  console.log('备份已写入:', bak)

  console.log(`药房总数: ${drugs.length}`)
  console.log(`可触发规则的药: ${drugs.length - toDelete.length} | 哑药: ${toDelete.length}`)
  console.log(`哑药中被处方引用的(保留): ${keepReferenced.length} | 可安全删除: ${deletable.length}`)
  if (keepReferenced.length) console.log('  保留(被引用):', keepReferenced.map(d => d.name).join('、'))
  if (!APPLY) {
    console.log('\n[预览模式] 未删除。确认后加 --apply 执行。')
    console.log('将删除:', deletable.map(d => d.name).join('、'))
    await sequelize.close()
    return
  }

  if (deletable.length) {
    await Drug.destroy({ where: { id: { [Op.in]: deletable.map(d => d.id) } } })
    console.log(`\n已删除 ${deletable.length} 个哑药`)
  }
  const left = await Drug.count()
  console.log(`删除后药房剩: ${left} 个（应全部可触发规则）`)
  await sequelize.close()
})()
