// 迁移脚本：为 medical_order / audit_record 增加业务编号列并回填历史数据
// 用法：在 backend 目录下执行  node scripts/add-business-nos.js
// 说明：仅 ADD COLUMN + UPDATE 回填，不删不改任何现有数据；可重复执行（幂等）。
const { sequelize } = require('../src/models')

async function addColumnIfNotExists(table, column, def) {
  const [rows] = await sequelize.query(
    `SELECT COLUMN_NAME FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    { replacements: [table, column] }
  )
  if (rows.length === 0) {
    await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${def}`)
    console.log(`[+] 已添加列 ${table}.${column}`)
  } else {
    console.log(`[=] 列 ${table}.${column} 已存在，跳过`)
  }
}

async function main() {
  await addColumnIfNotExists('medical_order', 'order_no', 'VARCHAR(32)')
  await addColumnIfNotExists('audit_record', 'audit_no', 'VARCHAR(32)')

  const [r1] = await sequelize.query(
    "UPDATE medical_order SET order_no = CONCAT('YZ-', YEAR(created_at), '-', LPAD(id, 5, '0')) WHERE order_no IS NULL OR order_no = ''"
  )
  const [r2] = await sequelize.query(
    "UPDATE audit_record SET audit_no = CONCAT('SH-', YEAR(created_at), '-', LPAD(id, 5, '0')) WHERE audit_no IS NULL OR audit_no = ''"
  )
  console.log(`[*] medical_order 回填影响行数: ${r1.affectedRows ?? '-'}`)
  console.log(`[*] audit_record 回填影响行数: ${r2.affectedRows ?? '-'}`)
  console.log('迁移完成 ✅')
  await sequelize.close()
}

main().catch((e) => {
  console.error('迁移失败：', e)
  process.exit(1)
})
