// 临时验证脚本：用真实 Excel 验证 parseRuleLibrary 解析是否正确（无需连库）
const fs = require('fs')
const path = require('path')
const { parseRuleLibrary } = require('../src/services/ruleLibraryParser')

const src = process.argv[2] || 'E:/创智爱康实习文档/医疗保障基金智能监管规则库、知识库/2025年医疗保障基金智能监管规则库_手工整理版.xlsx'

async function main() {
  if (!fs.existsSync(src)) {
    console.error('文件不存在：', src)
    process.exit(1)
  }
  const buffer = fs.readFileSync(src)
  console.log('文件大小：', (buffer.length / 1024 / 1024).toFixed(2), 'MB')
  const rules = await parseRuleLibrary(buffer)
  const withDetail = rules.filter(r => r.hasDetail)
  const totalKnowledge = rules.reduce((s, r) => s + r.knowledge.length, 0)
  console.log('规则总数：', rules.length)
  console.log('含明细的规则：', withDetail.length)
  console.log('知识点总数：', totalKnowledge)
  const sample = rules.find(r => r.name === '药品限工伤保险')
  if (sample) {
    console.log('\n示例「药品限工伤保险」：')
    console.log('  category1 =', sample.category1, '| category2 =', sample.category2)
    console.log('  知识点条数 =', sample.knowledge.length)
    console.log('  第一条 =', JSON.stringify(sample.knowledge[0]))
  } else {
    console.log('\n未找到示例规则「药品限工伤保险」')
  }
}

main().catch(e => { console.error('解析失败：', e); process.exit(1) })
