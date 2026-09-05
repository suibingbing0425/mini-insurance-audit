// 迁移脚本：修正历史 audit_log 中 action='audit' 混用「通过/驳回」的问题
// 背景：旧 review 接口里「通过」和「驳回」都写成 action='audit'，
//       仅靠 content 文字区分（"复核通过" / "复核不通过"）。
//       前端上线后把 audit 统一显示成「人工通过」，导致历史驳回记录被错显。
// 目标：通过 = action='audit'  content='人工通过'
//       驳回 = action='reject'  content='人工驳回'
// 用法：在 backend 目录下执行  node scripts/fix-audit-log-actions.js
// 说明：仅 UPDATE 修正历史脏数据，可重复执行（幂等，已改过的不会重复影响）。
const { sequelize } = require('../src/models')

async function main() {
  // 1. 先处理历史「驳回」：action=audit 且内容含「不通过」或「驳回」
  const [r1] = await sequelize.query(
    `UPDATE audit_log
     SET action = 'reject', content = '人工驳回'
     WHERE action = 'audit'
       AND (content LIKE '%不通过%' OR content LIKE '%驳回%')`
  )
  console.log(`[*] 历史驳回记录修正: ${r1.affectedRows ?? '-'} 条`)

  // 2. 再处理历史「通过」：剩余的 action=audit 且内容含「通过」
  //    （第 1 步已把含「不通过」的移走，这里只会命中真正的通过记录）
  const [r2] = await sequelize.query(
    `UPDATE audit_log
     SET content = '人工通过'
     WHERE action = 'audit' AND content LIKE '%通过%'`
  )
  console.log(`[*] 历史通过记录修正: ${r2.affectedRows ?? '-'} 条`)

  console.log('历史日志 action 修正完成 ✅')
  await sequelize.close()
}

main().catch((e) => {
  console.error('修正失败：', e)
  process.exit(1)
})
