// 一次性迁移脚本：将 data/rule-library.json 中的政策知识库灌入 rule_knowledge 表
// 用法：
//   node scripts/migrate-rule-knowledge.js          首次灌库（已存在则跳过）
//   node scripts/migrate-rule-knowledge.js --force  清空后重新灌入
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const sequelize = require('../src/config/db')
const { AuditKnowledge } = require('../src/models')

async function main() {
  const file = path.join(__dirname, '..', 'data', 'rule-library.json')
  if (!fs.existsSync(file)) {
    console.error('未找到 data/rule-library.json，已跳过')
    process.exit(0)
  }
  const rules = JSON.parse(fs.readFileSync(file, 'utf-8')).rules || []
  console.log(`读取到 ${rules.length} 条规则知识`)

  // 数据表结构已由 migration 创建，这里不再依赖 sequelize.sync()
  // （docker 启动脚本与 npm run migrate 会先执行 db:migrate）

  const count = await AuditKnowledge.count()
  if (count > 0 && !process.argv.includes('--force')) {
    console.log(`rule_knowledge 已存在 ${count} 条，跳过（如需重建请加 --force）`)
    return
  }
  if (count > 0) {
    console.log('清空已有数据…')
    await AuditKnowledge.destroy({ where: {} })
  }

  // 过滤源表末尾"合计/总计/小计"汇总行（任一字段值命中即剔除该整行）
  const BAD = new Set(['合计', '总计', '小计'])
  const stripSummary = (arr) => (arr || []).filter(item =>
    !Object.values(item).some(v => BAD.has(String(v || '').trim()))
  )
  const rows = rules.map(r => ({
    seq: r.seq,
    category1: r.category1,
    category2: r.category2,
    name: r.name,
    hasDetail: !!r.hasDetail,
    knowledge: r.hasDetail ? stripSummary(r.knowledge) : (r.knowledge || null)
  }))
  // 分批插入，避免单次 bulkCreate 包过大
  const BATCH = 500
  for (let i = 0; i < rows.length; i += BATCH) {
    await AuditKnowledge.bulkCreate(rows.slice(i, i + BATCH))
    process.stdout.write(`\r已写入 ${Math.min(i + BATCH, rows.length)} / ${rows.length}`)
  }
  console.log('\n迁移完成 ✅')
}

main()
  .catch(err => { console.error('迁移失败：', err.message); process.exit(1) })
  .finally(() => sequelize.close())
